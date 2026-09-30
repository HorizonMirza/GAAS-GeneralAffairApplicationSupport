using System.Net.Mime;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Processing;

namespace PengirimanApi.Controllers;

// App-wide branding (company name + logo) and booking-hours configuration - the singleton
// AppSettings row, plus the Holiday list Room/Vehicle Booking reject bookings on. Reading the
// company name/logo is public (no RequireRoleAsync call at all) since the login page - reached
// before anyone is authenticated - shows the same logo as the rest of the app. Every write is
// Super Admin-only and password-gated, same convention as MasterDataController.
[Route("api/app-settings")]
public class AppSettingsController : ApiControllerBase
{
    private static readonly Dictionary<string, string> AllowedLogoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
    };
    private const long MaxLogoFileSizeBytes = 5 * 1024 * 1024; // 5 MB
    private const int LogoMaxDimension = 512;
    private static readonly string BundledDefaultLogoPath = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-pgm-solution.png");

    private readonly AppDbContext _db;
    private readonly string _uploadDir;

    public AppSettingsController(AppDbContext db, CurrentUserService currentUser, IConfiguration config) : base(currentUser)
    {
        _db = db;
        _uploadDir = DirektoriUnggahan.ResolveDanBuat(config, DirektoriUnggahan.KunciAppLogo, DirektoriUnggahan.DefaultAppLogo);
    }

    private async Task<AppSettings> GetOrCreateAsync()
    {
        var settings = await _db.AppSettings.FindAsync(1);
        if (settings != null) return settings;
        // Only reachable if the Program.cs seed insert somehow never ran - same defaults as that
        // seed (which match what was hardcoded before this table existed), so the app never has
        // to handle a "no settings row" case.
        settings = new AppSettings
        {
            Id = 1, CompanyName = "PGN Solution",
            OperatingStart = new TimeOnly(7, 0), OperatingEnd = new TimeOnly(18, 0),
            UpdatedAt = DateTime.UtcNow,
        };
        _db.AppSettings.Add(settings);
        await _db.SaveChangesAsync();
        return settings;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var settings = await GetOrCreateAsync();
        return Ok(AppSettingsOut.From(settings));
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateAppSettingsRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (string.IsNullOrEmpty(payload.Password) || !BCrypt.Net.BCrypt.Verify(payload.Password, user!.PasswordHash))
            return StatusCode(400, new { detail = "Password salah" });

        if (string.IsNullOrWhiteSpace(payload.CompanyName))
            return StatusCode(400, new { detail = "Nama perusahaan wajib diisi" });
        if (!TimeOnly.TryParse(payload.OperatingStart, out var start))
            return StatusCode(400, new { detail = "Jam mulai tidak valid" });
        if (!TimeOnly.TryParse(payload.OperatingEnd, out var end))
            return StatusCode(400, new { detail = "Jam selesai tidak valid" });
        if (end <= start)
            return StatusCode(400, new { detail = "Jam selesai harus setelah jam mulai" });

        var settings = await GetOrCreateAsync();
        settings.CompanyName = payload.CompanyName.Trim();
        settings.OperatingStart = start;
        settings.OperatingEnd = end;
        settings.UpdatedAt = DateTime.UtcNow;
        LogAdminActivity(_db, "APP_SETTINGS_UPDATE", $"Ubah Pengaturan Aplikasi: nama '{settings.CompanyName}', jam operasional {start:HH:mm}-{end:HH:mm}", user!);
        await _db.SaveChangesAsync();
        AppSettingsCache.LoadFromDb(_db);

        return Ok(AppSettingsOut.From(settings));
    }

    [HttpGet("logo")]
    public IActionResult GetLogo()
    {
        var path = AppSettingsCache.LogoPath != null ? Path.Combine(_uploadDir, AppSettingsCache.LogoPath) : BundledDefaultLogoPath;
        var contentType = AppSettingsCache.LogoPath != null ? AppSettingsCache.LogoContentType ?? "image/png" : "image/png";
        if (!System.IO.File.Exists(path))
            path = BundledDefaultLogoPath;
        var bytes = System.IO.File.ReadAllBytes(path);
        return File(bytes, contentType);
    }

    [HttpPost("logo")]
    public async Task<IActionResult> UploadLogo([FromForm] IFormFile? file, [FromForm] string password)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (string.IsNullOrEmpty(password) || !BCrypt.Net.BCrypt.Verify(password, user!.PasswordHash))
            return StatusCode(400, new { detail = "Password salah" });

        if (file == null || file.Length == 0)
            return StatusCode(400, new { detail = "Logo wajib diunggah" });
        if (file.Length > MaxLogoFileSizeBytes)
            return StatusCode(400, new { detail = $"Ukuran file maksimal {MaxLogoFileSizeBytes / 1024 / 1024} MB" });
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext) || !AllowedLogoExtensions.TryGetValue(ext, out var contentType))
            return StatusCode(400, new { detail = "Format logo tidak didukung. Gunakan JPG atau PNG." });

        byte[] normalized;
        try
        {
            await using var input = file.OpenReadStream();
            using var image = await Image.LoadAsync(input);
            image.Mutate(x => x.AutoOrient());
            if (image.Width > LogoMaxDimension || image.Height > LogoMaxDimension)
                image.Mutate(x => x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(LogoMaxDimension, LogoMaxDimension) }));
            using var output = new MemoryStream();
            await image.SaveAsync(output, new PngEncoder());
            normalized = output.ToArray();
            contentType = "image/png";
            ext = ".png";
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

        var settings = await GetOrCreateAsync();
        var oldPath = settings.LogoPath != null ? Path.Combine(_uploadDir, settings.LogoPath) : null;

        settings.LogoPath = storedFilename;
        settings.LogoContentType = contentType;
        settings.LogoOriginalFilename = string.IsNullOrEmpty(file.FileName) ? storedFilename : file.FileName;
        settings.UpdatedAt = DateTime.UtcNow;
        LogAdminActivity(_db, "APP_LOGO_UPLOAD", $"Unggah logo perusahaan baru ({settings.LogoOriginalFilename})", user!);
        await _db.SaveChangesAsync();
        AppSettingsCache.LoadFromDb(_db);

        if (oldPath != null && System.IO.File.Exists(oldPath))
            System.IO.File.Delete(oldPath);

        return Ok(AppSettingsOut.From(settings));
    }

    [HttpDelete("logo")]
    public async Task<IActionResult> DeleteLogo([FromBody] PasswordOnlyRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (string.IsNullOrEmpty(payload.Password) || !BCrypt.Net.BCrypt.Verify(payload.Password, user!.PasswordHash))
            return StatusCode(400, new { detail = "Password salah" });

        var settings = await GetOrCreateAsync();
        var oldPath = settings.LogoPath != null ? Path.Combine(_uploadDir, settings.LogoPath) : null;

        settings.LogoPath = null;
        settings.LogoContentType = null;
        settings.LogoOriginalFilename = null;
        settings.UpdatedAt = DateTime.UtcNow;
        LogAdminActivity(_db, "APP_LOGO_DELETE", "Kembalikan logo perusahaan ke default", user!);
        await _db.SaveChangesAsync();
        AppSettingsCache.LoadFromDb(_db);

        if (oldPath != null && System.IO.File.Exists(oldPath))
            System.IO.File.Delete(oldPath);

        return Ok(AppSettingsOut.From(settings));
    }

    [HttpGet("holidays")]
    public async Task<IActionResult> ListHolidays()
    {
        var (_, error) = await RequireRoleExceptAsync();
        if (error != null) return error;

        var holidays = await _db.Holidays.OrderBy(h => h.Date).ToListAsync();
        return Ok(new HolidayListResponse(holidays.Select(HolidayOut.From).ToList()));
    }

    [HttpPost("holidays")]
    public async Task<IActionResult> CreateHoliday([FromBody] CreateHolidayRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (string.IsNullOrEmpty(payload.Password) || !BCrypt.Net.BCrypt.Verify(payload.Password, user!.PasswordHash))
            return StatusCode(400, new { detail = "Password salah" });

        if (!DateOnly.TryParse(payload.Date, out var date))
            return StatusCode(400, new { detail = "Tanggal tidak valid" });
        if (string.IsNullOrWhiteSpace(payload.Label))
            return StatusCode(400, new { detail = "Nama hari libur wajib diisi" });
        if (await _db.Holidays.AnyAsync(h => h.Date == date))
            return StatusCode(400, new { detail = "Tanggal ini sudah ada di daftar hari libur" });

        var row = new Holiday { Date = date, Label = payload.Label.Trim(), CreatedAt = DateTime.UtcNow };
        _db.Holidays.Add(row);
        LogAdminActivity(_db, "HOLIDAY_CREATE", $"Tambah Hari Libur {date:yyyy-MM-dd} ({row.Label})", user!);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            return StatusCode(400, new { detail = "Tanggal ini sudah ada di daftar hari libur" });
        }
        AppSettingsCache.LoadFromDb(_db);

        return StatusCode(201, HolidayOut.From(row));
    }

    [HttpDelete("holidays/{id:int}")]
    public async Task<IActionResult> DeleteHoliday(int id, [FromBody] PasswordOnlyRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (string.IsNullOrEmpty(payload.Password) || !BCrypt.Net.BCrypt.Verify(payload.Password, user!.PasswordHash))
            return StatusCode(400, new { detail = "Password salah" });

        var row = await _db.Holidays.FirstOrDefaultAsync(h => h.Id == id);
        if (row == null) return NotFound(new { detail = "Hari libur tidak ditemukan" });

        _db.Holidays.Remove(row);
        LogAdminActivity(_db, "HOLIDAY_DELETE", $"Hapus Hari Libur {row.Date:yyyy-MM-dd} ({row.Label})", user!);
        await _db.SaveChangesAsync();
        AppSettingsCache.LoadFromDb(_db);

        return NoContent();
    }
}
