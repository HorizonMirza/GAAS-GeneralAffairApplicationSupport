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

    public ProfileController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
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
        await _db.SaveChangesAsync();
        return Ok(new { message = "Password berhasil diubah" });
    }
}
