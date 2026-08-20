namespace PengirimanApi.Models;

// Keyed by Divisi + Year + Month, same shape as DivisiCounter (Ekspedisi) - a separate table so
// the two modules' sequences don't interleave, but the same per-divisi-per-month scoping.
public class RoomBookingCounter
{
    public string Divisi { get; set; } = null!;
    public int Year { get; set; }
    public int Month { get; set; }
    public int LastSequence { get; set; }
}
