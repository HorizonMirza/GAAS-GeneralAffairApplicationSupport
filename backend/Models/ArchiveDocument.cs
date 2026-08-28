namespace PengirimanApi.Models;

// Archive: penyimpanan dokumen umum perusahaan (SOP, surat, kontrak, dll) - berbeda dari modul
// lain di aplikasi ini, tidak ada alur approval sama sekali. Begitu diunggah, dokumen langsung
// tersimpan dan bisa dilihat/diunduh oleh siapa saja (kecuali KPU, yang memang tidak melihat
// modul ini - lihat AppShell.KPU_HIDDEN_CATEGORIES), tidak dibatasi per divisi/departemen seperti
// data transaksional lainnya.
public class ArchiveDocument
{
    public int Id { get; set; }
    public string NamaDokumen { get; set; } = null!;
    public ArchiveKategoriEnum Kategori { get; set; }
    public string FilePath { get; set; } = null!;
    public string OriginalFilename { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long FileSizeBytes { get; set; }
    public string? Catatan { get; set; }

    // Unit pengunggah - informasional/untuk filter saja, bukan pembatas akses (lihat komentar di
    // atas: dokumen arsip terlihat oleh semua unit).
    public string Divisi { get; set; } = null!;
    public string? Departemen { get; set; }

    public int UploadedBy { get; set; }
    public RoleEnum UploadedByRole { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User Pengunggah { get; set; } = null!;
}
