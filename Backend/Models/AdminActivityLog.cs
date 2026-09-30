namespace PengirimanApi.Models;

// Every module already writes who-did-what-when for its own transactions (see the seven *_logs
// tables RiwayatAktivitasController unions together) and DeletionLog covers hard-deletes, but
// every OTHER Super Admin write - user account changes, org structure edits, Master Data CRUD,
// app-wide branding/hours/holiday changes - left no trace at all beyond the row's current value
// in the database. This table closes that gap the same way DeletionLog does: one row per action,
// with the actor snapshotted by name (not just by id) so it stays readable even after that
// account is renamed or deactivated. Surfaced as RiwayatAktivitasController's 9th source ("admin").
public class AdminActivityLog
{
    public int Id { get; set; }
    public int? ActorId { get; set; }
    public string ActorNama { get; set; } = null!;
    // A short fixed code, e.g. "USER_CREATE", "ORG_DIVISI_RENAME", "APP_SETTINGS_UPDATE" - see
    // each controller's LogAdminActivity call sites for the full vocabulary.
    public string Action { get; set; } = null!;
    // Human-readable summary of what changed ("Buat akun John Doe (ADMIN_GA)") - this table has
    // no single business row to join back to for context, so the description has to carry it.
    public string Deskripsi { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public User? Aktor { get; set; }
}
