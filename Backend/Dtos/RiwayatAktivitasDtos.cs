namespace PengirimanApi.Dtos;

// One row of the cross-module activity log. Every module already records who did what and when in
// its own *_logs table, but each one is only readable through {itemId}/logs - so "what did this
// person do last week" or "who cancelled those bookings" could not be answered from the app at
// all, only by querying the database by hand. This is the shape those seven tables are unioned
// into for Super Admin's central view.
public class RiwayatAktivitasOut
{
    // Which module the row came from - "ekspedisi", "booking-ruang", "booking-kendaraan",
    // "permintaan-atk", "perbaikan-sarana", "permintaan-arsip", "invoice".
    public string Modul { get; set; } = null!;
    // The parent record's own id, so the UI can deep-link into the module's detail view.
    public int ItemId { get; set; }
    // The parent's human-readable number (Nomor Transmittal / Pemesanan / Permintaan / ...), or
    // the invoice's Bulan. Null for a record that never got one (an unsubmitted draft).
    public string? Nomor { get; set; }
    public string Action { get; set; } = null!;
    public string? Reason { get; set; }
    public int? ActorId { get; set; }
    public string? ActorNama { get; set; }
    public string? ActorRole { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class RiwayatAktivitasListOut
{
    public List<RiwayatAktivitasOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}

// Distinct actors that appear anywhere in the seven log tables - drives the "Pelaku" filter
// dropdown without making the client load all 134 accounts just to populate it.
public class RiwayatAktorOut
{
    public int Id { get; set; }
    public string Nama { get; set; } = null!;
    public string Role { get; set; } = null!;
}
