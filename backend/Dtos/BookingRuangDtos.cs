using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class BookingRuangCreate
{
    public string NamaKegiatan { get; set; } = null!;
    public string NamaRuang { get; set; } = null!;
    public int JumlahPeserta { get; set; }
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }
    public string? Catatan { get; set; }
}

public record BookingRuangLogOut(
    int Id,
    string Action,
    string? ActorNama,
    RoleEnum? ActorRole,
    string? Reason,
    DateTime CreatedAt
);

public class BookingRuangOut
{
    public int Id { get; set; }
    public string NamaKegiatan { get; set; } = null!;
    public string NamaRuang { get; set; } = null!;
    public int KapasitasRuang { get; set; }
    public int JumlahPeserta { get; set; }
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }
    public string? Catatan { get; set; }
    public string Divisi { get; set; } = null!;
    public string? Departemen { get; set; }
    public BookingStatusEnum Status { get; set; }
    public string? RejectReason { get; set; }
    public RejectTargetEnum? RejectTarget { get; set; }
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

    public static BookingRuangOut From(BookingRuang b) => new()
    {
        Id = b.Id,
        NamaKegiatan = b.NamaKegiatan,
        NamaRuang = b.NamaRuang,
        KapasitasRuang = b.KapasitasRuang,
        JumlahPeserta = b.JumlahPeserta,
        Tanggal = b.Tanggal,
        IsWholeDay = b.IsWholeDay,
        JamMulai = b.JamMulai,
        JamSelesai = b.JamSelesai,
        Catatan = b.Catatan,
        Divisi = b.Divisi,
        Departemen = b.Departemen,
        Status = b.Status,
        RejectReason = b.RejectReason,
        RejectTarget = b.RejectTarget,
        CreatedBy = b.CreatedBy,
        CreatedByRole = b.CreatedByRole,
        ApprovedByL1 = b.ApprovedByL1,
        ApprovedByGa = b.ApprovedByGa,
        ApprovedByApprovalGa = b.ApprovedByApprovalGa,
        CreatedAt = b.CreatedAt,
        UpdatedAt = b.UpdatedAt,
        ApprovedL1At = b.ApprovedL1At,
        ApprovedGaAt = b.ApprovedGaAt,
        ApprovedApprovalGaAt = b.ApprovedApprovalGaAt,
    };
}

public class BookingRuangListResponse
{
    public List<BookingRuangOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}
