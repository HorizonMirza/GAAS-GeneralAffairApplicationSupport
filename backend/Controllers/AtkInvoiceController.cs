using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;
using System.Net.Mime;

namespace PengirimanApi.Controllers;

// Office Supplies' vendor-invoice workflow - deliberately a straight mirror of InvoiceController
// (Ekspedisi's), down to the role wiring (KPU uploads, Admin GA approves/rejects, Approval GA/
// Super Admin oversee), but backed by its own AtkInvoice table so the two modules' invoice lists
// never mix.
[ApiController]
[Route("api/atk-invoice")]
public class AtkInvoiceController : ApiControllerBase
{
    private static readonly HashSet<int> AllowedLimits = new() { 5, 10, 20, 50 };
    private const long MaxInvoiceFileSizeBytes = 10 * 1024 * 1024; // 10 MB

    private readonly AppDbContext _db;
    private readonly string _uploadDir;

    public AtkInvoiceController(AppDbContext db, CurrentUserService currentUser, IConfiguration config)
        : base(currentUser)
    {
        _db = db;
        _uploadDir = DirektoriUnggahan.ResolveDanBuat(config, DirektoriUnggahan.KunciAtkInvoice, DirektoriUnggahan.DefaultAtkInvoice);
    }

    // Same spoofable-Content-Type concern as InvoiceController.LooksLikePdfAsync - checking the
    // real 5-byte PDF signature instead of trusting the client's declared type.
    private static async Task<bool> LooksLikePdfAsync(IFormFile file)
    {
        var header = new byte[5];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAsync(header.AsMemory(0, header.Length));
        return read == header.Length && System.Text.Encoding.ASCII.GetString(header) == "%PDF-";
    }

    private static void AddLog(AtkInvoice item, string action, User actor, string? reason = null, string? filePath = null, string? originalFilename = null)
    {
        item.Logs.Add(new AtkInvoiceLog
        {
            Action = action,
            ActorId = actor.Id,
            Reason = reason,
            FilePath = filePath,
            OriginalFilename = originalFilename,
        });
    }

    private static bool CanViewInvoice(AtkInvoice item, User user) =>
        user.Role == RoleEnum.KPU ? item.UploadedBy == user.Id : item.Status != InvoiceStatusEnum.DRAFT;

    private static readonly string[] MonthNamesId = { "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember" };

    private static bool IsValidBulan(string? bulan)
    {
        if (string.IsNullOrEmpty(bulan) || !System.Text.RegularExpressions.Regex.IsMatch(bulan, @"^\d{4}-(0[1-9]|1[0-2])$"))
            return false;
        var year = int.Parse(bulan[..4]);
        var nowYear = DateTime.UtcNow.Year;
        return year >= nowYear - 15 && year <= nowYear + 10;
    }

    private static bool MatchesInvoiceSearch(AtkInvoice invoice, string search)
    {
        if (invoice.Nama.Contains(search, StringComparison.OrdinalIgnoreCase)) return true;
        var parts = invoice.Bulan.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[1], out var month) || month < 1 || month > 12) return false;
        var label = $"Invoice {MonthNamesId[month - 1]} {parts[0]}";
        return label.Contains(search, StringComparison.OrdinalIgnoreCase);
    }

    [HttpPost("")]
    public async Task<IActionResult> UploadInvoice([FromForm] string nama, [FromForm] string bulan, [FromForm] IFormFile? file)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.KPU);
        if (error != null) return error;

        if (string.IsNullOrWhiteSpace(nama))
            return StatusCode(400, new { detail = "Nama pengirim invoice wajib diisi" });
        if (!IsValidBulan(bulan))
            return StatusCode(400, new { detail = "Bulan tidak valid" });
        if (file == null || file.Length == 0)
            return StatusCode(400, new { detail = "File invoice wajib diunggah" });
        if (file.Length > MaxInvoiceFileSizeBytes)
            return StatusCode(400, new { detail = $"Ukuran file maksimal {MaxInvoiceFileSizeBytes / 1024 / 1024} MB" });

        var alreadyExists = await _db.AtkInvoices.AnyAsync(i => i.UploadedBy == user!.Id && i.Bulan == bulan);
        if (alreadyExists)
            return StatusCode(400, new { detail = "Invoice untuk bulan ini sudah pernah dikirim. Gunakan Updates untuk merevisi." });

        if (file.ContentType != "application/pdf" || !await LooksLikePdfAsync(file))
            return StatusCode(400, new { detail = "File invoice harus berformat PDF" });

        var storedFilename = $"{Guid.NewGuid():N}.pdf";
        var destPath = Path.Combine(_uploadDir, storedFilename);
        using (var stream = System.IO.File.Create(destPath))
        {
            await file.CopyToAsync(stream);
        }

        var originalFilename = string.IsNullOrEmpty(file.FileName) ? "invoice.pdf" : file.FileName;
        var item = new AtkInvoice
        {
            Nama = nama.Trim(),
            Bulan = bulan,
            FilePath = storedFilename,
            OriginalFilename = originalFilename,
            Status = InvoiceStatusEnum.DRAFT,
            UploadedBy = user!.Id,
            UploadedAt = DateTime.UtcNow,
        };
        AddLog(item, "UPLOADED", user, filePath: storedFilename, originalFilename: originalFilename);
        _db.AtkInvoices.Add(item);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Same race the app-level AnyAsync check above can't fully close, backstopped by the
            // unique index on (uploaded_by, bulan) - see idx_atk_invoice_uploaded_by_bulan.
            System.IO.File.Delete(destPath);
            return StatusCode(400, new { detail = "Invoice untuk bulan ini sudah pernah dikirim. Gunakan Updates untuk merevisi." });
        }

        return StatusCode(201, AtkInvoiceOut.From(item));
    }

    [HttpPatch("{invoiceId}/submit")]
    public async Task<IActionResult> SubmitInvoice(int invoiceId)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.AtkInvoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (item.UploadedBy != user!.Id)
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });
        if (item.Status != InvoiceStatusEnum.DRAFT)
            return StatusCode(403, new { detail = "Invoice hanya bisa dikirim saat status Draft" });

        item.Status = InvoiceStatusEnum.PENDING;
        AddLog(item, "SUBMITTED", user);

        await _db.SaveChangesAsync();
        return Ok(AtkInvoiceOut.From(item));
    }

    [HttpPatch("{invoiceId}")]
    public async Task<IActionResult> UpdateInvoice(int invoiceId, [FromForm] string nama, [FromForm] string bulan, [FromForm] IFormFile? file)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.KPU);
        if (error != null) return error;

        if (string.IsNullOrWhiteSpace(nama))
            return StatusCode(400, new { detail = "Nama pengirim invoice wajib diisi" });
        if (!IsValidBulan(bulan))
            return StatusCode(400, new { detail = "Bulan tidak valid" });
        if (file == null || file.Length == 0)
            return StatusCode(400, new { detail = "File invoice wajib diunggah" });
        if (file.Length > MaxInvoiceFileSizeBytes)
            return StatusCode(400, new { detail = $"Ukuran file maksimal {MaxInvoiceFileSizeBytes / 1024 / 1024} MB" });

        var item = await _db.AtkInvoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (item.UploadedBy != user!.Id)
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });
        if (item.Status != InvoiceStatusEnum.REJECTED && item.Status != InvoiceStatusEnum.DRAFT)
            return StatusCode(403, new { detail = "Invoice hanya bisa diupdate saat status Draft atau Rejected" });

        if (bulan != item.Bulan)
        {
            var alreadyExists = await _db.AtkInvoices.AnyAsync(i => i.Id != invoiceId && i.UploadedBy == user.Id && i.Bulan == bulan);
            if (alreadyExists)
                return StatusCode(400, new { detail = "Invoice untuk bulan ini sudah pernah dikirim. Gunakan Updates untuk merevisi." });
        }

        if (file.ContentType != "application/pdf" || !await LooksLikePdfAsync(file))
            return StatusCode(400, new { detail = "File invoice harus berformat PDF" });

        var storedFilename = $"{Guid.NewGuid():N}.pdf";
        var destPath = Path.Combine(_uploadDir, storedFilename);
        using (var stream = System.IO.File.Create(destPath))
        {
            await file.CopyToAsync(stream);
        }

        var originalFilename = string.IsNullOrEmpty(file.FileName) ? "invoice.pdf" : file.FileName;
        var wasRejected = item.Status == InvoiceStatusEnum.REJECTED;
        item.Nama = nama.Trim();
        item.Bulan = bulan;
        item.FilePath = storedFilename;
        item.OriginalFilename = originalFilename;
        item.Status = InvoiceStatusEnum.DRAFT;
        if (wasRejected)
        {
            item.Catatan = null;
            item.ReviewedBy = null;
            item.ReviewedAt = null;
        }
        AddLog(item, wasRejected ? "REVISED" : "DRAFT_UPDATED", user, filePath: storedFilename, originalFilename: originalFilename);

        await _db.SaveChangesAsync();
        return Ok(AtkInvoiceOut.From(item));
    }

    [HttpGet("")]
    public async Task<IActionResult> ListInvoice(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null,
        [FromQuery] int? uploadedBy = null)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50" });
        if (page < 1)
            return BadRequest(new { detail = "Halaman harus dimulai dari 1" });

        var query = _db.AtkInvoices.AsQueryable();
        if (user!.Role == RoleEnum.KPU)
            query = query.Where(i => i.UploadedBy == user.Id);
        else
            query = query.Where(i => i.Status != InvoiceStatusEnum.DRAFT);

        if (!string.IsNullOrEmpty(bulan)) query = query.Where(i => i.Bulan == bulan);
        if (uploadedBy.HasValue) query = query.Where(i => i.UploadedBy == uploadedBy.Value);

        int total;
        List<AtkInvoice> items;
        if (!string.IsNullOrEmpty(search))
        {
            var candidates = await query.Include(i => i.Pengunggah).ToListAsync();
            var matched = candidates.Where(i => MatchesInvoiceSearch(i, search)).OrderByDescending(i => i.UploadedAt).ToList();
            total = matched.Count;
            items = matched.Skip((page - 1) * limit).Take(limit).ToList();
        }
        else
        {
            total = await query.CountAsync();
            items = await query
                .Include(i => i.Pengunggah)
                .OrderByDescending(i => i.UploadedAt)
                .Skip((page - 1) * limit)
                .Take(limit)
                .ToListAsync();
        }

        return Ok(new AtkInvoiceListResponse
        {
            Items = items.Select(AtkInvoiceOut.From).ToList(),
            Total = total,
            Page = page,
            Limit = limit,
        });
    }

    [HttpGet("uploaders")]
    public async Task<IActionResult> ListUploaders()
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var uploaders = await _db.AtkInvoices
            .Where(i => i.Status != InvoiceStatusEnum.DRAFT)
            .Select(i => new { id = i.UploadedBy, nama = i.Pengunggah.Nama })
            .Distinct()
            .OrderBy(u => u.nama)
            .ToListAsync();
        return Ok(uploaders);
    }

    [HttpGet("{invoiceId}/file")]
    public async Task<IActionResult> DownloadInvoiceFile(int invoiceId, [FromQuery] bool download = false)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var item = await _db.AtkInvoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (!CanViewInvoice(item, user!))
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });

        var path = Path.Combine(_uploadDir, item.FilePath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File invoice tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var cd = new ContentDisposition { Inline = !download, FileName = item.OriginalFilename };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(bytes, "application/pdf");
    }

    [HttpDelete("{invoiceId}")]
    public async Task<IActionResult> DeleteInvoice(int invoiceId)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN, RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.AtkInvoices.Include(i => i.Logs).FirstOrDefaultAsync(i => i.Id == invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });

        if (user!.Role == RoleEnum.KPU)
        {
            if (item.UploadedBy != user.Id)
                return StatusCode(403, new { detail = "Bukan invoice milik Anda" });
            if (item.Status != InvoiceStatusEnum.DRAFT && item.Status != InvoiceStatusEnum.REJECTED)
                return StatusCode(403, new { detail = "Invoice hanya bisa dihapus saat status Draft atau Rejected" });
        }

        var filesToDelete = item.Logs.Select(l => l.FilePath).Append(item.FilePath).Where(f => f != null).Distinct().ToList();

        if (user.Role == RoleEnum.SUPER_ADMIN)
            LogDeletion(_db, "atk-invoice", item.Id, item.Bulan, user);
        _db.AtkInvoices.Remove(item);
        await _db.SaveChangesAsync();
        foreach (var f in filesToDelete)
        {
            var path = Path.Combine(_uploadDir, f!);
            if (System.IO.File.Exists(path))
                System.IO.File.Delete(path);
        }
        return NoContent();
    }

    // "Hapus Semua" on the Super Admin page's Office Supplies tab's Invoice sub-tab - mirrors
    // InvoiceController.SuperAdminBulkDelete exactly.
    [HttpDelete("super-admin/bulk")]
    public async Task<IActionResult> SuperAdminBulkDelete(
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null,
        [FromQuery] int? uploadedBy = null)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var query = _db.AtkInvoices.Where(i => i.Status != InvoiceStatusEnum.DRAFT);
        if (!string.IsNullOrEmpty(bulan)) query = query.Where(i => i.Bulan == bulan);
        if (uploadedBy.HasValue) query = query.Where(i => i.UploadedBy == uploadedBy.Value);

        var candidates = await query.Include(i => i.Logs).ToListAsync();
        var items = string.IsNullOrEmpty(search) ? candidates : candidates.Where(i => MatchesInvoiceSearch(i, search)).ToList();
        if (items.Count == 0) return Ok(new { deleted = 0 });

        var filesToDelete = items
            .SelectMany(i => i.Logs.Select(l => l.FilePath).Append(i.FilePath))
            .Where(f => f != null)
            .Distinct()
            .ToList();

        var filterSummary = BuildFilterSummary(("bulan", bulan), ("search", search), ("uploadedBy", uploadedBy?.ToString()));
        foreach (var i in items)
            LogDeletion(_db, "atk-invoice", i.Id, i.Bulan, user!, filterSummary);

        _db.AtkInvoices.RemoveRange(items);
        await _db.SaveChangesAsync();
        foreach (var f in filesToDelete)
        {
            var path = Path.Combine(_uploadDir, f!);
            if (System.IO.File.Exists(path))
                System.IO.File.Delete(path);
        }
        return Ok(new { deleted = items.Count });
    }

    [HttpPatch("{invoiceId}/approve")]
    public async Task<IActionResult> ApproveInvoice(int invoiceId, [FromBody] AtkInvoiceReviewRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (error != null) return error;

        var item = await _db.AtkInvoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (item.Status != InvoiceStatusEnum.PENDING)
            return StatusCode(403, new { detail = "Invoice sudah diproses sebelumnya" });

        item.Status = InvoiceStatusEnum.APPROVED;
        item.Catatan = payload.Catatan;
        item.ReviewedBy = user!.Id;
        item.ReviewedAt = DateTime.UtcNow;
        AddLog(item, "APPROVED", user, payload.Catatan);

        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        return Ok(AtkInvoiceOut.From(item));
    }

    [HttpPatch("{invoiceId}/reject")]
    public async Task<IActionResult> RejectInvoice(int invoiceId, [FromBody] AtkInvoiceReviewRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (error != null) return error;

        var item = await _db.AtkInvoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (item.Status != InvoiceStatusEnum.PENDING)
            return StatusCode(403, new { detail = "Invoice sudah diproses sebelumnya" });

        item.Status = InvoiceStatusEnum.REJECTED;
        item.Catatan = payload.Catatan;
        item.ReviewedBy = user!.Id;
        item.ReviewedAt = DateTime.UtcNow;
        AddLog(item, "REJECTED", user, payload.Catatan);

        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        return Ok(AtkInvoiceOut.From(item));
    }

    [HttpGet("{invoiceId}/logs")]
    public async Task<IActionResult> GetLogs(int invoiceId)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var item = await _db.AtkInvoices
            .Include(i => i.Logs).ThenInclude(l => l.Aktor)
            .FirstOrDefaultAsync(i => i.Id == invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (!CanViewInvoice(item, user!))
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });

        var result = item.Logs
            .OrderBy(l => l.CreatedAt)
            .Select(l => new AtkInvoiceLogOut(
                l.Id,
                l.Action,
                l.Aktor?.Nama,
                l.Aktor?.Role,
                l.Reason,
                l.OriginalFilename,
                l.CreatedAt
            ))
            .ToList();

        return Ok(result);
    }

    [HttpGet("{invoiceId}/logs/{logId}/file")]
    public async Task<IActionResult> DownloadLogFile(int invoiceId, int logId, [FromQuery] bool download = false)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var item = await _db.AtkInvoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (!CanViewInvoice(item, user!))
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });

        var log = await _db.AtkInvoiceLogs.FirstOrDefaultAsync(l => l.Id == logId && l.AtkInvoiceId == invoiceId);
        if (log == null || log.FilePath == null)
            return NotFound(new { detail = "File riwayat tidak ditemukan" });

        var path = Path.Combine(_uploadDir, log.FilePath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File invoice tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var cd = new ContentDisposition { Inline = !download, FileName = log.OriginalFilename };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(bytes, "application/pdf");
    }
}
