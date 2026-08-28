namespace PengirimanApi.Models;

// Office Supplies: satu permintaan ATK berisi banyak barang (lihat PermintaanAtkItem). Alur
// approval-nya persis Room/Vehicle Booking (BookingStatusEnum, berakhir di
// APPROVED_GA_APPROVAL) - tanpa tahap KPU seperti Pengiriman.
public class PermintaanAtk
{
    public int Id { get; set; }
    public string? NomorPermintaan { get; set; }
    public DateOnly Tanggal { get; set; }
    public string Keperluan { get; set; } = null!;
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
    public ICollection<PermintaanAtkItem> Items { get; set; } = new List<PermintaanAtkItem>();
    public ICollection<PermintaanAtkLog> Logs { get; set; } = new List<PermintaanAtkLog>();
}
