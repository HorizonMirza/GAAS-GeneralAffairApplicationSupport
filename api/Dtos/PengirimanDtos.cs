using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class PengirimanCreate
{
    public DateOnly Tanggal { get; set; }
    public string TujuanPenerimaan { get; set; } = null!;
    public int JumlahItem { get; set; }
    public string NamaPengirim { get; set; } = null!;
    public string NoTeleponPengirim { get; set; } = null!;
    public string AlamatPengirim { get; set; } = null!;
    public string KodeProgram { get; set; } = null!;
    public string NamaPenerima { get; set; } = null!;
    public string AlamatPenerima { get; set; } = null!;
    public string NoTeleponPenerima { get; set; } = null!;
    public AsuransiEnum AsuransiStatus { get; set; }
    public string RequestPacking { get; set; } = null!;
    public string? Catatan { get; set; }
}

public class ApproveKpuRequest
{
    public string NoResi { get; set; } = null!;
    public decimal BeratBarangKg { get; set; }
    public decimal AsuransiHarga { get; set; }
    public decimal SubTotal { get; set; }
    public decimal Total { get; set; }
}

public record RejectRequest(string? Reason);

public record RejectWithTargetRequest(string? Reason, RejectTargetEnum Target);

public record PengirimanLogOut(
    int Id,
    string Action,
    string? ActorNama,
    RoleEnum? ActorRole,
    string? Reason,
    DateTime CreatedAt
);

public class PengirimanOut
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
    public StatusEnum Status { get; set; }
    public string? RejectReason { get; set; }
    public RejectTargetEnum? RejectTarget { get; set; }
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
    public bool HasUnreadChat { get; set; }

    public static PengirimanOut From(Pengiriman p) => new()
    {
        Id = p.Id,
        NoResi = p.NoResi,
        Tanggal = p.Tanggal,
        TujuanPenerimaan = p.TujuanPenerimaan,
        JumlahItem = p.JumlahItem,
        NamaPengirim = p.NamaPengirim,
        NoTeleponPengirim = p.NoTeleponPengirim,
        AlamatPengirim = p.AlamatPengirim,
        Divisi = p.Divisi,
        Departemen = p.Departemen,
        NomorTransmittal = p.NomorTransmittal,
        KodeProgram = p.KodeProgram,
        NamaPenerima = p.NamaPenerima,
        AlamatPenerima = p.AlamatPenerima,
        NoTeleponPenerima = p.NoTeleponPenerima,
        AsuransiStatus = p.AsuransiStatus,
        RequestPacking = p.RequestPacking,
        Catatan = p.Catatan,
        BeratBarangKg = p.BeratBarangKg,
        AsuransiHarga = p.AsuransiHarga,
        SubTotal = p.SubTotal,
        Total = p.Total,
        Status = p.Status,
        RejectReason = p.RejectReason,
        RejectTarget = p.RejectTarget,
        CreatedBy = p.CreatedBy,
        CreatedByRole = p.CreatedByRole,
        ApprovedByL1 = p.ApprovedByL1,
        ApprovedByGa = p.ApprovedByGa,
        ApprovedByApprovalGa = p.ApprovedByApprovalGa,
        ApprovedByKpu = p.ApprovedByKpu,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        ApprovedL1At = p.ApprovedL1At,
        ApprovedGaAt = p.ApprovedGaAt,
        ApprovedApprovalGaAt = p.ApprovedApprovalGaAt,
        ApprovedKpuAt = p.ApprovedKpuAt,
    };
}

public class PengirimanListResponse
{
    public List<PengirimanOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
    public decimal? TotalBulanIni { get; set; }
}
