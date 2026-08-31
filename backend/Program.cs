using System.IdentityModel.Tokens.Jwt;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Hubs;
using PengirimanApi.Services;
using QuestPDF.Infrastructure;

QuestPDF.Settings.License = LicenseType.Community;
JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
builder.Services.AddSignalR();

var connectionString = builder.Configuration.GetConnectionString("Default");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<CurrentUserService>();

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Default", policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Non-destructive column backfill: EnsureCreated() (used below) only creates tables that don't
// exist yet, it never ALTERs an existing one. New optional columns added to a model after the
// table was first created need this instead, so existing rows/data survive a normal restart.
using (var scope = app.Services.CreateScope())
{
    var migrateDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // Must run before the raw-SQL blocks below: on a brand-new database none of the model-backed
    // tables (booking_ruang, pengiriman, users, ...) exist yet, and several of those blocks
    // ALTER/reference them (e.g. booking_ruang_rooms' FK into booking_ruang) - without this they
    // fail outright on first boot against an empty database. Idempotent/no-op once the schema
    // already exists, so this is safe on every subsequent restart too.
    migrateDb.Database.EnsureCreated();
    // Backs the password-change session revocation in ProfileController/JwtService/
    // CurrentUserService: a token minted before the most recent password change no longer matches
    // this column and is rejected, instead of staying valid for the rest of its lifetime.
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP");
    // One-time backfill: "Engineering Project – EPC" (en-dash) was the departemen name actually seeded/stored
    // before OrgTree.cs was corrected to the hyphen form below - any row already stamped with the
    // old en-dash string no longer matches OrgTree's canonical list (used for access-control
    // comparisons and dropdown options), so it's rewritten here to the corrected value. Self-
    // limiting: once a row is updated it no longer matches the WHERE clause, so this is a no-op on
    // every restart after the first.
    foreach (var tableCol in new[] { "users", "pengiriman", "booking_ruang", "booking_kendaraan", "permintaan_atk", "perbaikan_sarana", "archive_documents" })
    {
        migrateDb.Database.ExecuteSqlRaw(
            $"UPDATE {tableCol} SET departemen = {{0}} WHERE departemen = {{1}}",
            "Engineering Project - EPC", "Engineering Project – EPC");
    }

    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS pic VARCHAR(255)");
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS nomor_pemesanan VARCHAR(50)");

    // Internal/External classification, recurring-series fields, and the per-booking conflict
    // flag - all new, optional/defaulted columns so existing rows stay valid.
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS tipe VARCHAR(20) NOT NULL DEFAULT 'INTERNAL'");
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS series_id UUID");
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20)");
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS recurrence_end_date DATE");
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS has_conflict BOOLEAN NOT NULL DEFAULT FALSE");

    // Additional rooms for a multi-room booking - brand new table, same reasoning as
    // booking_chat_messages below (EnsureCreated() only creates tables for a fresh database).
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS booking_ruang_rooms (
            id SERIAL PRIMARY KEY,
            booking_ruang_id INT NOT NULL REFERENCES booking_ruang(id) ON DELETE CASCADE,
            nama_ruang VARCHAR(100) NOT NULL
        )");

    // Nomor Pemesanan Ruangan switched from a per-ruangan code to a per-divisi code (matching
    // Ekspedisi's NomorTransmittal, e.g. "Corsec"), so the counter's key changed from
    // (nama_ruang, year, month) to (divisi, year, month). One-time reset of this table only if
    // it still has the old shape - counter values aren't meaningful data, just a running count,
    // so restarting them at 0 is harmless (no duplicate-number risk, only a fresh sequence).
    migrateDb.Database.ExecuteSqlRaw(@"
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'room_booking_counters' AND column_name = 'nama_ruang'
            ) THEN
                DROP TABLE room_booking_counters;
            END IF;
        END $$;
    ");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS room_booking_counters (
            divisi VARCHAR(255) NOT NULL,
            year INT NOT NULL,
            month INT NOT NULL,
            last_sequence INT NOT NULL,
            PRIMARY KEY (divisi, year, month)
        )");

    // Room booking chat: brand new tables (not a column backfill), so a plain CREATE TABLE IF
    // NOT EXISTS is enough - EnsureCreated() (used below) won't add tables for an already-
    // existing database, only for a fresh one.
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS booking_chat_messages (
            id SERIAL PRIMARY KEY,
            booking_ruang_id INT NOT NULL REFERENCES booking_ruang(id) ON DELETE CASCADE,
            sender_id INT NOT NULL REFERENCES users(id),
            message TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS booking_chat_reads (
            id SERIAL PRIMARY KEY,
            booking_ruang_id INT NOT NULL REFERENCES booking_ruang(id) ON DELETE CASCADE,
            user_id INT NOT NULL REFERENCES users(id),
            last_read_at TIMESTAMP NOT NULL,
            UNIQUE (booking_ruang_id, user_id)
        )");

    // Room availability waitlist - room name + tanggal are plain values (rooms aren't a DB table,
    // see MeetingRooms), not a foreign key. Notified entries stay until the user dismisses them
    // (BookingWaitlistController.Leave), so notified_at is a flag, not a delete trigger.
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS booking_waitlist (
            id SERIAL PRIMARY KEY,
            nama_ruang VARCHAR(100) NOT NULL,
            tanggal DATE NOT NULL,
            is_whole_day BOOLEAN NOT NULL,
            jam_mulai TIME NULL,
            jam_selesai TIME NULL,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL,
            notified_at TIMESTAMP NULL
        )");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_waitlist_room_date ON booking_waitlist (nama_ruang, tanggal)");

    // Backstops the app-level "one invoice per bulan per KPU" check against two uploads for the
    // same bulan racing each other. Wrapped so it's skipped (not a startup crash) on a database
    // that already has pre-existing duplicate rows from before this constraint existed.
    migrateDb.Database.ExecuteSqlRaw(@"
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices')
                AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_uploaded_by_bulan') THEN
                BEGIN
                    CREATE UNIQUE INDEX idx_invoices_uploaded_by_bulan ON invoices (uploaded_by, bulan);
                EXCEPTION WHEN unique_violation THEN
                    NULL;
                END;
            END IF;
        END $$;
    ");

    // One-time backfill: Admin/Approval GA items created before GaDivisiLabel/GaDepartemenLabel
    // pointed at the real org unit were stamped "General Affair" (no such Divisi actually
    // exists) with a "...GA..." NomorTransmittal. Move them onto the real Procurement and
    // General Affair / Asset Management and General Affair unit and re-issue their nomor from
    // that unit's own counter, so they read the same as anything else created there. Self-
    // limiting: once a row's divisi is updated it no longer matches the WHERE clause, so this is
    // a no-op on every restart after the first.
    migrateDb.Database.ExecuteSqlRaw(@"
        DO $$
        DECLARE
            r RECORD;
            new_seq INT;
        BEGIN
            IF to_regclass('public.pengiriman') IS NOT NULL AND to_regclass('public.divisi_counters') IS NOT NULL THEN
                FOR r IN SELECT id, tanggal FROM pengiriman WHERE divisi = 'General Affair' ORDER BY tanggal, id LOOP
                    INSERT INTO divisi_counters (divisi, year, month, last_sequence)
                    VALUES ('Procurement and General Affair', EXTRACT(YEAR FROM r.tanggal)::int, EXTRACT(MONTH FROM r.tanggal)::int, 1)
                    ON CONFLICT (divisi, year, month) DO UPDATE SET last_sequence = divisi_counters.last_sequence + 1
                    RETURNING last_sequence INTO new_seq;

                    UPDATE pengiriman
                    SET divisi = 'Procurement and General Affair',
                        departemen = 'Asset Management and General Affair',
                        nomor_transmittal = LPAD(new_seq::text, 4, '0') || '.PGA.' || TO_CHAR(r.tanggal, 'MM') || '.' || TO_CHAR(r.tanggal, 'YYYY')
                    WHERE id = r.id;
                END LOOP;

                DELETE FROM divisi_counters WHERE divisi = 'General Affair';
            END IF;
        END $$;
    ");

    // Indexes on the columns every list/stats/conflict-check query filters on (status, divisi,
    // departemen, tanggal) - EnsureCreated() only applies HasIndex() to a brand-new database, so
    // an already-existing one needs these added directly. Plain CREATE INDEX IF NOT EXISTS is
    // safe to re-run on every startup.
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_pengiriman_status ON pengiriman (status)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_pengiriman_divisi ON pengiriman (divisi)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_pengiriman_departemen ON pengiriman (departemen)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_pengiriman_tanggal ON pengiriman (tanggal)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_ruang_status ON booking_ruang (status)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_ruang_divisi ON booking_ruang (divisi)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_ruang_departemen ON booking_ruang (departemen)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_ruang_tanggal ON booking_ruang (tanggal)");

    // Vehicle Booking: brand new tables (not a column backfill), same reasoning as the Room
    // Booking chat tables above - EnsureCreated() (used below) won't add tables for an already-
    // existing database, only for a fresh one.
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS booking_kendaraan (
            id SERIAL PRIMARY KEY,
            nomor_pemesanan VARCHAR(50),
            keperluan VARCHAR(255) NOT NULL,
            pic VARCHAR(255),
            nama_kendaraan VARCHAR(100) NOT NULL,
            plat_nomor VARCHAR(20),
            kapasitas_kendaraan INT NOT NULL,
            supir VARCHAR(255),
            jumlah_penumpang INT NOT NULL,
            tanggal DATE NOT NULL,
            is_whole_day BOOLEAN NOT NULL,
            jam_mulai TIME NULL,
            jam_selesai TIME NULL,
            catatan TEXT,
            divisi VARCHAR(255) NOT NULL,
            departemen VARCHAR(255),
            status VARCHAR(50) NOT NULL,
            reject_reason TEXT,
            created_by INT NOT NULL REFERENCES users(id),
            created_by_role VARCHAR(50) NOT NULL,
            approved_by_l1 INT NULL REFERENCES users(id),
            approved_by_ga INT NULL REFERENCES users(id),
            approved_by_approval_ga INT NULL REFERENCES users(id),
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            approved_l1_at TIMESTAMP NULL,
            approved_ga_at TIMESTAMP NULL,
            approved_approval_ga_at TIMESTAMP NULL
        )");
    // Backfill for a database that already ran the CREATE TABLE above before Supir existed.
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_kendaraan ADD COLUMN IF NOT EXISTS supir VARCHAR(255)");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS booking_kendaraan_logs (
            id SERIAL PRIMARY KEY,
            booking_kendaraan_id INT NOT NULL REFERENCES booking_kendaraan(id) ON DELETE CASCADE,
            action VARCHAR(50) NOT NULL,
            actor_id INT NULL REFERENCES users(id),
            reason TEXT,
            created_at TIMESTAMP NOT NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS kendaraan_booking_counters (
            divisi VARCHAR(255) NOT NULL,
            year INT NOT NULL,
            month INT NOT NULL,
            last_sequence INT NOT NULL,
            PRIMARY KEY (divisi, year, month)
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS booking_kendaraan_chat_messages (
            id SERIAL PRIMARY KEY,
            booking_kendaraan_id INT NOT NULL REFERENCES booking_kendaraan(id) ON DELETE CASCADE,
            sender_id INT NOT NULL REFERENCES users(id),
            message TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS booking_kendaraan_chat_reads (
            id SERIAL PRIMARY KEY,
            booking_kendaraan_id INT NOT NULL REFERENCES booking_kendaraan(id) ON DELETE CASCADE,
            user_id INT NOT NULL REFERENCES users(id),
            last_read_at TIMESTAMP NOT NULL,
            UNIQUE (booking_kendaraan_id, user_id)
        )");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_kendaraan_status ON booking_kendaraan (status)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_kendaraan_divisi ON booking_kendaraan (divisi)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_kendaraan_departemen ON booking_kendaraan (departemen)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_booking_kendaraan_tanggal ON booking_kendaraan (tanggal)");

    // Office Supplies (Permintaan ATK): brand new tables, same reasoning as the Vehicle Booking
    // block above - EnsureCreated() won't add tables to an already-existing database.
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS permintaan_atk (
            id SERIAL PRIMARY KEY,
            nomor_permintaan VARCHAR(50),
            tanggal DATE NOT NULL,
            keperluan VARCHAR(255) NOT NULL,
            catatan TEXT,
            divisi VARCHAR(255) NOT NULL,
            departemen VARCHAR(255),
            status VARCHAR(50) NOT NULL,
            reject_reason TEXT,
            created_by INT NOT NULL REFERENCES users(id),
            created_by_role VARCHAR(50) NOT NULL,
            approved_by_l1 INT NULL REFERENCES users(id),
            approved_by_ga INT NULL REFERENCES users(id),
            approved_by_approval_ga INT NULL REFERENCES users(id),
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            approved_l1_at TIMESTAMP NULL,
            approved_ga_at TIMESTAMP NULL,
            approved_approval_ga_at TIMESTAMP NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS permintaan_atk_items (
            id SERIAL PRIMARY KEY,
            permintaan_atk_id INT NOT NULL REFERENCES permintaan_atk(id) ON DELETE CASCADE,
            nama_barang VARCHAR(255) NOT NULL,
            jumlah INT NOT NULL,
            satuan VARCHAR(50) NOT NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS permintaan_atk_logs (
            id SERIAL PRIMARY KEY,
            permintaan_atk_id INT NOT NULL REFERENCES permintaan_atk(id) ON DELETE CASCADE,
            action VARCHAR(50) NOT NULL,
            actor_id INT NULL REFERENCES users(id),
            reason TEXT,
            created_at TIMESTAMP NOT NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS atk_counters (
            divisi VARCHAR(255) NOT NULL,
            year INT NOT NULL,
            month INT NOT NULL,
            last_sequence INT NOT NULL,
            PRIMARY KEY (divisi, year, month)
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS permintaan_atk_chat_messages (
            id SERIAL PRIMARY KEY,
            permintaan_atk_id INT NOT NULL REFERENCES permintaan_atk(id) ON DELETE CASCADE,
            sender_id INT NOT NULL REFERENCES users(id),
            message TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS permintaan_atk_chat_reads (
            id SERIAL PRIMARY KEY,
            permintaan_atk_id INT NOT NULL REFERENCES permintaan_atk(id) ON DELETE CASCADE,
            user_id INT NOT NULL REFERENCES users(id),
            last_read_at TIMESTAMP NOT NULL,
            UNIQUE (permintaan_atk_id, user_id)
        )");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_atk_status ON permintaan_atk (status)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_atk_divisi ON permintaan_atk (divisi)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_atk_departemen ON permintaan_atk (departemen)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_permintaan_atk_tanggal ON permintaan_atk (tanggal)");

    // Maintenance (Perbaikan Sarana): brand new tables, same reasoning as the blocks above -
    // EnsureCreated() won't add tables to an already-existing database.
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS perbaikan_sarana (
            id SERIAL PRIMARY KEY,
            nomor_perbaikan VARCHAR(50),
            tanggal DATE NOT NULL,
            lokasi VARCHAR(255) NOT NULL,
            kategori VARCHAR(50) NOT NULL,
            urgensi VARCHAR(50) NOT NULL,
            deskripsi_kerusakan TEXT NOT NULL,
            catatan TEXT,
            divisi VARCHAR(255) NOT NULL,
            departemen VARCHAR(255),
            status VARCHAR(50) NOT NULL,
            reject_reason TEXT,
            created_by INT NOT NULL REFERENCES users(id),
            created_by_role VARCHAR(50) NOT NULL,
            approved_by_l1 INT NULL REFERENCES users(id),
            approved_by_ga INT NULL REFERENCES users(id),
            approved_by_approval_ga INT NULL REFERENCES users(id),
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            approved_l1_at TIMESTAMP NULL,
            approved_ga_at TIMESTAMP NULL,
            approved_approval_ga_at TIMESTAMP NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS perbaikan_sarana_logs (
            id SERIAL PRIMARY KEY,
            perbaikan_sarana_id INT NOT NULL REFERENCES perbaikan_sarana(id) ON DELETE CASCADE,
            action VARCHAR(50) NOT NULL,
            actor_id INT NULL REFERENCES users(id),
            reason TEXT,
            created_at TIMESTAMP NOT NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS sarana_counters (
            divisi VARCHAR(255) NOT NULL,
            year INT NOT NULL,
            month INT NOT NULL,
            last_sequence INT NOT NULL,
            PRIMARY KEY (divisi, year, month)
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS perbaikan_sarana_chat_messages (
            id SERIAL PRIMARY KEY,
            perbaikan_sarana_id INT NOT NULL REFERENCES perbaikan_sarana(id) ON DELETE CASCADE,
            sender_id INT NOT NULL REFERENCES users(id),
            message TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL
        )");
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS perbaikan_sarana_chat_reads (
            id SERIAL PRIMARY KEY,
            perbaikan_sarana_id INT NOT NULL REFERENCES perbaikan_sarana(id) ON DELETE CASCADE,
            user_id INT NOT NULL REFERENCES users(id),
            last_read_at TIMESTAMP NOT NULL,
            UNIQUE (perbaikan_sarana_id, user_id)
        )");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_perbaikan_sarana_status ON perbaikan_sarana (status)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_perbaikan_sarana_divisi ON perbaikan_sarana (divisi)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_perbaikan_sarana_departemen ON perbaikan_sarana (departemen)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_perbaikan_sarana_tanggal ON perbaikan_sarana (tanggal)");

    // Archive: brand new table, same reasoning as the blocks above - EnsureCreated() won't add
    // tables to an already-existing database. No approval workflow here (see ArchiveDocument.cs),
    // so unlike the other modules there is no logs/counter/chat table to go with it.
    migrateDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS archive_documents (
            id SERIAL PRIMARY KEY,
            nama_dokumen VARCHAR(255) NOT NULL,
            kategori VARCHAR(50) NOT NULL,
            file_path VARCHAR(255) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            content_type VARCHAR(150) NOT NULL,
            file_size_bytes BIGINT NOT NULL,
            catatan TEXT,
            divisi VARCHAR(255) NOT NULL,
            departemen VARCHAR(255),
            uploaded_by INT NOT NULL REFERENCES users(id),
            uploaded_by_role VARCHAR(50) NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        )");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_archive_documents_kategori ON archive_documents (kategori)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_archive_documents_divisi ON archive_documents (divisi)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_archive_documents_departemen ON archive_documents (departemen)");
    migrateDb.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS ix_archive_documents_created_at ON archive_documents (created_at)");

    // Cancel Booking feature - plain name snapshot of who cancelled it (see
    // BookingRuangController.Cancel/BookingKendaraanController.Cancel), not a User FK.
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS cancelled_by_name VARCHAR(255)");
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_kendaraan ADD COLUMN IF NOT EXISTS cancelled_by_name VARCHAR(255)");
}

if (args.Contains("resetdb"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.ExecuteSqlRaw("DROP TABLE IF EXISTS chat_reads, chat_messages, booking_chat_reads, booking_chat_messages, booking_waitlist, booking_kendaraan_chat_reads, booking_kendaraan_chat_messages, booking_kendaraan_logs, booking_kendaraan, kendaraan_booking_counters, permintaan_atk_chat_reads, permintaan_atk_chat_messages, permintaan_atk_logs, permintaan_atk_items, permintaan_atk, atk_counters, perbaikan_sarana_chat_reads, perbaikan_sarana_chat_messages, perbaikan_sarana_logs, perbaikan_sarana, sarana_counters, archive_documents, room_booking_counters, pengiriman_logs, invoice_logs, invoices, pengiriman, divisi_counters, booking_ruang_logs, booking_ruang_rooms, booking_ruang, users CASCADE;");
    DbSeeder.Seed(db);
    return;
}

if (args.Contains("seed"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DbSeeder.Seed(db);
    return;
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Default");
app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.Run();
