namespace PengirimanApi.Models;

// Archive: permintaan divisi/departemen untuk memindahkan arsip yang sudah tidak dipakai dari
// status aktif (dipegang divisi/departemen sendiri) ke inaktif (dipegang Admin/Approval GA).
// Satu permintaan berisi banyak arsip (lihat PermintaanArsipItem). Alur approval-nya sama dengan
// Room/Vehicle Booking dan Permintaan ATK (BookingStatusEnum, berakhir di APPROVED_GA_APPROVAL -
// begitu final disetujui, arsipnya dianggap resmi berpindah ke inaktif/dipegang GA) - tanpa tahap
// KPU seperti Pengiriman, dan reject adalah dead end, tidak ada revisi-dan-kirim-ulang.
public class PermintaanArsip
{
    public int Id { get; set; }
    public string? NomorArsip { get; set; }
    public DateOnly Tanggal { get; set; }
    public string Keperluan { get; set; } = null!;
    public string LokasiPenyimpanan { get; set; } = null!;
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
    public ICollection<PermintaanArsipItem> Items { get; set; } = new List<PermintaanArsipItem>();
    public ICollection<PermintaanArsipLog> Logs { get; set; } = new List<PermintaanArsipLog>();
}
