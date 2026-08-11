namespace PengirimanApi.Models;

public class Pengiriman
{
    public int Id { get; set; }
    public string? NoResi { get; set; }
    public DateOnly Tanggal { get; set; }
    public string TujuanPenerimaan { get; set; } = null!;
    public int JumlahItem { get; set; }
    public string NamaPengirim { get; set; } = null!;
    public string NoTeleponPengirim { get; set; } = null!;
    public string AlamatPengirim { get; set; } = null!;
    public string Divisi { get; set; } = null!;
    public string? Departemen { get; set; }
    public string NomorTransmittal { get; set; } = null!;
    public string KodeProgram { get; set; } = null!;
    public string NamaPenerima { get; set; } = null!;
    public string AlamatPenerima { get; set; } = null!;
    public string NoTeleponPenerima { get; set; } = null!;
    public AsuransiEnum AsuransiStatus { get; set; }
    public string RequestPacking { get; set; } = null!;
    public string? Catatan { get; set; }

    public decimal? BeratBarangKg { get; set; }
    public decimal? AsuransiHarga { get; set; }
    public decimal? SubTotal { get; set; }
    public decimal? Total { get; set; }

    public StatusEnum Status { get; set; } = StatusEnum.SUBMITTED;
    public string? RejectReason { get; set; }
    public RejectTargetEnum? RejectTarget { get; set; }

    public int CreatedBy { get; set; }
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
    public ICollection<PengirimanLog> Logs { get; set; } = new List<PengirimanLog>();
}
