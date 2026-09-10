using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class PerbaikanSaranaCreate
{
    // Admin/Approval GA only: lets them request on behalf of any divisi/departemen instead of
    // their own GA home unit (see PerbaikanSaranaController.EffectiveOwner) - ignored for every
    // other role, and ignored for GA too when left blank.
    public string? Divisi { get; set; }
    public string? Departemen { get; set; }
    public DateOnly Tanggal { get; set; }
    public string Lokasi { get; set; } = null!;
    public KategoriKerusakanEnum Kategori { get; set; }
    public string DeskripsiKerusakan { get; set; } = null!;
    public string? Catatan { get; set; }
    public string NamaPelapor { get; set; } = null!;
    public string NoTeleponPelapor { get; set; } = null!;
}

public record PerbaikanSaranaLogOut(
    int Id,
    string Action,
    string? ActorNama,
    RoleEnum? ActorRole,
    string? Reason,
    DateTime CreatedAt
);

public record PerbaikanSaranaFotoKerusakanOut(int Id, string OriginalFilename);

public class PerbaikanSaranaOut
{
    public int Id { get; set; }
    public string? NomorPerbaikan { get; set; }
    public DateOnly Tanggal { get; set; }
    public string Lokasi { get; set; } = null!;
    public KategoriKerusakanEnum Kategori { get; set; }
    public string DeskripsiKerusakan { get; set; } = null!;
    public string? Catatan { get; set; }
    public string NamaPelapor { get; set; } = null!;
    public string NoTeleponPelapor { get; set; } = null!;
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
    public ExecutionStageEnum ExecutionStage { get; set; }
    public int? LokasiDicekBy { get; set; }
    public DateTime? LokasiDicekAt { get; set; }
    public int? GambarDibuatBy { get; set; }
    public DateTime? GambarDibuatAt { get; set; }
    public string? GambarOriginalFilename { get; set; }
    public int? SelesaiBy { get; set; }
    public DateTime? SelesaiAt { get; set; }
    public string? FotoSelesaiOriginalFilename { get; set; }
    public int UnreadChatCount { get; set; }
    public bool HasUnreadMention { get; set; }

    public static PerbaikanSaranaOut From(PerbaikanSarana p) => new()
    {
        Id = p.Id,
        NomorPerbaikan = p.NomorPerbaikan,
        Tanggal = p.Tanggal,
        Lokasi = p.Lokasi,
        Kategori = p.Kategori,
        DeskripsiKerusakan = p.DeskripsiKerusakan,
        Catatan = p.Catatan,
        NamaPelapor = p.NamaPelapor,
        NoTeleponPelapor = p.NoTeleponPelapor,
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
        ExecutionStage = p.ExecutionStage,
        LokasiDicekBy = p.LokasiDicekBy,
        LokasiDicekAt = p.LokasiDicekAt,
        GambarDibuatBy = p.GambarDibuatBy,
        GambarDibuatAt = p.GambarDibuatAt,
        GambarOriginalFilename = p.GambarOriginalFilename,
        SelesaiBy = p.SelesaiBy,
        SelesaiAt = p.SelesaiAt,
        FotoSelesaiOriginalFilename = p.FotoSelesaiOriginalFilename,
    };
}

// Catatan opsional untuk tahap cek lokasi/eksekusi - upload gambar punya request-nya sendiri
// ([FromForm], lihat PerbaikanSaranaController.UploadGambar) karena membawa file, bukan JSON.
public record ExecutionStageRequest(string? Catatan);

public class PerbaikanSaranaListResponse
{
    public List<PerbaikanSaranaOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}

public class PerbaikanSaranaStatsResponse
{
    public Dictionary<string, int> CountsByStatus { get; set; } = new();
    // Breakdown of ExecutionStage across only the Approved-final reports, so GA can see its
    // physical-execution workload (how many awaiting a site check, how many mid-plan, etc.)
    // without having to open and manually count the Transaksi table.
    public Dictionary<string, int> ExecutionStageCounts { get; set; } = new();
}
