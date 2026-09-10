namespace PengirimanApi.Models;

// Maintenance: laporan kerusakan sarana/prasarana yang butuh perbaikan oleh GA. Alur approval-nya
// sama dengan Room/Vehicle Booking dan Permintaan ATK (BookingStatusEnum, berakhir di
// APPROVED_GA_APPROVAL) - tanpa tahap KPU seperti Pengiriman. Setelah disetujui final, eksekusi
// fisiknya sendiri dilacak lewat ExecutionStage (lihat ExecutionStageEnum) - berjalan terpisah
// dari Status, yang tetap APPROVED_GA_APPROVAL sepanjang eksekusi berlangsung.
public class PerbaikanSarana
{
    public int Id { get; set; }
    public string? NomorPerbaikan { get; set; }
    public DateOnly Tanggal { get; set; }
    public string Lokasi { get; set; } = null!;
    public KategoriKerusakanEnum Kategori { get; set; }
    public UrgensiEnum Urgensi { get; set; }
    public string DeskripsiKerusakan { get; set; } = null!;
    public string? Catatan { get; set; }
    public string NamaPelapor { get; set; } = null!;
    public string NoTeleponPelapor { get; set; } = null!;

    // Foto kondisi kerusakan - diunggah pelapor sendiri (opsional) supaya approver/GA bisa menilai
    // tanpa perlu cek lokasi fisik dulu. Terpisah dari GambarFilePath di bawah, yang justru foto
    // rencana perbaikan buatan GA setelah disetujui final.
    public string? FotoKerusakanFilePath { get; set; }
    public string? FotoKerusakanOriginalFilename { get; set; }
    public string? FotoKerusakanContentType { get; set; }

    public string Divisi { get; set; } = null!;
    public string? Departemen { get; set; }

    public BookingStatusEnum Status { get; set; } = BookingStatusEnum.DRAFT;
    public string? RejectReason { get; set; }

    public int CreatedBy { get; set; }
    public RoleEnum CreatedByRole { get; set; }
    public int? ApprovedByL1 { get; set; }
    public int? ApprovedByGa { get; set; }
    public int? ApprovedByApprovalGa { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ApprovedL1At { get; set; }
    public DateTime? ApprovedGaAt { get; set; }
    public DateTime? ApprovedApprovalGaAt { get; set; }

    public ExecutionStageEnum ExecutionStage { get; set; } = ExecutionStageEnum.MENUNGGU;
    public int? LokasiDicekBy { get; set; }
    public DateTime? LokasiDicekAt { get; set; }
    public int? GambarDibuatBy { get; set; }
    public DateTime? GambarDibuatAt { get; set; }
    public string? GambarFilePath { get; set; }
    public string? GambarOriginalFilename { get; set; }
    public string? GambarContentType { get; set; }
    public int? SelesaiBy { get; set; }
    public DateTime? SelesaiAt { get; set; }

    // Foto bukti hasil perbaikan (opsional) - diunggah bersamaan dengan menandai Eksekusi selesai,
    // supaya ada dokumentasi before/after (FotoKerusakan di atas = before, ini = after).
    public string? FotoSelesaiFilePath { get; set; }
    public string? FotoSelesaiOriginalFilename { get; set; }
    public string? FotoSelesaiContentType { get; set; }

    public User Pembuat { get; set; } = null!;
    public ICollection<PerbaikanSaranaLog> Logs { get; set; } = new List<PerbaikanSaranaLog>();
}
