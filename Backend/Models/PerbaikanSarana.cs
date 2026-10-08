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

    public User Pembuat { get; set; } = null!;
    public ICollection<PerbaikanSaranaLog> Logs { get; set; } = new List<PerbaikanSaranaLog>();
    // Wajib minimal 1, maksimal 5 - lihat PerbaikanSaranaFotoKerusakan.
    public ICollection<PerbaikanSaranaFotoKerusakan> FotoKerusakan { get; set; } = new List<PerbaikanSaranaFotoKerusakan>();
}
