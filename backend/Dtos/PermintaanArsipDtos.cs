using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class PermintaanArsipItemCreate
{
    public string NamaArsip { get; set; } = null!;
    public ArchiveKategoriEnum Kategori { get; set; }
    public string TahunArsip { get; set; } = null!;
    public int Jumlah { get; set; }
    public string Satuan { get; set; } = null!;
}

public class PermintaanArsipCreate
{
    public DateOnly Tanggal { get; set; }
    public string Keperluan { get; set; } = null!;
    public string LokasiPenyimpanan { get; set; } = null!;
    public string? Catatan { get; set; }
    public List<PermintaanArsipItemCreate> Items { get; set; } = new();
}

public record PermintaanArsipItemOut(int Id, string NamaArsip, ArchiveKategoriEnum Kategori, string TahunArsip, int Jumlah, string Satuan);

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
    public string Keperluan { get; set; } = null!;
    public string LokasiPenyimpanan { get; set; } = null!;
    public string? Catatan { get; set; }
    public List<PermintaanArsipItemOut> Items { get; set; } = new();
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

    // Callers must have loaded/included p.Items before mapping (see PermintaanArsipController's
    // Include(p => p.Items) call sites) - EF lazy loading is not enabled in this project.
    public static PermintaanArsipOut From(PermintaanArsip p) => new()
    {
        Id = p.Id,
        NomorArsip = p.NomorArsip,
        Tanggal = p.Tanggal,
        Keperluan = p.Keperluan,
        LokasiPenyimpanan = p.LokasiPenyimpanan,
        Catatan = p.Catatan,
        Items = p.Items
            .OrderBy(i => i.Id)
            .Select(i => new PermintaanArsipItemOut(i.Id, i.NamaArsip, i.Kategori, i.TahunArsip, i.Jumlah, i.Satuan))
            .ToList(),
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

// Aggregate breakdown for the Report page - scoped to a single calendar year (the requester's
// own visibility rules still apply, same as List/Stats) so the trend/breakdown numbers only ever
// describe one year at a time instead of the dataset's entire lifetime.
public class PermintaanArsipReportResponse
{
    public int Year { get; set; }
    public int TotalPermintaan { get; set; }
    // Sum of Item.Jumlah across every item belonging to a request that has finished the full
    // approval chain (APPROVED_GA_APPROVAL) - "how many archive units actually changed hands to
    // GA this year", as opposed to TotalPermintaan which counts tickets regardless of outcome.
    public int TotalArsipDipindahkan { get; set; }
    public Dictionary<string, int> CountByStatus { get; set; } = new();
    public Dictionary<string, int> JumlahByKategori { get; set; } = new();
    public Dictionary<string, int> CountByDivisi { get; set; } = new();
    // 12 entries, index 0 = January, permintaan count per month within Year.
    public List<int> CountByMonth { get; set; } = new();
}

public record PermintaanArsipCatalogItemOut(
    int Id,
    string NamaArsip,
    ArchiveKategoriEnum Kategori,
    string TahunArsip,
    int Jumlah,
    string Satuan,
    string? NomorArsip,
    string LokasiPenyimpanan,
    string Divisi,
    string? Departemen,
    DateTime? ApprovedApprovalGaAt
);

public class PermintaanArsipCatalogResponse
{
    public List<PermintaanArsipCatalogItemOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}
