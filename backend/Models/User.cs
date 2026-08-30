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
    public DateTime CreatedAt { get; set; }
    // Set whenever the password changes (ProfileController.ChangePassword). Stamped into every
    // freshly issued JWT (JwtService.CreateAccessToken) and checked against the token's copy on
    // every request (CurrentUserService) - a token minted before the most recent change no longer
    // matches and is rejected, so changing the password actually revokes every session issued
    // with the old one instead of leaving them valid until they naturally expire.
    public DateTime? PasswordChangedAt { get; set; }

    public ICollection<Pengiriman> PengirimanDibuat { get; set; } = new List<Pengiriman>();
}
