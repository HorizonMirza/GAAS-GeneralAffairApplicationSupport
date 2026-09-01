using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class PerbaikanSaranaCreate
{
    public DateOnly Tanggal { get; set; }
    public string Lokasi { get; set; } = null!;
    public KategoriKerusakanEnum Kategori { get; set; }
    public UrgensiEnum Urgensi { get; set; }
    public string DeskripsiKerusakan { get; set; } = null!;
    public string? Catatan { get; set; }
}

public record PerbaikanSaranaLogOut(
    int Id,
    string Action,
    string? ActorNama,
    RoleEnum? ActorRole,
    string? Reason,
    DateTime CreatedAt
);

public class PerbaikanSaranaOut
{
    public int Id { get; set; }
    public string? NomorPerbaikan { get; set; }
    public DateOnly Tanggal { get; set; }
    public string Lokasi { get; set; } = null!;
    public KategoriKerusakanEnum Kategori { get; set; }
    public UrgensiEnum Urgensi { get; set; }
    public string DeskripsiKerusakan { get; set; } = null!;
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
    public ExecutionStageEnum ExecutionStage { get; set; }
    public int? LokasiDicekBy { get; set; }
    public DateTime? LokasiDicekAt { get; set; }
    public int? GambarDibuatBy { get; set; }
    public DateTime? GambarDibuatAt { get; set; }
    public string? GambarOriginalFilename { get; set; }
    public int? SelesaiBy { get; set; }
    public DateTime? SelesaiAt { get; set; }
    public int UnreadChatCount { get; set; }
    public bool HasUnreadMention { get; set; }

    public static PerbaikanSaranaOut From(PerbaikanSarana p) => new()
    {
        Id = p.Id,
        NomorPerbaikan = p.NomorPerbaikan,
        Tanggal = p.Tanggal,
        Lokasi = p.Lokasi,
        Kategori = p.Kategori,
        Urgensi = p.Urgensi,
        DeskripsiKerusakan = p.DeskripsiKerusakan,
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
        ExecutionStage = p.ExecutionStage,
        LokasiDicekBy = p.LokasiDicekBy,
        LokasiDicekAt = p.LokasiDicekAt,
        GambarDibuatBy = p.GambarDibuatBy,
        GambarDibuatAt = p.GambarDibuatAt,
        GambarOriginalFilename = p.GambarOriginalFilename,
        SelesaiBy = p.SelesaiBy,
        SelesaiAt = p.SelesaiAt,
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
    // Maintenance-specific: how many still-open (belum selesai final) reports are marked TINGGI,
    // surfaced as its own Overview tile so urgent damage doesn't get lost in the status counts.
    public int UrgensiTinggiAktif { get; set; }
}
