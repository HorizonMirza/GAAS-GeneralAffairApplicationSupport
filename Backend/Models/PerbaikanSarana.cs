namespace PengirimanApi.Models;

// Maintenance: laporan kerusakan sarana/prasarana yang butuh perbaikan oleh GA. Alur approval-nya
// sama dengan Room/Vehicle Booking (BookingStatusEnum, berakhir di APPROVED_GA_APPROVAL) - tanpa
// tahap KPU. Permintaan ATK bukan anggota kelompok ini: modul itu memakai StatusEnum dan punya
// tahap KPU sendiri.
public class PerbaikanSarana
{
    public int Id { get; set; }
    public string? NomorPerbaikan { get; set; }
    public DateOnly Tanggal { get; set; }
    public string Lokasi { get; set; } = null!;
    public string Kategori { get; set; } = null!;
    public string DeskripsiKerusakan { get; set; } = null!;
    public string? Catatan { get; set; }
    public string NamaPelapor { get; set; } = null!;
    public string NoTeleponPelapor { get; set; } = null!;

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

    // Kolom fitur Eksekusi (Cek Lokasi -> Buat Gambar -> Selesai) yang sudah dihapus dari aplikasi.
    // Tetap dipetakan karena kolomnya masih ada di database dan menyimpan data/file lama -
    // PembersihFileYatim dan Delete masih membaca path filenya supaya file lama tidak yatim.
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

    public string? FotoSelesaiFilePath { get; set; }
    public string? FotoSelesaiOriginalFilename { get; set; }
    public string? FotoSelesaiContentType { get; set; }

    public User Pembuat { get; set; } = null!;
    public ICollection<PerbaikanSaranaLog> Logs { get; set; } = new List<PerbaikanSaranaLog>();
    // Wajib minimal 1, maksimal 5 - lihat PerbaikanSaranaFotoKerusakan.
    public ICollection<PerbaikanSaranaFotoKerusakan> FotoKerusakan { get; set; } = new List<PerbaikanSaranaFotoKerusakan>();
}
