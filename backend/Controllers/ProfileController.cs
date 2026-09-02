using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Services;
using System.Net.Mime;

namespace PengirimanApi.Controllers;

[ApiController]
[Route("api/profile")]
public class ProfileController : ApiControllerBase
{
    // Only real image formats, same allowlist as PerbaikanSarana's Gambar upload.
    private static readonly Dictionary<string, string> AllowedPhotoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
    };
    private const long MaxPhotoFileSizeBytes = 5 * 1024 * 1024; // 5 MB

    private readonly AppDbContext _db;
    private readonly JwtService _jwt;
    private readonly IConfiguration _config;
    private readonly string _uploadDir;

    public ProfileController(AppDbContext db, CurrentUserService currentUser, JwtService jwt, IConfiguration config) : base(currentUser)
    {
        _db = db;
        _jwt = jwt;
        _config = config;
        var configured = config.GetValue<string>("ProfilePhotoUploadDir") ?? "uploads/profile-photos";
        _uploadDir = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(AppContext.BaseDirectory, "..", "..", "..", configured);
        _uploadDir = Path.GetFullPath(_uploadDir);
        Directory.CreateDirectory(_uploadDir);
    }

    [HttpGet("")]
    public async Task<IActionResult> GetProfile()
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        return Ok(MeResponse.From(user!));
    }

    [HttpPut("")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest payload)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var nama = payload.Nama?.Trim() ?? "";
        var username = payload.Username?.Trim() ?? "";
        if (nama.Length == 0)
            return StatusCode(400, new { detail = "Nama akun wajib diisi" });
        if (username.Length == 0)
            return StatusCode(400, new { detail = "Username wajib diisi" });

        var usernameTaken = await _db.Users.AnyAsync(u => u.Id != user!.Id && u.Username == username);
        if (usernameTaken)
            return StatusCode(400, new { detail = "Username sudah dipakai akun lain" });

        user!.Nama = nama;
        user.Username = username;
        user.NoHp = string.IsNullOrWhiteSpace(payload.NoHp) ? null : payload.NoHp.Trim();
        user.Email = string.IsNullOrWhiteSpace(payload.Email) ? null : payload.Email.Trim();
        await _db.SaveChangesAsync();

        return Ok(MeResponse.From(user));
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

    [HttpPost("photo")]
    public async Task<IActionResult> UploadPhoto([FromForm] IFormFile? file)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (file == null || file.Length == 0)
            return StatusCode(400, new { detail = "Foto wajib diunggah" });
        if (file.Length > MaxPhotoFileSizeBytes)
            return StatusCode(400, new { detail = $"Ukuran file maksimal {MaxPhotoFileSizeBytes / 1024 / 1024} MB" });
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext) || !AllowedPhotoExtensions.TryGetValue(ext, out var contentType))
            return StatusCode(400, new { detail = "Format foto tidak didukung. Gunakan JPG atau PNG." });

        var storedFilename = $"{Guid.NewGuid():N}{ext}";
        var destPath = Path.Combine(_uploadDir, storedFilename);
        using (var stream = System.IO.File.Create(destPath))
        {
            await file.CopyToAsync(stream);
        }

        // The old file on disk is now orphaned once the row points at the new one - clean it up so
        // uploads don't accumulate forever, but only after the new file is safely written above.
        var oldPath = user!.PhotoPath != null ? Path.Combine(_uploadDir, user.PhotoPath) : null;

        user.PhotoPath = storedFilename;
        user.PhotoContentType = contentType;
        user.PhotoOriginalFilename = string.IsNullOrEmpty(file.FileName) ? storedFilename : file.FileName;
        await _db.SaveChangesAsync();

        if (oldPath != null && System.IO.File.Exists(oldPath))
            System.IO.File.Delete(oldPath);

        return Ok(MeResponse.From(user));
    }

    [HttpGet("photo")]
    public async Task<IActionResult> GetPhoto()
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (user!.PhotoPath == null)
            return NotFound(new { detail = "Belum ada foto profil" });

        var path = Path.Combine(_uploadDir, user.PhotoPath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File foto tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var cd = new ContentDisposition { Inline = true, FileName = user.PhotoOriginalFilename ?? user.PhotoPath };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(bytes, user.PhotoContentType ?? "application/octet-stream");
    }
}
