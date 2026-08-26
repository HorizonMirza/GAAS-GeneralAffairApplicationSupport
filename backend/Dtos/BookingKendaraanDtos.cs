using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class BookingKendaraanCreate
{
    public string Keperluan { get; set; } = null!;
    public string? Pic { get; set; }
    // Admin/Approval GA only: lets them book on behalf of any divisi/departemen instead of their
    // own home unit (see BookingKendaraanController.OriginRoles) - ignored for every other role,
    // and ignored for GA too when left blank (falls back to their own GA home unit as before).
    public string? Divisi { get; set; }
    public string? Departemen { get; set; }
    public string NamaKendaraan { get; set; } = null!;
    public string? Tujuan { get; set; }
    public int JumlahPenumpang { get; set; }
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }
    public string? Catatan { get; set; }
}

// Deliberately narrower than BookingKendaraanCreate - Admin/Approval GA use this to resolve a
// vehicle/time conflict on someone else's booking, so it only exposes the fields that actually
// define the slot. Everything else (Keperluan, Pic, JumlahPenumpang, Catatan) stays the origin
// creator's own and is untouched by a reschedule.
public class BookingKendaraanReschedule
{
    public string NamaKendaraan { get; set; } = null!;
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }
}

public record BookingKendaraanLogOut(
    int Id,
    string Action,
    string? ActorNama,
    RoleEnum? ActorRole,
    string? Reason,
    DateTime CreatedAt
);

public class BookingKendaraanOut
{
    public int Id { get; set; }
    public string? NomorPemesanan { get; set; }
    public string Keperluan { get; set; } = null!;
    public string? Pic { get; set; }
    public string NamaKendaraan { get; set; } = null!;
    public string? PlatNomor { get; set; }
    public int KapasitasKendaraan { get; set; }
    public string? Supir { get; set; }
    public string? Tujuan { get; set; }
    public int JumlahPenumpang { get; set; }
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }
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

    public static BookingKendaraanOut From(BookingKendaraan b) => new()
    {
        Id = b.Id,
        NomorPemesanan = b.NomorPemesanan,
        Keperluan = b.Keperluan,
        Pic = b.Pic,
        NamaKendaraan = b.NamaKendaraan,
        PlatNomor = b.PlatNomor,
        KapasitasKendaraan = b.KapasitasKendaraan,
        Supir = b.Supir,
        Tujuan = b.Tujuan,
        JumlahPenumpang = b.JumlahPenumpang,
        Tanggal = b.Tanggal,
        IsWholeDay = b.IsWholeDay,
        JamMulai = b.JamMulai,
        JamSelesai = b.JamSelesai,
        Catatan = b.Catatan,
        Divisi = b.Divisi,
        Departemen = b.Departemen,
        Status = b.Status,
        RejectReason = b.RejectReason,
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

public class BookingKendaraanListResponse
{
    public List<BookingKendaraanOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}

public class BookingKendaraanStatsResponse
{
    public Dictionary<string, int> CountsByStatus { get; set; } = new();
}
