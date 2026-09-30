namespace PengirimanApi.Models;

// Keyed by Divisi + Year + Month, same shape as RoomBookingCounter/KendaraanBookingCounter - a
// separate table so Nomor Permintaan ATK never interleaves with the booking sequences.
public class AtkCounter
{
    public string Divisi { get; set; } = null!;
    public int Year { get; set; }
    public int Month { get; set; }
    public int LastSequence { get; set; }
}
