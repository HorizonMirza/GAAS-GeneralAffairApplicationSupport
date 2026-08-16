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
        if (string.IsNullOrEmpty(token))
        {
            var authHeader = ctx.Request.Headers.Authorization.ToString();
            if (authHeader.StartsWith("Bearer "))
                token = authHeader["Bearer ".Length..];
        }
        if (string.IsNullOrEmpty(token)) return null;

        var principal = _jwt.Validate(token);
        if (principal == null) return null;

        var subClaim = principal.FindFirst("sub")?.Value;
        if (subClaim == null || !int.TryParse(subClaim, out var userId)) return null;

        return await _db.Users.FindAsync(userId);
    }
}
