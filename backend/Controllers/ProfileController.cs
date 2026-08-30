using Microsoft.AspNetCore.Mvc;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[ApiController]
[Route("api/profile")]
public class ProfileController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;
    private readonly IConfiguration _config;

    public ProfileController(AppDbContext db, CurrentUserService currentUser, JwtService jwt, IConfiguration config) : base(currentUser)
    {
        _db = db;
        _jwt = jwt;
        _config = config;
    }

    [HttpGet("")]
    public async Task<IActionResult> GetProfile()
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        return Ok(new MeResponse(
            user!.Id,
            user.Username,
            user.Nama,
            user.Role,
            user.Direktorat,
            user.Divisi,
            user.Departemen
        ));
    }

    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest payload)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (!BCrypt.Net.BCrypt.Verify(payload.CurrentPassword, user!.PasswordHash))
            return StatusCode(400, new { detail = "Password saat ini salah" });

        if (string.IsNullOrEmpty(payload.NewPassword) || payload.NewPassword.Length < 8)
            return StatusCode(400, new { detail = "Password baru minimal 8 karakter" });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(payload.NewPassword);
        user.PasswordChangedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Every OTHER session's token was minted before PasswordChangedAt above and stops
        // matching it on their next request (see CurrentUserService), signing them out - but that
        // check would also sign out this very request's own session the moment it's over, since
        // its token predates the change too. Re-issuing the cookie here with a freshly minted
        // token (carrying the new PasswordChangedAt) keeps the session that just changed the
        // password logged in, exactly like AuthController.Login does after a fresh login.
        var token = _jwt.CreateAccessToken(user.Id, user.Role, user.PasswordChangedAt);
        var cookieSecure = _config.GetValue<bool>("CookieSecure");
        Response.Cookies.Append(CurrentUserService.CookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = cookieSecure,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromMinutes(_jwt.ExpireMinutes),
            Path = "/",
        });

        return Ok(new { message = "Password berhasil diubah" });
    }
}
