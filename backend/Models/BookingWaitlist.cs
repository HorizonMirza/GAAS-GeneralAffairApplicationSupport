namespace PengirimanApi.Models;

// A user's request to be notified when a room+date(+time) slot frees up - either joined by hand
// (Ketersediaan grid shows "Penuh") or auto-created for the loser of an auto-reject-competitor
// race (see BookingRuangController.ApproveGaApproval). NotifiedAt is set once, when the slot is
// actually freed (BookingRuangController.Delete/Reschedule of an APPROVED_GA_APPROVAL booking);
// the row is only removed when the user dismisses it (BookingWaitlistController.Leave).
public class BookingWaitlist
{
    public int Id { get; set; }
    public string NamaRuang { get; set; } = null!;
    public DateOnly Tanggal { get; set; }
    public bool IsWholeDay { get; set; }
    public TimeOnly? JamMulai { get; set; }
    public TimeOnly? JamSelesai { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? NotifiedAt { get; set; }
}
