namespace PengirimanApi.Models;

// Keyed by Divisi + Year + Month, same shape as the other module counters - a separate table so
// Nomor Perbaikan never interleaves with the booking/ATK sequences.
public class SaranaCounter
{
    public string Divisi { get; set; } = null!;
    public int Year { get; set; }
    public int Month { get; set; }
    public int LastSequence { get; set; }
}
