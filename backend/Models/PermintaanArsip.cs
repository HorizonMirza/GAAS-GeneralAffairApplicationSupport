namespace PengirimanApi.Models;

// Archive: permintaan divisi/departemen untuk memindahkan arsip yang sudah tidak dipakai dari
// status aktif (dipegang divisi/departemen sendiri) ke inaktif (dipegang Admin/Approval GA).
// Satu permintaan = satu arsip (dulu satu permintaan bisa berisi banyak arsip lewat
// PermintaanArsipItem - dihapus, field arsipnya sekarang langsung di sini). Alur approval-nya
// sama dengan Room/Vehicle Booking dan Permintaan ATK (BookingStatusEnum, berakhir di
// APPROVED_GA_APPROVAL - begitu final disetujui, arsipnya dianggap resmi berpindah ke
// inaktif/dipegang GA) - tanpa tahap KPU seperti Pengiriman, dan reject adalah dead end, tidak
// ada revisi-dan-kirim-ulang.
public class PermintaanArsip
{
    public int Id { get; set; }
    public string? NomorArsip { get; set; }
    public DateOnly Tanggal { get; set; }
    public int JumlahArsip { get; set; }
    public string NamaArsip { get; set; } = null!;
    public ArchiveKategoriEnum Kategori { get; set; }
    public string TahunArsip { get; set; } = null!;
    public string LokasiPenyimpanan { get; set; } = null!;
    public string? NamaPic { get; set; }
    public string? NoTeleponPic { get; set; }
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
    public ICollection<PermintaanArsipLog> Logs { get; set; } = new List<PermintaanArsipLog>();
}
