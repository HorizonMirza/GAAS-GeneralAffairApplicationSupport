namespace PengirimanApi.Models;

// Keyed by Divisi + Year + Month, same shape as AtkCounter/SaranaCounter - a separate table so
// Nomor Arsip never interleaves with the other modules' number sequences.
public class ArsipCounter
{
    public string Divisi { get; set; } = null!;
    public int Year { get; set; }
    public int Month { get; set; }
    public int LastSequence { get; set; }
}
