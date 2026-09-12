using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class PermintaanArsipCreate
{
    // Admin/Approval GA only: lets them request on behalf of any divisi/departemen instead of
    // their own GA home unit (see PermintaanArsipController.EffectiveOwner) - ignored for every
    // other role, and ignored for GA too when left blank.
    public string? Divisi { get; set; }
    public string? Departemen { get; set; }
    public DateOnly Tanggal { get; set; }
    public int JumlahArsip { get; set; }
    public string NamaArsip { get; set; } = null!;
    public ArchiveKategoriEnum Kategori { get; set; }
    public string TahunArsip { get; set; } = null!;
    public string LokasiPenyimpanan { get; set; } = null!;
    public string NamaPic { get; set; } = null!;
    public string NoTeleponPic { get; set; } = null!;
    public string? Catatan { get; set; }
}

public record KoreksiArsipRequest(string LokasiPenyimpanan, string NamaPic, string NoTeleponPic, string? Catatan);

public record PermintaanArsipLogOut(
    int Id,
    string Action,
    string? ActorNama,
    RoleEnum? ActorRole,
    string? Reason,
    DateTime CreatedAt
);

public class PermintaanArsipOut
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
    public BookingStatusEnum Status { get; set; }
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
    public int UnreadChatCount { get; set; }
    public bool HasUnreadMention { get; set; }

    public static PermintaanArsipOut From(PermintaanArsip p) => new()
    {
        Id = p.Id,
        NomorArsip = p.NomorArsip,
        Tanggal = p.Tanggal,
        JumlahArsip = p.JumlahArsip,
        NamaArsip = p.NamaArsip,
        Kategori = p.Kategori,
        TahunArsip = p.TahunArsip,
        LokasiPenyimpanan = p.LokasiPenyimpanan,
        NamaPic = p.NamaPic,
        NoTeleponPic = p.NoTeleponPic,
        Catatan = p.Catatan,
        Divisi = p.Divisi,
        Departemen = p.Departemen,
        Status = p.Status,
        RejectReason = p.RejectReason,
        CreatedBy = p.CreatedBy,
        CreatedByRole = p.CreatedByRole,
        ApprovedByL1 = p.ApprovedByL1,
        ApprovedByGa = p.ApprovedByGa,
        ApprovedByApprovalGa = p.ApprovedByApprovalGa,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        ApprovedL1At = p.ApprovedL1At,
        ApprovedGaAt = p.ApprovedGaAt,
        ApprovedApprovalGaAt = p.ApprovedApprovalGaAt,
    };
}

public class PermintaanArsipListResponse
{
    public List<PermintaanArsipOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}

public class PermintaanArsipStatsResponse
{
    public Dictionary<string, int> CountsByStatus { get; set; } = new();
}

public record PermintaanArsipCatalogItemOut(
    int Id,
    string? NomorArsip,
    DateOnly Tanggal,
    int JumlahArsip,
    string NamaArsip,
    ArchiveKategoriEnum Kategori,
    string TahunArsip,
    string LokasiPenyimpanan,
    string? NamaPic,
    string? NoTeleponPic,
    string Divisi,
    string? Departemen,
    string? Catatan,
    DateTime? ApprovedApprovalGaAt
);

public class PermintaanArsipCatalogResponse
{
    public List<PermintaanArsipCatalogItemOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}
