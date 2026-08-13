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

            e.Property(p => p.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(50).IsRequired();
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
            e.Property(i => i.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();
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
