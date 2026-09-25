namespace PengirimanApi.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string Nama { get; set; } = null!;
    public RoleEnum Role { get; set; }
    public string? Direktorat { get; set; }
    public string? Divisi { get; set; }
    public string? Departemen { get; set; }
    public string? NoHp { get; set; }
    public string? Email { get; set; }
    // Profile photo, stored the same way as PerbaikanSarana's Gambar (filename on disk under
    // ProfileController's upload dir, plus the metadata needed to serve it back correctly).
    public string? PhotoPath { get; set; }
    public string? PhotoContentType { get; set; }
    public string? PhotoOriginalFilename { get; set; }
    // Profile hero banner background - either an uploaded image (CoverPhotoPath, stored the same
    // way as PhotoPath) or a named preset gradient (CoverPreset, matching a key in the frontend's
    // COVER_PRESETS list). An uploaded photo always takes visual priority over the preset when set.
    public string? CoverPhotoPath { get; set; }
    public string? CoverPhotoContentType { get; set; }
    public string? CoverPhotoOriginalFilename { get; set; }
    public string? CoverPreset { get; set; }
    public DateTime CreatedAt { get; set; }
    // Set whenever the password changes (ProfileController.ChangePassword). Stamped into every
    // freshly issued JWT (JwtService.CreateAccessToken) and checked against the token's copy on
    // every request (CurrentUserService) - a token minted before the most recent change no longer
    // matches and is rejected, so changing the password actually revokes every session issued
    // with the old one instead of leaving them valid until they naturally expire.
    public DateTime? PasswordChangedAt { get; set; }
    // Deactivating (UsersAdminController.Deactivate/Activate) is the only way Super Admin ever
    // removes an account - every module's *_logs FK to users.Id with OnDelete(Restrict), so a
    // real DELETE would either throw or orphan history. Login rejects a deactivated account
    // outright (see AuthController.Login) rather than letting it sign in and hiding it some other
    // way, so a deactivated account can never do anything again, without losing its history.
    public bool IsActive { get; set; } = true;
    // Set on account creation (UsersAdminController.Create) and password reset (ResetPassword) -
    // the account can still log in normally with the generated password, but the frontend blocks
    // every other page behind a forced change-password screen until this clears (see
    // ProfileController.ChangePassword, which is the one place it's cleared again). Directly
    // replaces DbSeeder's old shared DefaultPassword "123456789" as the answer to "how does an
    // account ever get off the default password" - Super Admin can now roll a real one per account.
    public bool MustChangePassword { get; set; }

    public ICollection<Pengiriman> PengirimanDibuat { get; set; } = new List<Pengiriman>();
}
