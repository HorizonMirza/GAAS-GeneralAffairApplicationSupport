using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;
using System.Net.Mime;

namespace PengirimanApi.Controllers;

// Archive: penyimpanan dokumen umum (SOP, surat, kontrak, dll), sengaja TIDAK memakai alur
// approval seperti modul lain di aplikasi ini - begitu diunggah, dokumen langsung tersimpan dan
// terlihat oleh semua unit (lihat ArchiveDocument.cs). Karena itu controller ini jauh lebih
// ramping: tidak ada Status, tidak ada log riwayat, tidak ada chat, tidak ada nomor dokumen.
[ApiController]
[Route("api/archive")]
public class ArchiveController : ApiControllerBase
{
    private static readonly HashSet<int> AllowedLimits = new() { 5, 10, 20, 50 };
    private const long MaxArchiveFileSizeBytes = 20 * 1024 * 1024; // 20 MB

    // Extension -> canonical Content-Type used both to validate an upload and to serve it back
    // later - deliberately keyed off the file extension rather than the browser-reported
    // IFormFile.ContentType, which is unreliable (empty or generic "application/octet-stream" is
    // common depending on OS/browser).
    private static readonly Dictionary<string, string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".doc"] = "application/msword",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xls"] = "application/vnd.ms-excel",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".ppt"] = "application/vnd.ms-powerpoint",
        [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
        [".zip"] = "application/zip",
    };

    private static readonly RoleEnum[] UploadRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
        RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA,
    };

    // Same mixing as the other modules - Admin/Approval GA accounts have no Divisi/Departemen of
    // their own, so documents they upload are stamped with the real GA unit.
    private const string GaDivisiLabel = "Procurement and General Affair";
    private const string GaDepartemenLabel = "Asset Management and General Affair";

    private readonly AppDbContext _db;
    private readonly string _uploadDir;

    public ArchiveController(AppDbContext db, CurrentUserService currentUser, IConfiguration config)
        : base(currentUser)
    {
        _db = db;
        var configured = config.GetValue<string>("ArchiveUploadDir") ?? "uploads/archive";
        _uploadDir = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(AppContext.BaseDirectory, "..", "..", "..", configured);
        _uploadDir = Path.GetFullPath(_uploadDir);
        Directory.CreateDirectory(_uploadDir);
    }

    private static string EffectiveDivisi(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDivisiLabel : user.Divisi!;

    private static string? EffectiveDepartemen(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDepartemenLabel : user.Departemen;

    // Uploader manages their own document; Admin/Approval GA and Super Admin manage every
    // document (they are the de-facto stewards of company-wide archive content).
    private static bool CanManage(ArchiveDocument item, User user) =>
        item.UploadedBy == user.Id || user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA or RoleEnum.SUPER_ADMIN;

    private static (bool ok, string? contentType, string? error) ValidateFile(IFormFile? file, bool required)
    {
        if (file == null || file.Length == 0)
            return required ? (false, null, "File dokumen wajib diunggah") : (true, null, null);
        if (file.Length > MaxArchiveFileSizeBytes)
            return (false, null, $"Ukuran file maksimal {MaxArchiveFileSizeBytes / 1024 / 1024} MB");
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext) || !AllowedExtensions.TryGetValue(ext, out var contentType))
            return (false, null, "Format file tidak didukung. Gunakan PDF, Word, Excel, PowerPoint, gambar, atau ZIP.");
        return (true, contentType, null);
    }

    private static IQueryable<ArchiveDocument> ApplyBulanFilter(IQueryable<ArchiveDocument> query, string? bulan)
    {
        if (string.IsNullOrEmpty(bulan)) return query;
        var parts = bulan.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var year) || !int.TryParse(parts[1], out var month))
            throw new ArgumentException("Format bulan harus YYYY-MM");
        return query.Where(a => a.CreatedAt.Year == year && a.CreatedAt.Month == month);
    }

    [HttpPost]
    public async Task<IActionResult> Upload(
        [FromForm] string namaDokumen,
        [FromForm] string kategori,
        [FromForm] string? catatan,
        [FromForm] IFormFile? file)
    {
        var (user, error) = await RequireRoleAsync(UploadRoles);
        if (error != null) return error;

        if (string.IsNullOrWhiteSpace(namaDokumen))
            return BadRequest(new { detail = "Nama dokumen wajib diisi" });
        if (!Enum.TryParse<ArchiveKategoriEnum>(kategori, out var kategoriEnum))
            return BadRequest(new { detail = "Kategori tidak valid" });

        var (fileOk, contentType, fileError) = ValidateFile(file, required: true);
        if (!fileOk) return BadRequest(new { detail = fileError });

        var divisi = EffectiveDivisi(user!);
        if (string.IsNullOrEmpty(divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var storedFilename = $"{Guid.NewGuid():N}{Path.GetExtension(file!.FileName)}";
        var destPath = Path.Combine(_uploadDir, storedFilename);
        using (var stream = System.IO.File.Create(destPath))
        {
            await file.CopyToAsync(stream);
        }

        var item = new ArchiveDocument
        {
            NamaDokumen = namaDokumen.Trim(),
            Kategori = kategoriEnum,
            FilePath = storedFilename,
            OriginalFilename = string.IsNullOrEmpty(file.FileName) ? storedFilename : file.FileName,
            ContentType = contentType!,
            FileSizeBytes = file.Length,
            Catatan = string.IsNullOrWhiteSpace(catatan) ? null : catatan.Trim(),
            Divisi = divisi,
            Departemen = EffectiveDepartemen(user!),
            UploadedBy = user!.Id,
            UploadedByRole = user.Role,
        };
        _db.ArchiveDocuments.Add(item);
        await _db.SaveChangesAsync();

        return StatusCode(201, ArchiveDocumentOut.From(item));
    }

    [HttpPut("{itemId:int}")]
    public async Task<IActionResult> Update(
        int itemId,
        [FromForm] string? namaDokumen,
        [FromForm] string? kategori,
        [FromForm] string? catatan,
        [FromForm] IFormFile? file)
    {
        var (user, error) = await RequireRoleAsync(UploadRoles);
        if (error != null) return error;

        var item = await _db.ArchiveDocuments.FirstOrDefaultAsync(a => a.Id == itemId);
        if (item == null) return NotFound(new { detail = "Dokumen tidak ditemukan" });
        if (!CanManage(item, user!))
            return StatusCode(403, new { detail = "Bukan dokumen milik Anda" });

        if (!string.IsNullOrWhiteSpace(namaDokumen)) item.NamaDokumen = namaDokumen.Trim();
        if (!string.IsNullOrEmpty(kategori))
        {
            if (!Enum.TryParse<ArchiveKategoriEnum>(kategori, out var kategoriEnum))
                return BadRequest(new { detail = "Kategori tidak valid" });
            item.Kategori = kategoriEnum;
        }
        if (catatan != null) item.Catatan = string.IsNullOrWhiteSpace(catatan) ? null : catatan.Trim();

        var (fileOk, contentType, fileError) = ValidateFile(file, required: false);
        if (!fileOk) return BadRequest(new { detail = fileError });

        if (file != null && file.Length > 0)
        {
            var storedFilename = $"{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
            var destPath = Path.Combine(_uploadDir, storedFilename);
            using (var stream = System.IO.File.Create(destPath))
            {
                await file.CopyToAsync(stream);
            }
            var oldPath = Path.Combine(_uploadDir, item.FilePath);
            if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);

            item.FilePath = storedFilename;
            item.OriginalFilename = string.IsNullOrEmpty(file.FileName) ? storedFilename : file.FileName;
            item.ContentType = contentType!;
            item.FileSizeBytes = file.Length;
        }

        await _db.SaveChangesAsync();
        return Ok(ArchiveDocumentOut.From(item));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery] string? kategori = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery] string? direktorat = null,
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null)
    {
        var (_, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50" });

        ArchiveKategoriEnum? kategoriFilter = null;
        if (!string.IsNullOrEmpty(kategori))
        {
            if (!Enum.TryParse<ArchiveKategoriEnum>(kategori, out var parsed))
                return BadRequest(new { detail = "Kategori tidak valid" });
            kategoriFilter = parsed;
        }

        // Tidak dibatasi per unit seperti ApplyListFilters modul lain - dokumen arsip memang
        // terbuka untuk semua unit (lihat ArchiveDocument.cs), Divisi/Departemen di sini murni
        // filter, bukan pembatas visibilitas.
        var query = _db.ArchiveDocuments.AsQueryable();
        if (kategoriFilter.HasValue) query = query.Where(a => a.Kategori == kategoriFilter.Value);
        if (!string.IsNullOrEmpty(divisi)) query = query.Where(a => a.Divisi == divisi);
        if (!string.IsNullOrEmpty(departemen)) query = query.Where(a => a.Departemen == departemen);
        if (!string.IsNullOrEmpty(direktorat))
            query = query.Where(a => _db.Users.Any(u => u.Id == a.UploadedBy && u.Direktorat == direktorat));
        if (!string.IsNullOrEmpty(search))
            query = query.Where(a => a.NamaDokumen.Contains(search) || a.OriginalFilename.Contains(search));

        try
        {
            query = ApplyBulanFilter(query, bulan);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var total = await query.CountAsync();
        var items = await query
            .Include(a => a.Pengunggah)
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        return Ok(new ArchiveDocumentListResponse
        {
            Items = items.Select(ArchiveDocumentOut.From).ToList(),
            Total = total,
            Page = page,
            Limit = limit,
        });
    }

    [HttpGet("{itemId:int}/file")]
    public async Task<IActionResult> DownloadFile(int itemId, [FromQuery] bool download = false)
    {
        var (_, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.ArchiveDocuments.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Dokumen tidak ditemukan" });

        var path = Path.Combine(_uploadDir, item.FilePath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File dokumen tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        // ContentDisposition properly quotes/escapes an untrusted uploaded filename (a raw
        // interpolated string breaks on an embedded '"' and throws on CR/LF) instead of raw
        // string interpolation.
        var cd = new ContentDisposition { Inline = !download, FileName = item.OriginalFilename };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(bytes, item.ContentType);
    }

    [HttpDelete("{itemId:int}")]
    public async Task<IActionResult> Delete(int itemId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.ArchiveDocuments.FirstOrDefaultAsync(a => a.Id == itemId);
        if (item == null) return NotFound(new { detail = "Dokumen tidak ditemukan" });
        if (!CanManage(item, user!))
            return StatusCode(403, new { detail = "Bukan dokumen milik Anda" });

        var path = Path.Combine(_uploadDir, item.FilePath);
        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);

        _db.ArchiveDocuments.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
