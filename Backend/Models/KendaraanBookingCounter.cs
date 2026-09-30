namespace PengirimanApi.Models;

// Keyed by Divisi + Year + Month, same shape as RoomBookingCounter - a separate table so Vehicle
// Booking's Nomor Pemesanan sequence never interleaves with Room Booking's.
public class KendaraanBookingCounter
{
    public string Divisi { get; set; } = null!;
    public int Year { get; set; }
    public int Month { get; set; }
    public int LastSequence { get; set; }
}
