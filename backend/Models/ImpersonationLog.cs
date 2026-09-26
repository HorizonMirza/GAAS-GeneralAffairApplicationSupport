namespace PengirimanApi.Models;

// Session-level record of Super Admin's "Login As" feature (UsersAdminController.Impersonate/
// EndImpersonation) - deliberately separate from every business table's own CreatedBy/ApprovedBy
// etc., which keep recording the impersonated account's own id exactly as if that account had
// logged in itself (see Impersonate's own comment for why). This table exists purely so Super
// Admin can look back at who used "Login As" on which account and when - nobody else can see it,
// and it never influences any approval/scoping/ownership check anywhere else in the app.
//
// SuperAdminNama/TargetNama/TargetRole are snapshots, not just joins through the two FKs - mirrors
// DeletionLog's own DeletedByNama, so this stays readable even once either account is later
// renamed, deactivated, or has its role changed.
public class ImpersonationLog
{
    public int Id { get; set; }
    public int SuperAdminId { get; set; }
    public string SuperAdminNama { get; set; } = null!;
    public int TargetUserId { get; set; }
    public string TargetNama { get; set; } = null!;
    public RoleEnum TargetRole { get; set; }
    public DateTime StartedAt { get; set; }
    // Null while the session is still active - EndImpersonation stamps it.
    public DateTime? EndedAt { get; set; }

    public User? SuperAdmin { get; set; }
    public User? TargetUser { get; set; }
}
