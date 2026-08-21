namespace PengirimanApi.Models;

public class BookingRuang
{
    public int Id { get; set; }
    public string? NomorPemesanan { get; set; }
    public string NamaKegiatan { get; set; } = null!;
    public string? Pic { get; set; }
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

    public TipeBookingEnum Tipe { get; set; } = TipeBookingEnum.INTERNAL;

    // Set only when this booking is one occurrence of a recurring series (see
    // BookingRuangController.BuildOccurrenceDates) - every occurrence shares the same SeriesId,
    // and only carries its own Tanggal/NomorPemesanan; everything else about the series is
    // applied identically to every member by the approval endpoints. Null for a normal,
    // non-recurring booking.
    public Guid? SeriesId { get; set; }
    public RecurrenceFrequencyEnum? RecurrenceFrequency { get; set; }
    public DateOnly? RecurrenceEndDate { get; set; }

    // True when this booking's room+slot currently collides with another already-Approved
    // booking - set (non-blocking) when a series occurrence is created or submitted, and at
    // final Approval GA confirmation for both series and non-series bookings. Only Admin/Approval
    // GA's Reschedule tool can clear it (by moving the booking somewhere free).
    public bool HasConflict { get; set; }

    public BookingStatusEnum Status { get; set; } = BookingStatusEnum.DRAFT;
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

    public User Pembuat { get; set; } = null!;
    public ICollection<BookingRuangLog> Logs { get; set; } = new List<BookingRuangLog>();
    public ICollection<BookingRuangRoom> AdditionalRooms { get; set; } = new List<BookingRuangRoom>();
}
