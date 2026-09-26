using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public record LoginRequest(string Username, string Password);

// MustChangePassword lets the frontend redirect straight to the forced change-password screen
// instead of the dashboard - the session/JWT is still issued normally either way (see
// AuthController.Login), the account really is logged in, it just can't do anything else yet.
public record LoginResponse(string Message, string Role, bool MustChangePassword);

// Set only while a Super Admin's "Login As" session is active on this cookie (see
// UsersAdminController.Impersonate/EndImpersonation) - identifies the real Super Admin behind the
// current session, purely so AppShell can render the "kembali ke Super Admin" banner. Never shown
// to, or derivable by, the impersonated account itself in any other way.
public record ImpersonatedByOut(int Id, string Nama);

public record MeResponse(
    int Id,
    string Username,
    string Nama,
    RoleEnum Role,
    string? Direktorat,
    string? Divisi,
    string? Departemen,
    string? NoHp,
    string? Email,
    bool HasPhoto,
    bool HasCoverPhoto,
    string? CoverPreset,
    // Also surfaced here (not just Login's own response) so a page reload while the flag is still
    // set - the person closed the tab mid-forced-change, say - keeps enforcing the screen instead
    // of only checking it once, right after login.
    bool MustChangePassword,
    ImpersonatedByOut? ImpersonatedBy = null
)
{
    public static MeResponse From(User user, ImpersonatedByOut? impersonatedBy = null) => new(
        user.Id,
        user.Username,
        user.Nama,
        user.Role,
        user.Direktorat,
        user.Divisi,
        user.Departemen,
        user.NoHp,
        user.Email,
        user.PhotoPath != null,
        user.CoverPhotoPath != null,
        user.CoverPreset,
        user.MustChangePassword,
        impersonatedBy
    );
}

public record DivisiOut(string Nama, List<string> Departemen);

public record DirektoratOut(string Nama, List<DivisiOut> Divisi);

public record OrgStructureResponse(
    List<string> Direktorat,
    List<string> Divisi,
    List<string> Departemen,
    List<DirektoratOut> DirektoratTree
);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record UpdateProfileRequest(string Nama, string Username, string? NoHp, string? Email, string? CurrentPassword);

public record UpdateCoverPresetRequest(string Preset);
