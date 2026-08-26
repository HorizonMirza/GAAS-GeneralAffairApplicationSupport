namespace PengirimanApi.Models;

public class BookingKendaraan
{
    public int Id { get; set; }
    public string? NomorPemesanan { get; set; }
    public string Keperluan { get; set; } = null!;
    public string? Pic { get; set; }
    public string NamaKendaraan { get; set; } = null!;
    public string? PlatNomor { get; set; }
    public int KapasitasKendaraan { get; set; }
    public string? Supir { get; set; }
    public string? Tujuan { get; set; }
    public int JumlahPenumpang { get; set; }
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }
    public string? Catatan { get; set; }

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
    public ICollection<BookingKendaraanLog> Logs { get; set; } = new List<BookingKendaraanLog>();
}
