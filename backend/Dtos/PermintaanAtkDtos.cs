using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class PermintaanAtkItemCreate
{
    public string NamaBarang { get; set; } = null!;
    public int Jumlah { get; set; }
    public string Satuan { get; set; } = null!;
}

public class PermintaanAtkCreate
{
    public DateOnly Tanggal { get; set; }
    public string Keperluan { get; set; } = null!;
    public string? Catatan { get; set; }
    public List<PermintaanAtkItemCreate> Items { get; set; } = new();
}

public record PermintaanAtkItemOut(int Id, string NamaBarang, int Jumlah, string Satuan);

public record PermintaanAtkLogOut(
    int Id,
    string Action,
    string? ActorNama,
    RoleEnum? ActorRole,
    string? Reason,
    DateTime CreatedAt
);

public class PermintaanAtkOut
{
    public int Id { get; set; }
    public string? NomorPermintaan { get; set; }
    public DateOnly Tanggal { get; set; }
    public string Keperluan { get; set; } = null!;
    public string? Catatan { get; set; }
    public List<PermintaanAtkItemOut> Items { get; set; } = new();
    public string Divisi { get; set; } = null!;
    public string? Departemen { get; set; }
    public StatusEnum Status { get; set; }
    public string? RejectReason { get; set; }
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
    public int UnreadChatCount { get; set; }
    public bool HasUnreadMention { get; set; }

    // Callers must have loaded/included p.Items before mapping (see PermintaanAtkController's
    // Include(p => p.Items) call sites) - EF lazy loading is not enabled in this project.
    public static PermintaanAtkOut From(PermintaanAtk p) => new()
    {
        Id = p.Id,
        NomorPermintaan = p.NomorPermintaan,
        Tanggal = p.Tanggal,
        Keperluan = p.Keperluan,
        Catatan = p.Catatan,
        Items = p.Items
            .OrderBy(i => i.Id)
            .Select(i => new PermintaanAtkItemOut(i.Id, i.NamaBarang, i.Jumlah, i.Satuan))
            .ToList(),
        Divisi = p.Divisi,
        Departemen = p.Departemen,
        Status = p.Status,
        RejectReason = p.RejectReason,
        SumberPembelian = p.SumberPembelian,
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

public class PermintaanAtkListResponse
{
    public List<PermintaanAtkOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}

public class PermintaanAtkStatsResponse
{
    public Dictionary<string, int> CountsByStatus { get; set; } = new();
}

// SumberPembelian is required here (not just optional) - Admin GA is the one who actually
// executes procurement, so their own approval is the point where the purchase channel has to be
// pinned down (see PermintaanAtkController.ApproveGa).
public record ApproveGaAtkRequest(SumberPembelianEnum? SumberPembelian);

// Only relevant when Submit's self-skip logic (see PermintaanAtkController.Submit) lands the
// item straight at APPROVED_GA or APPROVED_GA_APPROVAL - an Admin/Approval GA submitting their
// own draft skips past the normal ApproveGa/ApproveGaApproval endpoints entirely, so this is the
// only place left to still capture SumberPembelian for that path.
public record SubmitAtkRequest(SumberPembelianEnum? SumberPembelian);
