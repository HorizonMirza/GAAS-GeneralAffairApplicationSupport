using PengirimanApi.Data;
using PengirimanApi.Models;

namespace PengirimanApi.Services;

public class CurrentUserService
{
    private readonly IHttpContextAccessor _accessor;
    private readonly JwtService _jwt;
    private readonly AppDbContext _db;

    public const string CookieName = "access_token";

    public CurrentUserService(IHttpContextAccessor accessor, JwtService jwt, AppDbContext db)
    {
        _accessor = accessor;
        _jwt = jwt;
        _db = db;
    }

    public async Task<User?> GetCurrentUserAsync()
    {
        var ctx = _accessor.HttpContext;
        if (ctx == null) return null;

        string? token = ctx.Request.Cookies[CookieName];
        if (string.IsNullOrEmpty(token)) return null;

        var principal = _jwt.Validate(token);
        if (principal == null) return null;

        var subClaim = principal.FindFirst("sub")?.Value;
        if (subClaim == null || !int.TryParse(subClaim, out var userId)) return null;

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return null;

        // Reject a token minted before the account's most recent password change (see
        // User.PasswordChangedAt / JwtService.CreateAccessToken) - this is what makes changing
        // the password actually sign out every other session instead of leaving them valid until
        // they naturally expire. No PasswordChangedAt on the account yet (password never changed
        // since this column existed) means there's nothing to compare against, so any token is
        // accepted as before.
        if (user.PasswordChangedAt.HasValue)
        {
            var pwdAtClaim = principal.FindFirst("pwd_at")?.Value;
            if (pwdAtClaim == null || !long.TryParse(pwdAtClaim, out var pwdAtTicks) || pwdAtTicks != user.PasswordChangedAt.Value.Ticks)
                return null;
        }

        return user;
    }
}
