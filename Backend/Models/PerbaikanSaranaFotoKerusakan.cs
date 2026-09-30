namespace PengirimanApi.Models;

// Foto kondisi kerusakan (before) - wajib minimal 1, maksimal 5 per laporan, diunggah pelapor
// sendiri lewat form Draft supaya approver/GA bisa menilai tanpa perlu cek lokasi fisik dulu.
// Tabel terpisah (bukan kolom tunggal di PerbaikanSarana) karena satu laporan sekarang bisa
// membawa lebih dari satu foto.
public class PerbaikanSaranaFotoKerusakan
{
    public int Id { get; set; }
    public int PerbaikanSaranaId { get; set; }
    public string FilePath { get; set; } = null!;
    public string OriginalFilename { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public PerbaikanSarana PerbaikanSarana { get; set; } = null!;
}
