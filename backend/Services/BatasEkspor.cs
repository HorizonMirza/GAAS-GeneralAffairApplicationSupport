using System.Globalization;

namespace PengirimanApi.Services;

// Excel and PDF exports are built entirely in memory - every row is materialised, handed to
// ClosedXML/QuestPDF as an object model, then copied again into a byte[] before being sent. A
// measured 5.000-row Excel export peaked at ~1,1 GB of process memory to produce a 348 KB file,
// roughly 150 KB of RAM per row. On a 1-2 GB app server that means somewhere around 8.000-10.000
// rows the whole backend runs out of memory and dies - taking down every other user's session
// with it, not just the export.
//
// Nothing stops that today: a Transaksi page with no filter set exports the entire history, and
// it only takes one person clicking Download in year three. So refuse early, with a message that
// tells the user what to do about it, instead of letting the process fall over.
public static class BatasEkspor
{
    public const int MaksBaris = 5000;

    // The message is shown to the user as-is (downloadFile reads `detail` off the 400 and toasts
    // it), so the thousands separator has to be the Indonesian "." and not the invariant ",".
    private static readonly CultureInfo Indonesia = new("id-ID");

    public static void Pastikan(int jumlahBaris)
    {
        if (jumlahBaris <= MaksBaris) return;
        throw new ArgumentException(
            $"Data terlalu banyak untuk diekspor ({jumlahBaris.ToString("N0", Indonesia)} baris, " +
            $"maksimal {MaksBaris.ToString("N0", Indonesia)}). Persempit filter terlebih dahulu - " +
            "misalnya pilih Filter Periode satu bulan, atau saring berdasarkan status, divisi, " +
            "atau departemen.");
    }
}
