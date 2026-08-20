using System.IdentityModel.Tokens.Jwt;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
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
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS pic VARCHAR(255)");
    migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS booking_ruang ADD COLUMN IF NOT EXISTS nomor_pemesanan VARCHAR(50)");

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
}

if (args.Contains("resetdb"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.ExecuteSqlRaw("DROP TABLE IF EXISTS chat_reads, chat_messages, booking_chat_reads, booking_chat_messages, room_booking_counters, pengiriman_logs, invoice_logs, invoices, pengiriman, divisi_counters, booking_ruang_logs, booking_ruang, users CASCADE;");
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

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.Run();
