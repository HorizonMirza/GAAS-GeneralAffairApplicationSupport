using Microsoft.EntityFrameworkCore;
using PengirimanApi.Models;

namespace PengirimanApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Pengiriman> Pengiriman => Set<Pengiriman>();
    public DbSet<PengirimanLog> PengirimanLogs => Set<PengirimanLog>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLog> InvoiceLogs => Set<InvoiceLog>();
    public DbSet<DivisiCounter> DivisiCounters => Set<DivisiCounter>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<ChatRead> ChatReads => Set<ChatRead>();
    public DbSet<BookingRuang> BookingRuangs => Set<BookingRuang>();
    public DbSet<BookingRuangLog> BookingRuangLogs => Set<BookingRuangLog>();
    public DbSet<BookingRuangRoom> BookingRuangRooms => Set<BookingRuangRoom>();
    public DbSet<BookingChatMessage> BookingChatMessages => Set<BookingChatMessage>();
    public DbSet<BookingChatRead> BookingChatReads => Set<BookingChatRead>();
    public DbSet<RoomBookingCounter> RoomBookingCounters => Set<RoomBookingCounter>();
    public DbSet<BookingWaitlist> BookingWaitlists => Set<BookingWaitlist>();
    public DbSet<BookingKendaraan> BookingKendaraans => Set<BookingKendaraan>();
    public DbSet<BookingKendaraanLog> BookingKendaraanLogs => Set<BookingKendaraanLog>();
    public DbSet<BookingKendaraanChatMessage> BookingKendaraanChatMessages => Set<BookingKendaraanChatMessage>();
    public DbSet<BookingKendaraanChatRead> BookingKendaraanChatReads => Set<BookingKendaraanChatRead>();
    public DbSet<KendaraanBookingCounter> KendaraanBookingCounters => Set<KendaraanBookingCounter>();
    public DbSet<PermintaanAtk> PermintaanAtks => Set<PermintaanAtk>();
    public DbSet<PermintaanAtkItem> PermintaanAtkItems => Set<PermintaanAtkItem>();
    public DbSet<PermintaanAtkLog> PermintaanAtkLogs => Set<PermintaanAtkLog>();
    public DbSet<PermintaanAtkChatMessage> PermintaanAtkChatMessages => Set<PermintaanAtkChatMessage>();
    public DbSet<PermintaanAtkChatRead> PermintaanAtkChatReads => Set<PermintaanAtkChatRead>();
    public DbSet<AtkCounter> AtkCounters => Set<AtkCounter>();
    public DbSet<PerbaikanSarana> PerbaikanSaranas => Set<PerbaikanSarana>();
    public DbSet<PerbaikanSaranaLog> PerbaikanSaranaLogs => Set<PerbaikanSaranaLog>();
    public DbSet<PerbaikanSaranaChatMessage> PerbaikanSaranaChatMessages => Set<PerbaikanSaranaChatMessage>();
    public DbSet<PerbaikanSaranaChatRead> PerbaikanSaranaChatReads => Set<PerbaikanSaranaChatRead>();
    public DbSet<SaranaCounter> SaranaCounters => Set<SaranaCounter>();
    public DbSet<ArchiveDocument> ArchiveDocuments => Set<ArchiveDocument>();

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<User>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<Pengiriman>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
            if (entry.State is EntityState.Added or EntityState.Modified) entry.Entity.UpdatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<PengirimanLog>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<Invoice>())
        {
            if (entry.State == EntityState.Added && entry.Entity.UploadedAt == default) entry.Entity.UploadedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<InvoiceLog>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<ChatMessage>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<BookingChatMessage>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<BookingRuang>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
            if (entry.State is EntityState.Added or EntityState.Modified) entry.Entity.UpdatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<BookingRuangLog>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<BookingWaitlist>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<BookingKendaraan>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
            if (entry.State is EntityState.Added or EntityState.Modified) entry.Entity.UpdatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<BookingKendaraanLog>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<BookingKendaraanChatMessage>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<PermintaanAtk>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
            if (entry.State is EntityState.Added or EntityState.Modified) entry.Entity.UpdatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<PermintaanAtkLog>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<PermintaanAtkChatMessage>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<PerbaikanSarana>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
            if (entry.State is EntityState.Added or EntityState.Modified) entry.Entity.UpdatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<PerbaikanSaranaLog>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<PerbaikanSaranaChatMessage>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
        }
        foreach (var entry in ChangeTracker.Entries<ArchiveDocument>())
        {
            if (entry.State == EntityState.Added) entry.Entity.CreatedAt = now;
            if (entry.State is EntityState.Added or EntityState.Modified) entry.Entity.UpdatedAt = now;
        }
        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(u => u.Id);
            e.Property(u => u.Id).HasColumnName("id");
            e.Property(u => u.Username).HasColumnName("username").HasMaxLength(255).IsRequired();
            e.HasIndex(u => u.Username).IsUnique();
            e.Property(u => u.PasswordHash).HasColumnName("password_hash").HasMaxLength(255).IsRequired();
            e.Property(u => u.Nama).HasColumnName("nama").HasMaxLength(255).IsRequired();
            e.Property(u => u.Role).HasColumnName("role").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(u => u.Direktorat).HasColumnName("direktorat").HasMaxLength(255);
            e.Property(u => u.Divisi).HasColumnName("divisi").HasMaxLength(255);
            e.Property(u => u.Departemen).HasColumnName("departemen").HasMaxLength(255);
            e.Property(u => u.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Pengiriman>(e =>
        {
            e.ToTable("pengiriman");
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.NoResi).HasColumnName("no_resi").HasMaxLength(100);
            e.Property(p => p.Tanggal).HasColumnName("tanggal");
            e.Property(p => p.TujuanPenerimaan).HasColumnName("tujuan_penerimaan").HasMaxLength(255).IsRequired();
            e.Property(p => p.JumlahItem).HasColumnName("jumlah_item");
            e.Property(p => p.NamaPengirim).HasColumnName("nama_pengirim").HasMaxLength(255).IsRequired();
            e.Property(p => p.NoTeleponPengirim).HasColumnName("no_telepon_pengirim").HasMaxLength(50).IsRequired();
            e.Property(p => p.AlamatPengirim).HasColumnName("alamat_pengirim").IsRequired();
            e.Property(p => p.Divisi).HasColumnName("divisi").HasMaxLength(255).IsRequired();
            e.Property(p => p.Departemen).HasColumnName("departemen").HasMaxLength(255);
            e.Property(p => p.NomorTransmittal).HasColumnName("nomor_transmittal").HasMaxLength(100).IsRequired();
            e.Property(p => p.KodeProgram).HasColumnName("kode_program").HasMaxLength(100).IsRequired();
            e.Property(p => p.NamaPenerima).HasColumnName("nama_penerima").HasMaxLength(255).IsRequired();
            e.Property(p => p.AlamatPenerima).HasColumnName("alamat_penerima").IsRequired();
            e.Property(p => p.NoTeleponPenerima).HasColumnName("no_telepon_penerima").HasMaxLength(50).IsRequired();
            e.Property(p => p.AsuransiStatus).HasColumnName("asuransi_status").HasConversion<string>().HasMaxLength(20).IsRequired();
            e.Property(p => p.RequestPacking).HasColumnName("request_packing").HasMaxLength(255).IsRequired();
            e.Property(p => p.Catatan).HasColumnName("catatan");

            e.Property(p => p.BeratBarangKg).HasColumnName("berat_barang_kg").HasColumnType("decimal(10,2)");
            e.Property(p => p.AsuransiHarga).HasColumnName("asuransi_harga").HasColumnType("decimal(14,2)");
            e.Property(p => p.SubTotal).HasColumnName("sub_total").HasColumnType("decimal(14,2)");
            e.Property(p => p.Total).HasColumnName("total").HasColumnType("decimal(14,2)");

            // Concurrency token: guards approve/reject endpoints against two actors racing on the
            // same status transition (see PengirimanController approve-l1/approve-ga/etc). Every
            // write path re-reads Status via FindAsync before mutating it, so this only rejects
            // genuine concurrent writes, never a normal single-request update.
            e.Property(p => p.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(50).IsRequired().IsConcurrencyToken();
            e.Property(p => p.RejectReason).HasColumnName("reject_reason");
            e.Property(p => p.RejectTarget).HasColumnName("reject_target").HasConversion<string>().HasMaxLength(20);

            e.Property(p => p.CreatedBy).HasColumnName("created_by");
            e.Property(p => p.CreatedByRole).HasColumnName("created_by_role").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(p => p.ApprovedByL1).HasColumnName("approved_by_l1");
            e.Property(p => p.ApprovedByGa).HasColumnName("approved_by_ga");
            e.Property(p => p.ApprovedByApprovalGa).HasColumnName("approved_by_approval_ga");
            e.Property(p => p.ApprovedByKpu).HasColumnName("approved_by_kpu");

            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.ApprovedL1At).HasColumnName("approved_l1_at");
            e.Property(p => p.ApprovedGaAt).HasColumnName("approved_ga_at");
            e.Property(p => p.ApprovedApprovalGaAt).HasColumnName("approved_approval_ga_at");
            e.Property(p => p.ApprovedKpuAt).HasColumnName("approved_kpu_at");

            e.HasOne(p => p.Pembuat)
                .WithMany(u => u.PengirimanDibuat)
                .HasForeignKey(p => p.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // Status/Divisi/Departemen/Tanggal are the columns every list/stats query filters
            // on (ApplyListFilters) - indexed so those filters don't degrade to a full table scan
            // as the table grows. Explicit names match the CREATE INDEX IF NOT EXISTS backfill in
            // Program.cs, which runs on every startup, so it stays a no-op on a database that got
            // these same indexes from EnsureCreated() instead.
            e.HasIndex(p => p.Status).HasDatabaseName("ix_pengiriman_status");
            e.HasIndex(p => p.Divisi).HasDatabaseName("ix_pengiriman_divisi");
            e.HasIndex(p => p.Departemen).HasDatabaseName("ix_pengiriman_departemen");
            e.HasIndex(p => p.Tanggal).HasDatabaseName("ix_pengiriman_tanggal");
        });

        modelBuilder.Entity<PengirimanLog>(e =>
        {
            e.ToTable("pengiriman_logs");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).HasColumnName("id");
            e.Property(l => l.PengirimanId).HasColumnName("pengiriman_id");
            e.Property(l => l.Action).HasColumnName("action").HasMaxLength(50).IsRequired();
            e.Property(l => l.ActorId).HasColumnName("actor_id");
            e.Property(l => l.Reason).HasColumnName("reason");
            e.Property(l => l.CreatedAt).HasColumnName("created_at");

            e.HasOne(l => l.Pengiriman)
                .WithMany(p => p.Logs)
                .HasForeignKey(l => l.PengirimanId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(l => l.Aktor)
                .WithMany()
                .HasForeignKey(l => l.ActorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ChatMessage>(e =>
        {
            e.ToTable("chat_messages");
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasColumnName("id");
            e.Property(m => m.PengirimanId).HasColumnName("pengiriman_id");
            e.Property(m => m.SenderId).HasColumnName("sender_id");
            e.Property(m => m.Message).HasColumnName("message").IsRequired();
            e.Property(m => m.CreatedAt).HasColumnName("created_at");

            e.HasOne(m => m.Pengiriman)
                .WithMany()
                .HasForeignKey(m => m.PengirimanId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ChatRead>(e =>
        {
            e.ToTable("chat_reads");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id");
            e.Property(r => r.PengirimanId).HasColumnName("pengiriman_id");
            e.Property(r => r.UserId).HasColumnName("user_id");
            e.Property(r => r.LastReadAt).HasColumnName("last_read_at");
            e.HasIndex(r => new { r.PengirimanId, r.UserId }).IsUnique();

            e.HasOne(r => r.Pengiriman)
                .WithMany()
                .HasForeignKey(r => r.PengirimanId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BookingChatMessage>(e =>
        {
            e.ToTable("booking_chat_messages");
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasColumnName("id");
            e.Property(m => m.BookingRuangId).HasColumnName("booking_ruang_id");
            e.Property(m => m.SenderId).HasColumnName("sender_id");
            e.Property(m => m.Message).HasColumnName("message").IsRequired();
            e.Property(m => m.CreatedAt).HasColumnName("created_at");

            e.HasOne(m => m.BookingRuang)
                .WithMany()
                .HasForeignKey(m => m.BookingRuangId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BookingChatRead>(e =>
        {
            e.ToTable("booking_chat_reads");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id");
            e.Property(r => r.BookingRuangId).HasColumnName("booking_ruang_id");
            e.Property(r => r.UserId).HasColumnName("user_id");
            e.Property(r => r.LastReadAt).HasColumnName("last_read_at");
            e.HasIndex(r => new { r.BookingRuangId, r.UserId }).IsUnique();

            e.HasOne(r => r.BookingRuang)
                .WithMany()
                .HasForeignKey(r => r.BookingRuangId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BookingRuang>(e =>
        {
            e.ToTable("booking_ruang");
            e.HasKey(b => b.Id);
            e.Property(b => b.Id).HasColumnName("id");
            e.Property(b => b.NomorPemesanan).HasColumnName("nomor_pemesanan").HasMaxLength(50);
            e.Property(b => b.NamaKegiatan).HasColumnName("nama_kegiatan").HasMaxLength(255).IsRequired();
            e.Property(b => b.Pic).HasColumnName("pic").HasMaxLength(255);
            e.Property(b => b.NamaRuang).HasColumnName("nama_ruang").HasMaxLength(100).IsRequired();
            e.Property(b => b.KapasitasRuang).HasColumnName("kapasitas_ruang");
            e.Property(b => b.JumlahPeserta).HasColumnName("jumlah_peserta");
            e.Property(b => b.Tanggal).HasColumnName("tanggal");
            e.Property(b => b.IsWholeDay).HasColumnName("is_whole_day");
            e.Property(b => b.JamMulai).HasColumnName("jam_mulai");
            e.Property(b => b.JamSelesai).HasColumnName("jam_selesai");
            e.Property(b => b.Catatan).HasColumnName("catatan");

            e.Property(b => b.Divisi).HasColumnName("divisi").HasMaxLength(255).IsRequired();
            e.Property(b => b.Departemen).HasColumnName("departemen").HasMaxLength(255);

            e.Property(b => b.Tipe).HasColumnName("tipe").HasConversion<string>().HasMaxLength(20).IsRequired();
            e.Property(b => b.SeriesId).HasColumnName("series_id");
            e.Property(b => b.RecurrenceFrequency).HasColumnName("recurrence_frequency").HasConversion<string>().HasMaxLength(20);
            e.Property(b => b.RecurrenceEndDate).HasColumnName("recurrence_end_date");
            e.Property(b => b.HasConflict).HasColumnName("has_conflict");

            e.Property(b => b.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(b => b.RejectReason).HasColumnName("reject_reason");
            e.Property(b => b.RejectTarget).HasColumnName("reject_target").HasConversion<string>().HasMaxLength(20);

            e.Property(b => b.CreatedBy).HasColumnName("created_by");
            e.Property(b => b.CreatedByRole).HasColumnName("created_by_role").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(b => b.ApprovedByL1).HasColumnName("approved_by_l1");
            e.Property(b => b.ApprovedByGa).HasColumnName("approved_by_ga");
            e.Property(b => b.ApprovedByApprovalGa).HasColumnName("approved_by_approval_ga");

            e.Property(b => b.CreatedAt).HasColumnName("created_at");
            e.Property(b => b.UpdatedAt).HasColumnName("updated_at");
            e.Property(b => b.ApprovedL1At).HasColumnName("approved_l1_at");
            e.Property(b => b.ApprovedGaAt).HasColumnName("approved_ga_at");
            e.Property(b => b.ApprovedApprovalGaAt).HasColumnName("approved_approval_ga_at");

            e.HasOne(b => b.Pembuat)
                .WithMany()
                .HasForeignKey(b => b.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // Same reasoning as Pengiriman above - these are the columns every list/schedule/
            // conflict-check query filters on.
            e.HasIndex(b => b.Status).HasDatabaseName("ix_booking_ruang_status");
            e.HasIndex(b => b.Divisi).HasDatabaseName("ix_booking_ruang_divisi");
            e.HasIndex(b => b.Departemen).HasDatabaseName("ix_booking_ruang_departemen");
            e.HasIndex(b => b.Tanggal).HasDatabaseName("ix_booking_ruang_tanggal");
        });

        modelBuilder.Entity<BookingRuangRoom>(e =>
        {
            e.ToTable("booking_ruang_rooms");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id");
            e.Property(r => r.BookingRuangId).HasColumnName("booking_ruang_id");
            e.Property(r => r.NamaRuang).HasColumnName("nama_ruang").HasMaxLength(100).IsRequired();

            e.HasOne(r => r.BookingRuang)
                .WithMany(b => b.AdditionalRooms)
                .HasForeignKey(r => r.BookingRuangId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BookingRuangLog>(e =>
        {
            e.ToTable("booking_ruang_logs");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).HasColumnName("id");
            e.Property(l => l.BookingRuangId).HasColumnName("booking_ruang_id");
            e.Property(l => l.Action).HasColumnName("action").HasMaxLength(50).IsRequired();
            e.Property(l => l.ActorId).HasColumnName("actor_id");
            e.Property(l => l.Reason).HasColumnName("reason");
            e.Property(l => l.CreatedAt).HasColumnName("created_at");

            e.HasOne(l => l.BookingRuang)
                .WithMany(b => b.Logs)
                .HasForeignKey(l => l.BookingRuangId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(l => l.Aktor)
                .WithMany()
                .HasForeignKey(l => l.ActorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RoomBookingCounter>(e =>
        {
            e.ToTable("room_booking_counters");
            e.HasKey(c => new { c.Divisi, c.Year, c.Month });
            e.Property(c => c.Divisi).HasColumnName("divisi").HasMaxLength(255);
            e.Property(c => c.Year).HasColumnName("year");
            e.Property(c => c.Month).HasColumnName("month");
            e.Property(c => c.LastSequence).HasColumnName("last_sequence");
        });

        modelBuilder.Entity<BookingWaitlist>(e =>
        {
            e.ToTable("booking_waitlist");
            e.HasKey(w => w.Id);
            e.Property(w => w.Id).HasColumnName("id");
            e.Property(w => w.NamaRuang).HasColumnName("nama_ruang").HasMaxLength(100).IsRequired();
            e.Property(w => w.Tanggal).HasColumnName("tanggal");
            e.Property(w => w.IsWholeDay).HasColumnName("is_whole_day");
            e.Property(w => w.JamMulai).HasColumnName("jam_mulai");
            e.Property(w => w.JamSelesai).HasColumnName("jam_selesai");
            e.Property(w => w.UserId).HasColumnName("user_id");
            e.Property(w => w.CreatedAt).HasColumnName("created_at");
            e.Property(w => w.NotifiedAt).HasColumnName("notified_at");

            e.HasOne(w => w.User)
                .WithMany()
                .HasForeignKey(w => w.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(w => new { w.NamaRuang, w.Tanggal }).HasDatabaseName("ix_booking_waitlist_room_date");
        });

        modelBuilder.Entity<BookingKendaraan>(e =>
        {
            e.ToTable("booking_kendaraan");
            e.HasKey(b => b.Id);
            e.Property(b => b.Id).HasColumnName("id");
            e.Property(b => b.NomorPemesanan).HasColumnName("nomor_pemesanan").HasMaxLength(50);
            e.Property(b => b.Keperluan).HasColumnName("keperluan").HasMaxLength(255).IsRequired();
            e.Property(b => b.Pic).HasColumnName("pic").HasMaxLength(255);
            e.Property(b => b.NamaKendaraan).HasColumnName("nama_kendaraan").HasMaxLength(100).IsRequired();
            e.Property(b => b.PlatNomor).HasColumnName("plat_nomor").HasMaxLength(20);
            e.Property(b => b.KapasitasKendaraan).HasColumnName("kapasitas_kendaraan");
            e.Property(b => b.Supir).HasColumnName("supir").HasMaxLength(255);
            e.Property(b => b.JumlahPenumpang).HasColumnName("jumlah_penumpang");
            e.Property(b => b.Tanggal).HasColumnName("tanggal");
            e.Property(b => b.IsWholeDay).HasColumnName("is_whole_day");
            e.Property(b => b.JamMulai).HasColumnName("jam_mulai");
            e.Property(b => b.JamSelesai).HasColumnName("jam_selesai");
            e.Property(b => b.Catatan).HasColumnName("catatan");

            e.Property(b => b.Divisi).HasColumnName("divisi").HasMaxLength(255).IsRequired();
            e.Property(b => b.Departemen).HasColumnName("departemen").HasMaxLength(255);

            e.Property(b => b.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(b => b.RejectReason).HasColumnName("reject_reason");

            e.Property(b => b.CreatedBy).HasColumnName("created_by");
            e.Property(b => b.CreatedByRole).HasColumnName("created_by_role").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(b => b.ApprovedByL1).HasColumnName("approved_by_l1");
            e.Property(b => b.ApprovedByGa).HasColumnName("approved_by_ga");
            e.Property(b => b.ApprovedByApprovalGa).HasColumnName("approved_by_approval_ga");

            e.Property(b => b.CreatedAt).HasColumnName("created_at");
            e.Property(b => b.UpdatedAt).HasColumnName("updated_at");
            e.Property(b => b.ApprovedL1At).HasColumnName("approved_l1_at");
            e.Property(b => b.ApprovedGaAt).HasColumnName("approved_ga_at");
            e.Property(b => b.ApprovedApprovalGaAt).HasColumnName("approved_approval_ga_at");

            e.HasOne(b => b.Pembuat)
                .WithMany()
                .HasForeignKey(b => b.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(b => b.Status).HasDatabaseName("ix_booking_kendaraan_status");
            e.HasIndex(b => b.Divisi).HasDatabaseName("ix_booking_kendaraan_divisi");
            e.HasIndex(b => b.Departemen).HasDatabaseName("ix_booking_kendaraan_departemen");
            e.HasIndex(b => b.Tanggal).HasDatabaseName("ix_booking_kendaraan_tanggal");
        });

        modelBuilder.Entity<BookingKendaraanLog>(e =>
        {
            e.ToTable("booking_kendaraan_logs");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).HasColumnName("id");
            e.Property(l => l.BookingKendaraanId).HasColumnName("booking_kendaraan_id");
            e.Property(l => l.Action).HasColumnName("action").HasMaxLength(50).IsRequired();
            e.Property(l => l.ActorId).HasColumnName("actor_id");
            e.Property(l => l.Reason).HasColumnName("reason");
            e.Property(l => l.CreatedAt).HasColumnName("created_at");

            e.HasOne(l => l.BookingKendaraan)
                .WithMany(b => b.Logs)
                .HasForeignKey(l => l.BookingKendaraanId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(l => l.Aktor)
                .WithMany()
                .HasForeignKey(l => l.ActorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<KendaraanBookingCounter>(e =>
        {
            e.ToTable("kendaraan_booking_counters");
            e.HasKey(c => new { c.Divisi, c.Year, c.Month });
            e.Property(c => c.Divisi).HasColumnName("divisi").HasMaxLength(255);
            e.Property(c => c.Year).HasColumnName("year");
            e.Property(c => c.Month).HasColumnName("month");
            e.Property(c => c.LastSequence).HasColumnName("last_sequence");
        });

        modelBuilder.Entity<BookingKendaraanChatMessage>(e =>
        {
            e.ToTable("booking_kendaraan_chat_messages");
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasColumnName("id");
            e.Property(m => m.BookingKendaraanId).HasColumnName("booking_kendaraan_id");
            e.Property(m => m.SenderId).HasColumnName("sender_id");
            e.Property(m => m.Message).HasColumnName("message").IsRequired();
            e.Property(m => m.CreatedAt).HasColumnName("created_at");

            e.HasOne(m => m.BookingKendaraan)
                .WithMany()
                .HasForeignKey(m => m.BookingKendaraanId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<BookingKendaraanChatRead>(e =>
        {
            e.ToTable("booking_kendaraan_chat_reads");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id");
            e.Property(r => r.BookingKendaraanId).HasColumnName("booking_kendaraan_id");
            e.Property(r => r.UserId).HasColumnName("user_id");
            e.Property(r => r.LastReadAt).HasColumnName("last_read_at");
            e.HasIndex(r => new { r.BookingKendaraanId, r.UserId }).IsUnique();

            e.HasOne(r => r.BookingKendaraan)
                .WithMany()
                .HasForeignKey(r => r.BookingKendaraanId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PermintaanAtk>(e =>
        {
            e.ToTable("permintaan_atk");
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.NomorPermintaan).HasColumnName("nomor_permintaan").HasMaxLength(50);
            e.Property(p => p.Tanggal).HasColumnName("tanggal");
            e.Property(p => p.Keperluan).HasColumnName("keperluan").HasMaxLength(255).IsRequired();
            e.Property(p => p.Catatan).HasColumnName("catatan");

            e.Property(p => p.Divisi).HasColumnName("divisi").HasMaxLength(255).IsRequired();
            e.Property(p => p.Departemen).HasColumnName("departemen").HasMaxLength(255);

            e.Property(p => p.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(p => p.RejectReason).HasColumnName("reject_reason");

            e.Property(p => p.CreatedBy).HasColumnName("created_by");
            e.Property(p => p.CreatedByRole).HasColumnName("created_by_role").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(p => p.ApprovedByL1).HasColumnName("approved_by_l1");
            e.Property(p => p.ApprovedByGa).HasColumnName("approved_by_ga");
            e.Property(p => p.ApprovedByApprovalGa).HasColumnName("approved_by_approval_ga");

            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.ApprovedL1At).HasColumnName("approved_l1_at");
            e.Property(p => p.ApprovedGaAt).HasColumnName("approved_ga_at");
            e.Property(p => p.ApprovedApprovalGaAt).HasColumnName("approved_approval_ga_at");

            e.HasOne(p => p.Pembuat)
                .WithMany()
                .HasForeignKey(p => p.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(p => p.Status).HasDatabaseName("ix_permintaan_atk_status");
            e.HasIndex(p => p.Divisi).HasDatabaseName("ix_permintaan_atk_divisi");
            e.HasIndex(p => p.Departemen).HasDatabaseName("ix_permintaan_atk_departemen");
            e.HasIndex(p => p.Tanggal).HasDatabaseName("ix_permintaan_atk_tanggal");
        });

        modelBuilder.Entity<PermintaanAtkItem>(e =>
        {
            e.ToTable("permintaan_atk_items");
            e.HasKey(i => i.Id);
            e.Property(i => i.Id).HasColumnName("id");
            e.Property(i => i.PermintaanAtkId).HasColumnName("permintaan_atk_id");
            e.Property(i => i.NamaBarang).HasColumnName("nama_barang").HasMaxLength(255).IsRequired();
            e.Property(i => i.Jumlah).HasColumnName("jumlah");
            e.Property(i => i.Satuan).HasColumnName("satuan").HasMaxLength(50).IsRequired();

            e.HasOne(i => i.PermintaanAtk)
                .WithMany(p => p.Items)
                .HasForeignKey(i => i.PermintaanAtkId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PermintaanAtkLog>(e =>
        {
            e.ToTable("permintaan_atk_logs");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).HasColumnName("id");
            e.Property(l => l.PermintaanAtkId).HasColumnName("permintaan_atk_id");
            e.Property(l => l.Action).HasColumnName("action").HasMaxLength(50).IsRequired();
            e.Property(l => l.ActorId).HasColumnName("actor_id");
            e.Property(l => l.Reason).HasColumnName("reason");
            e.Property(l => l.CreatedAt).HasColumnName("created_at");

            e.HasOne(l => l.PermintaanAtk)
                .WithMany(p => p.Logs)
                .HasForeignKey(l => l.PermintaanAtkId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(l => l.Aktor)
                .WithMany()
                .HasForeignKey(l => l.ActorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AtkCounter>(e =>
        {
            e.ToTable("atk_counters");
            e.HasKey(c => new { c.Divisi, c.Year, c.Month });
            e.Property(c => c.Divisi).HasColumnName("divisi").HasMaxLength(255);
            e.Property(c => c.Year).HasColumnName("year");
            e.Property(c => c.Month).HasColumnName("month");
            e.Property(c => c.LastSequence).HasColumnName("last_sequence");
        });

        modelBuilder.Entity<PermintaanAtkChatMessage>(e =>
        {
            e.ToTable("permintaan_atk_chat_messages");
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasColumnName("id");
            e.Property(m => m.PermintaanAtkId).HasColumnName("permintaan_atk_id");
            e.Property(m => m.SenderId).HasColumnName("sender_id");
            e.Property(m => m.Message).HasColumnName("message").IsRequired();
            e.Property(m => m.CreatedAt).HasColumnName("created_at");

            e.HasOne(m => m.PermintaanAtk)
                .WithMany()
                .HasForeignKey(m => m.PermintaanAtkId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PermintaanAtkChatRead>(e =>
        {
            e.ToTable("permintaan_atk_chat_reads");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id");
            e.Property(r => r.PermintaanAtkId).HasColumnName("permintaan_atk_id");
            e.Property(r => r.UserId).HasColumnName("user_id");
            e.Property(r => r.LastReadAt).HasColumnName("last_read_at");
            e.HasIndex(r => new { r.PermintaanAtkId, r.UserId }).IsUnique();

            e.HasOne(r => r.PermintaanAtk)
                .WithMany()
                .HasForeignKey(r => r.PermintaanAtkId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PerbaikanSarana>(e =>
        {
            e.ToTable("perbaikan_sarana");
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.NomorPerbaikan).HasColumnName("nomor_perbaikan").HasMaxLength(50);
            e.Property(p => p.Tanggal).HasColumnName("tanggal");
            e.Property(p => p.Lokasi).HasColumnName("lokasi").HasMaxLength(255).IsRequired();
            e.Property(p => p.Kategori).HasColumnName("kategori").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(p => p.Urgensi).HasColumnName("urgensi").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(p => p.DeskripsiKerusakan).HasColumnName("deskripsi_kerusakan").IsRequired();
            e.Property(p => p.Catatan).HasColumnName("catatan");

            e.Property(p => p.Divisi).HasColumnName("divisi").HasMaxLength(255).IsRequired();
            e.Property(p => p.Departemen).HasColumnName("departemen").HasMaxLength(255);

            e.Property(p => p.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(p => p.RejectReason).HasColumnName("reject_reason");

            e.Property(p => p.CreatedBy).HasColumnName("created_by");
            e.Property(p => p.CreatedByRole).HasColumnName("created_by_role").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(p => p.ApprovedByL1).HasColumnName("approved_by_l1");
            e.Property(p => p.ApprovedByGa).HasColumnName("approved_by_ga");
            e.Property(p => p.ApprovedByApprovalGa).HasColumnName("approved_by_approval_ga");

            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.ApprovedL1At).HasColumnName("approved_l1_at");
            e.Property(p => p.ApprovedGaAt).HasColumnName("approved_ga_at");
            e.Property(p => p.ApprovedApprovalGaAt).HasColumnName("approved_approval_ga_at");

            e.HasOne(p => p.Pembuat)
                .WithMany()
                .HasForeignKey(p => p.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(p => p.Status).HasDatabaseName("ix_perbaikan_sarana_status");
            e.HasIndex(p => p.Divisi).HasDatabaseName("ix_perbaikan_sarana_divisi");
            e.HasIndex(p => p.Departemen).HasDatabaseName("ix_perbaikan_sarana_departemen");
            e.HasIndex(p => p.Tanggal).HasDatabaseName("ix_perbaikan_sarana_tanggal");
        });

        modelBuilder.Entity<PerbaikanSaranaLog>(e =>
        {
            e.ToTable("perbaikan_sarana_logs");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).HasColumnName("id");
            e.Property(l => l.PerbaikanSaranaId).HasColumnName("perbaikan_sarana_id");
            e.Property(l => l.Action).HasColumnName("action").HasMaxLength(50).IsRequired();
            e.Property(l => l.ActorId).HasColumnName("actor_id");
            e.Property(l => l.Reason).HasColumnName("reason");
            e.Property(l => l.CreatedAt).HasColumnName("created_at");

            e.HasOne(l => l.PerbaikanSarana)
                .WithMany(p => p.Logs)
                .HasForeignKey(l => l.PerbaikanSaranaId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(l => l.Aktor)
                .WithMany()
                .HasForeignKey(l => l.ActorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SaranaCounter>(e =>
        {
            e.ToTable("sarana_counters");
            e.HasKey(c => new { c.Divisi, c.Year, c.Month });
            e.Property(c => c.Divisi).HasColumnName("divisi").HasMaxLength(255);
            e.Property(c => c.Year).HasColumnName("year");
            e.Property(c => c.Month).HasColumnName("month");
            e.Property(c => c.LastSequence).HasColumnName("last_sequence");
        });

        modelBuilder.Entity<PerbaikanSaranaChatMessage>(e =>
        {
            e.ToTable("perbaikan_sarana_chat_messages");
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasColumnName("id");
            e.Property(m => m.PerbaikanSaranaId).HasColumnName("perbaikan_sarana_id");
            e.Property(m => m.SenderId).HasColumnName("sender_id");
            e.Property(m => m.Message).HasColumnName("message").IsRequired();
            e.Property(m => m.CreatedAt).HasColumnName("created_at");

            e.HasOne(m => m.PerbaikanSarana)
                .WithMany()
                .HasForeignKey(m => m.PerbaikanSaranaId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PerbaikanSaranaChatRead>(e =>
        {
            e.ToTable("perbaikan_sarana_chat_reads");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id");
            e.Property(r => r.PerbaikanSaranaId).HasColumnName("perbaikan_sarana_id");
            e.Property(r => r.UserId).HasColumnName("user_id");
            e.Property(r => r.LastReadAt).HasColumnName("last_read_at");
            e.HasIndex(r => new { r.PerbaikanSaranaId, r.UserId }).IsUnique();

            e.HasOne(r => r.PerbaikanSarana)
                .WithMany()
                .HasForeignKey(r => r.PerbaikanSaranaId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ArchiveDocument>(e =>
        {
            e.ToTable("archive_documents");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasColumnName("id");
            e.Property(a => a.NamaDokumen).HasColumnName("nama_dokumen").HasMaxLength(255).IsRequired();
            e.Property(a => a.Kategori).HasColumnName("kategori").HasConversion<string>().HasMaxLength(50).IsRequired();
            e.Property(a => a.FilePath).HasColumnName("file_path").HasMaxLength(255).IsRequired();
            e.Property(a => a.OriginalFilename).HasColumnName("original_filename").HasMaxLength(255).IsRequired();
            e.Property(a => a.ContentType).HasColumnName("content_type").HasMaxLength(150).IsRequired();
            e.Property(a => a.FileSizeBytes).HasColumnName("file_size_bytes");
            e.Property(a => a.Catatan).HasColumnName("catatan");

            e.Property(a => a.Divisi).HasColumnName("divisi").HasMaxLength(255).IsRequired();
            e.Property(a => a.Departemen).HasColumnName("departemen").HasMaxLength(255);

            e.Property(a => a.UploadedBy).HasColumnName("uploaded_by");
            e.Property(a => a.UploadedByRole).HasColumnName("uploaded_by_role").HasConversion<string>().HasMaxLength(50).IsRequired();

            e.Property(a => a.CreatedAt).HasColumnName("created_at");
            e.Property(a => a.UpdatedAt).HasColumnName("updated_at");

            e.HasOne(a => a.Pengunggah)
                .WithMany()
                .HasForeignKey(a => a.UploadedBy)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(a => a.Kategori).HasDatabaseName("ix_archive_documents_kategori");
            e.HasIndex(a => a.Divisi).HasDatabaseName("ix_archive_documents_divisi");
            e.HasIndex(a => a.Departemen).HasDatabaseName("ix_archive_documents_departemen");
            e.HasIndex(a => a.CreatedAt).HasDatabaseName("ix_archive_documents_created_at");
        });

        modelBuilder.Entity<DivisiCounter>(e =>
        {
            e.ToTable("divisi_counters");
            e.HasKey(c => new { c.Divisi, c.Year, c.Month });
            e.Property(c => c.Divisi).HasColumnName("divisi").HasMaxLength(255);
            e.Property(c => c.Year).HasColumnName("year");
            e.Property(c => c.Month).HasColumnName("month");
            e.Property(c => c.LastSequence).HasColumnName("last_sequence");
        });

        modelBuilder.Entity<Invoice>(e =>
        {
            e.ToTable("invoices");
            e.HasKey(i => i.Id);
            e.Property(i => i.Id).HasColumnName("id");
            e.Property(i => i.Bulan).HasColumnName("bulan").HasMaxLength(7).IsRequired();
            e.Property(i => i.FilePath).HasColumnName("file_path").HasMaxLength(500).IsRequired();
            e.Property(i => i.OriginalFilename).HasColumnName("original_filename").HasMaxLength(255).IsRequired();
            // Same race guard as Pengiriman.Status above, for ApproveInvoice/RejectInvoice.
            e.Property(i => i.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired().IsConcurrencyToken();
            e.Property(i => i.Catatan).HasColumnName("catatan");

            e.Property(i => i.UploadedBy).HasColumnName("uploaded_by");
            e.Property(i => i.ReviewedBy).HasColumnName("reviewed_by");

            e.Property(i => i.UploadedAt).HasColumnName("uploaded_at");
            e.Property(i => i.ReviewedAt).HasColumnName("reviewed_at");

            e.HasOne(i => i.Pengunggah)
                .WithMany()
                .HasForeignKey(i => i.UploadedBy)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(i => i.Peninjau)
                .WithMany()
                .HasForeignKey(i => i.ReviewedBy)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<InvoiceLog>(e =>
        {
            e.ToTable("invoice_logs");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).HasColumnName("id");
            e.Property(l => l.InvoiceId).HasColumnName("invoice_id");
            e.Property(l => l.Action).HasColumnName("action").HasMaxLength(50).IsRequired();
            e.Property(l => l.ActorId).HasColumnName("actor_id");
            e.Property(l => l.Reason).HasColumnName("reason");
            e.Property(l => l.FilePath).HasColumnName("file_path").HasMaxLength(500);
            e.Property(l => l.OriginalFilename).HasColumnName("original_filename").HasMaxLength(255);
            e.Property(l => l.CreatedAt).HasColumnName("created_at");

            e.HasOne(l => l.Invoice)
                .WithMany(i => i.Logs)
                .HasForeignKey(l => l.InvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(l => l.Aktor)
                .WithMany()
                .HasForeignKey(l => l.ActorId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
