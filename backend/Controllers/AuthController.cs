using Microsoft.AspNetCore.Mvc;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[ApiController]
[Route("api")]
public class AuthController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtService _jwt;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext db, JwtService jwt, CurrentUserService currentUser, IConfiguration config)
        : base(currentUser)
    {
        _db = db;
        _jwt = jwt;
        _config = config;
    }

    [HttpPost("auth/login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest payload)
    {
        var user = _db.Users.FirstOrDefault(u => u.Username == payload.Username);
        if (user == null || !BCrypt.Net.BCrypt.Verify(payload.Password, user.PasswordHash))
            return StatusCode(401, new { detail = "Username atau password salah" });

        var token = _jwt.CreateAccessToken(user.Id, user.Role);
        var cookieSecure = _config.GetValue<bool>("CookieSecure");

        Response.Cookies.Append(CurrentUserService.CookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = cookieSecure,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromMinutes(_jwt.ExpireMinutes),
            Path = "/",
        });

        return Ok(new { message = "Login berhasil", role = user.Role.ToString(), access_token = token });
    }

    [HttpPost("auth/logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete(CurrentUserService.CookieName, new CookieOptions { Path = "/" });
        return Ok(new { message = "Logout berhasil" });
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
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

    [HttpGet("org-structure")]
    public async Task<IActionResult> GetOrgStructure()
    {
        var (_, error) = await RequireRoleAsync();
        if (error != null) return error;

        var tree = OrgTree.Tree.Select(d => new DirektoratOut(
            d.Nama,
            d.Divisi.Select(v => new DivisiOut(v.Nama, v.Departemen.Select(dep => dep.Nama).ToList())).ToList()
        )).ToList();

        return Ok(new OrgStructureResponse(OrgTree.AllDirektorat, OrgTree.AllDivisi, OrgTree.AllDepartemen, tree));
    }
}
