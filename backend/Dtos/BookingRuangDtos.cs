using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class BookingRuangCreate
{
    public string NamaKegiatan { get; set; } = null!;
    public string? Pic { get; set; }
    // Admin/Approval GA only: lets them book on behalf of any divisi/departemen instead of their
    // own home unit (see BookingRuangController.OriginRoles) - ignored for every other role, and
    // ignored for GA too when left blank (falls back to their own GA home unit as before).
    public string? Divisi { get; set; }
    public string? Departemen { get; set; }
    public string NamaRuang { get; set; } = null!;
    // Extra rooms reserved alongside NamaRuang for the same event - optional, empty/null for the
    // common single-room case.
    public List<string>? AdditionalRooms { get; set; }
    public int JumlahPeserta { get; set; }
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }
    public string? Catatan { get; set; }
    public TipeBookingEnum Tipe { get; set; } = TipeBookingEnum.INTERNAL;

    // When true (with Frequency/EndDate both set), Create() generates one occurrence per computed
    // date instead of a single booking - see BookingRuangController.BuildOccurrenceDates.
    public bool IsRecurring { get; set; }
    public RecurrenceFrequencyEnum? RecurrenceFrequency { get; set; }
    public DateOnly? RecurrenceEndDate { get; set; }
}

// Deliberately narrower than BookingRuangCreate - Admin/Approval GA use this to resolve a
// room/time conflict on someone else's booking, so it only exposes the fields that actually
// define the slot. Everything else (NamaKegiatan, Pic, JumlahPeserta, Catatan) stays the
// origin creator's own and is untouched by a reschedule.
public class BookingRuangReschedule
{
    public string NamaRuang { get; set; } = null!;
    public List<string>? AdditionalRooms { get; set; }
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }
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
    public string? NomorPemesanan { get; set; }
    public string NamaKegiatan { get; set; } = null!;
    public string? Pic { get; set; }
    public string NamaRuang { get; set; } = null!;
    public List<string> AdditionalRooms { get; set; } = new();
    public int KapasitasRuang { get; set; }
    public int JumlahPeserta { get; set; }
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }
    public string? Catatan { get; set; }
    public string Divisi { get; set; } = null!;
    public string? Departemen { get; set; }
    public TipeBookingEnum Tipe { get; set; }
    public Guid? SeriesId { get; set; }
    public RecurrenceFrequencyEnum? RecurrenceFrequency { get; set; }
    public DateOnly? RecurrenceEndDate { get; set; }
    public bool HasConflict { get; set; }
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
    public int UnreadChatCount { get; set; }
    public bool HasUnreadMention { get; set; }

    public static BookingRuangOut From(BookingRuang b) => new()
    {
        Id = b.Id,
        NomorPemesanan = b.NomorPemesanan,
        NamaKegiatan = b.NamaKegiatan,
        Pic = b.Pic,
        NamaRuang = b.NamaRuang,
        AdditionalRooms = b.AdditionalRooms.Select(r => r.NamaRuang).ToList(),
        KapasitasRuang = b.KapasitasRuang,
        JumlahPeserta = b.JumlahPeserta,
        Tanggal = b.Tanggal,
        IsWholeDay = b.IsWholeDay,
        JamMulai = b.JamMulai,
        JamSelesai = b.JamSelesai,
        Catatan = b.Catatan,
        Divisi = b.Divisi,
        Departemen = b.Departemen,
        Tipe = b.Tipe,
        SeriesId = b.SeriesId,
        RecurrenceFrequency = b.RecurrenceFrequency,
        RecurrenceEndDate = b.RecurrenceEndDate,
        HasConflict = b.HasConflict,
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

public class BookingRuangStatsResponse
{
    public Dictionary<string, int> CountsByStatus { get; set; } = new();
}
