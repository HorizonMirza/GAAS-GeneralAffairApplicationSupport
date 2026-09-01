namespace PengirimanApi.Models;

// Office Supplies: satu permintaan ATK berisi banyak barang (lihat PermintaanAtkItem). Alur
// approval-nya sama seperti Pengiriman (StatusEnum, ada tahap KPU karena Admin GA/Approval GA
// membeli lewat KPU atau lewat PaDi eksternal - lihat SumberPembelian) - tapi reject tetap dead
// end seperti Room/Vehicle Booking, tidak ada revisi-dan-kirim-ulang.
public class PermintaanAtk
{
    public int Id { get; set; }
    public string? NomorPermintaan { get; set; }
    public DateOnly Tanggal { get; set; }
    public string Keperluan { get; set; } = null!;
    public string? Catatan { get; set; }

    public string Divisi { get; set; } = null!;
    public string? Departemen { get; set; }

    public StatusEnum Status { get; set; } = StatusEnum.DRAFT;
    public string? RejectReason { get; set; }
    // Dipilih Admin GA/Approval GA saat approve di tier mereka sendiri (lihat
    // PermintaanAtkController.ApproveGa/Submit) - null sampai salah satu tier itu terlewati.
    public SumberPembelianEnum? SumberPembelian { get; set; }

    public int CreatedBy { get; set; }
    public RoleEnum CreatedByRole { get; set; }
    public int? ApprovedByL1 { get; set; }
    public int? ApprovedByGa { get; set; }
    public int? ApprovedByApprovalGa { get; set; }
    public int? ApprovedByKpu { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ApprovedL1At { get; set; }
    public DateTime? ApprovedGaAt { get; set; }
    public DateTime? ApprovedApprovalGaAt { get; set; }
    public DateTime? ApprovedKpuAt { get; set; }

    public User Pembuat { get; set; } = null!;
    public ICollection<PermintaanAtkItem> Items { get; set; } = new List<PermintaanAtkItem>();
    public ICollection<PermintaanAtkLog> Logs { get; set; } = new List<PermintaanAtkLog>();
}
