namespace PengirimanApi.Models;

// Super Admin's own hard-delete of an item normally leaves nothing behind: the item's *_logs
// table is cascade-deleted right along with it (see AppDbContext's OnDelete(DeleteBehavior.
// Cascade) on every *_logs FK), so a moment later there is no trace it ever existed. This table
// is deliberately NOT FK'd to any of the seven business tables it records - that's the whole
// point, it has to survive the very row (and its cascade-linked logs) it describes.
//
// DeletedByNama is a snapshot, not just a join through DeletedById - mirrors the "renaming/
// deactivating doesn't rewrite history" principle used elsewhere in this feature (see
// OrgAdminController's rename endpoints), so this stays readable even once the acting admin's
// account is later renamed or deactivated.
public class DeletionLog
{
    public int Id { get; set; }
    // One of RiwayatAktivitasController.Sources' seven keys ("ekspedisi", "booking-ruang", ...).
    public string Modul { get; set; } = null!;
    public int ItemId { get; set; }
    public string? ItemNomor { get; set; }
    public int? DeletedBy { get; set; }
    public string DeletedByNama { get; set; } = null!;
    // Bulk delete only - a short human-readable description of the filters that were applied
    // ("Status: Approved, Bulan: 2026-09"). Null for a single-item delete.
    public string? FilterSummary { get; set; }
    public DateTime CreatedAt { get; set; }

    public User? Aktor { get; set; }
}
