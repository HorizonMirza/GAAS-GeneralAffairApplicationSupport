using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Services;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Processing;
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

    // Upstream uploads arrive at whatever resolution the user's phone/camera produced (often
    // several MB, thousands of pixels wide) and were previously stored - and served back - as-is:
    // the round avatar is never shown past 88px CSS, so a huge original just cost disk space and
    // bandwidth for zero visible gain, while a genuinely low-resolution upload stayed exactly as
    // blurry as it arrived. Normalizing on save (see NormalizeImageAsync) fixes both: it caps the
    // stored size to comfortably more than any current display size (headroom for retina and any
    // future larger avatar), and re-encoding at a fixed quality keeps every stored photo
    // consistent regardless of the source file's original compression.
    private const int PhotoMaxDimension = 512;
    private const int CoverMaxWidth = 1920;
    private const int CoverMaxHeight = 480;

    // Keys must match COVER_PRESETS in the frontend's constants.ts - kept as an explicit allowlist
    // here rather than accepting any string, since CoverPreset is rendered straight into a CSS
    // class name client-side.
    private static readonly HashSet<string> AllowedCoverPresets = new(StringComparer.Ordinal)
    {
        "navy", "ocean", "emerald", "sunset", "purple", "slate",
    };

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

    // Decodes whatever the browser sent (auto-detecting the real format from its bytes, not the
    // filename), corrects EXIF rotation so phone photos don't come out sideways, then shrinks it
    // only if it's actually bigger than the target box - ResizeMode.Max preserves aspect ratio and
    // never upscales a smaller source, so a low-res upload is re-encoded but not stretched. Throws
    // SixLabors.ImageSharp.UnknownImageFormatException/InvalidImageContentException for a file
    // that isn't a real image despite passing the extension check - callers turn that into a 400.
    private static async Task<byte[]> NormalizeImageAsync(Stream input, string contentType, int maxWidth, int maxHeight)
    {
        using var image = await Image.LoadAsync(input);
        image.Mutate(x => x.AutoOrient());
        if (image.Width > maxWidth || image.Height > maxHeight)
            image.Mutate(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(maxWidth, maxHeight) }));

        using var output = new MemoryStream();
        if (contentType == "image/png")
            await image.SaveAsync(output, new PngEncoder());
        else
            await image.SaveAsync(output, new JpegEncoder { Quality = 85 });
        return output.ToArray();
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

        byte[] normalized;
        try
        {
            await using var input = file.OpenReadStream();
            normalized = await NormalizeImageAsync(input, contentType, PhotoMaxDimension, PhotoMaxDimension);
        }
        catch (UnknownImageFormatException)
        {
            return StatusCode(400, new { detail = "File bukan gambar yang valid" });
        }
        catch (InvalidImageContentException)
        {
            return StatusCode(400, new { detail = "File bukan gambar yang valid" });
        }

        var storedFilename = $"{Guid.NewGuid():N}{ext}";
        var destPath = Path.Combine(_uploadDir, storedFilename);
        await System.IO.File.WriteAllBytesAsync(destPath, normalized);

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

    [HttpPut("cover-preset")]
    public async Task<IActionResult> UpdateCoverPreset([FromBody] UpdateCoverPresetRequest payload)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (!AllowedCoverPresets.Contains(payload.Preset))
            return StatusCode(400, new { detail = "Preset background tidak dikenali" });

        // Picking a preset always wins over any uploaded cover photo, so the old file is removed
        // rather than left orphaned on disk pointing at nothing.
        var oldPath = user!.CoverPhotoPath != null ? Path.Combine(_uploadDir, user.CoverPhotoPath) : null;

        user.CoverPreset = payload.Preset;
        user.CoverPhotoPath = null;
        user.CoverPhotoContentType = null;
        user.CoverPhotoOriginalFilename = null;
        await _db.SaveChangesAsync();

        if (oldPath != null && System.IO.File.Exists(oldPath))
            System.IO.File.Delete(oldPath);

        return Ok(MeResponse.From(user));
    }

    [HttpPost("cover-photo")]
    public async Task<IActionResult> UploadCoverPhoto([FromForm] IFormFile? file)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (file == null || file.Length == 0)
            return StatusCode(400, new { detail = "Gambar wajib diunggah" });
        if (file.Length > MaxPhotoFileSizeBytes)
            return StatusCode(400, new { detail = $"Ukuran file maksimal {MaxPhotoFileSizeBytes / 1024 / 1024} MB" });
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext) || !AllowedPhotoExtensions.TryGetValue(ext, out var contentType))
            return StatusCode(400, new { detail = "Format gambar tidak didukung. Gunakan JPG atau PNG." });

        byte[] normalized;
        try
        {
            await using var input = file.OpenReadStream();
            normalized = await NormalizeImageAsync(input, contentType, CoverMaxWidth, CoverMaxHeight);
        }
        catch (UnknownImageFormatException)
        {
            return StatusCode(400, new { detail = "File bukan gambar yang valid" });
        }
        catch (InvalidImageContentException)
        {
            return StatusCode(400, new { detail = "File bukan gambar yang valid" });
        }

        var storedFilename = $"{Guid.NewGuid():N}{ext}";
        var destPath = Path.Combine(_uploadDir, storedFilename);
        await System.IO.File.WriteAllBytesAsync(destPath, normalized);

        var oldPath = user!.CoverPhotoPath != null ? Path.Combine(_uploadDir, user.CoverPhotoPath) : null;

        user.CoverPhotoPath = storedFilename;
        user.CoverPhotoContentType = contentType;
        user.CoverPhotoOriginalFilename = string.IsNullOrEmpty(file.FileName) ? storedFilename : file.FileName;
        await _db.SaveChangesAsync();

        if (oldPath != null && System.IO.File.Exists(oldPath))
            System.IO.File.Delete(oldPath);

        return Ok(MeResponse.From(user));
    }

    [HttpDelete("cover-photo")]
    public async Task<IActionResult> DeleteCoverPhoto()
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var oldPath = user!.CoverPhotoPath != null ? Path.Combine(_uploadDir, user.CoverPhotoPath) : null;

        user.CoverPhotoPath = null;
        user.CoverPhotoContentType = null;
        user.CoverPhotoOriginalFilename = null;
        await _db.SaveChangesAsync();

        if (oldPath != null && System.IO.File.Exists(oldPath))
            System.IO.File.Delete(oldPath);

        return Ok(MeResponse.From(user));
    }

    [HttpGet("cover-photo")]
    public async Task<IActionResult> GetCoverPhoto()
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (user!.CoverPhotoPath == null)
            return NotFound(new { detail = "Belum ada foto background" });

        var path = Path.Combine(_uploadDir, user.CoverPhotoPath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File background tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var cd = new ContentDisposition { Inline = true, FileName = user.CoverPhotoOriginalFilename ?? user.CoverPhotoPath };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(bytes, user.CoverPhotoContentType ?? "application/octet-stream");
    }
}
