using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[ApiController]
[Route("api/invoice")]
public class InvoiceController : ApiControllerBase
{
    private static readonly HashSet<int> AllowedLimits = new() { 5, 10, 20, 50 };
    private const long MaxInvoiceFileSizeBytes = 10 * 1024 * 1024; // 10 MB

    private readonly AppDbContext _db;
    private readonly string _uploadDir;

    public InvoiceController(AppDbContext db, CurrentUserService currentUser, IConfiguration config)
        : base(currentUser)
    {
        _db = db;
        var configured = config.GetValue<string>("UploadDir") ?? "uploads/invoices";
        _uploadDir = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(AppContext.BaseDirectory, "..", "..", "..", configured);
        _uploadDir = Path.GetFullPath(_uploadDir);
        Directory.CreateDirectory(_uploadDir);
    }

    private static void AddLog(Invoice item, string action, User actor, string? reason = null, string? filePath = null, string? originalFilename = null)
    {
        item.Logs.Add(new InvoiceLog
        {
            Action = action,
            ActorId = actor.Id,
            Reason = reason,
            FilePath = filePath,
            OriginalFilename = originalFilename,
        });
    }

    private static bool CanViewInvoice(Invoice item, User user) =>
        user.Role == RoleEnum.KPU ? item.UploadedBy == user.Id : item.Status != InvoiceStatusEnum.DRAFT;

    [HttpPost("")]
    public async Task<IActionResult> UploadInvoice([FromForm] string bulan, [FromForm] IFormFile? file)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.KPU);
        if (error != null) return error;

        if (file == null || file.Length == 0)
            return StatusCode(400, new { detail = "File invoice wajib diunggah" });
        if (file.Length > MaxInvoiceFileSizeBytes)
            return StatusCode(400, new { detail = $"Ukuran file maksimal {MaxInvoiceFileSizeBytes / 1024 / 1024} MB" });

        var alreadyExists = await _db.Invoices.AnyAsync(i => i.UploadedBy == user!.Id && i.Bulan == bulan);
        if (alreadyExists)
            return StatusCode(400, new { detail = "Invoice untuk bulan ini sudah pernah dikirim. Gunakan Updates untuk merevisi." });

        if (file.ContentType != "application/pdf")
            return StatusCode(400, new { detail = "File invoice harus berformat PDF" });

        var storedFilename = $"{Guid.NewGuid():N}.pdf";
        var destPath = Path.Combine(_uploadDir, storedFilename);
        using (var stream = System.IO.File.Create(destPath))
        {
            await file.CopyToAsync(stream);
        }

        var originalFilename = string.IsNullOrEmpty(file.FileName) ? "invoice.pdf" : file.FileName;
        var item = new Invoice
        {
            Bulan = bulan,
            FilePath = storedFilename,
            OriginalFilename = originalFilename,
            Status = InvoiceStatusEnum.DRAFT,
            UploadedBy = user!.Id,
            UploadedAt = DateTime.UtcNow,
        };
        AddLog(item, "UPLOADED", user, filePath: storedFilename, originalFilename: originalFilename);
        _db.Invoices.Add(item);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The AnyAsync check above closes the common case, but two uploads for the same
            // bulan submitted within the same instant can both pass it before either commits -
            // the unique index on (uploaded_by, bulan) is the real guard against that race.
            System.IO.File.Delete(destPath);
            return StatusCode(400, new { detail = "Invoice untuk bulan ini sudah pernah dikirim. Gunakan Updates untuk merevisi." });
        }

        return StatusCode(201, InvoiceOut.From(item));
    }

    [HttpPatch("{invoiceId}/submit")]
    public async Task<IActionResult> SubmitInvoice(int invoiceId)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (item.UploadedBy != user!.Id)
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });
        if (item.Status != InvoiceStatusEnum.DRAFT)
            return StatusCode(403, new { detail = "Invoice hanya bisa dikirim saat status Draft" });

        item.Status = InvoiceStatusEnum.PENDING;
        AddLog(item, "SUBMITTED", user);

        await _db.SaveChangesAsync();
        return Ok(InvoiceOut.From(item));
    }

    [HttpPatch("{invoiceId}")]
    public async Task<IActionResult> UpdateInvoice(int invoiceId, [FromForm] IFormFile? file)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.KPU);
        if (error != null) return error;

        if (file == null || file.Length == 0)
            return StatusCode(400, new { detail = "File invoice wajib diunggah" });
        if (file.Length > MaxInvoiceFileSizeBytes)
            return StatusCode(400, new { detail = $"Ukuran file maksimal {MaxInvoiceFileSizeBytes / 1024 / 1024} MB" });

        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (item.UploadedBy != user!.Id)
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });
        if (item.Status != InvoiceStatusEnum.REJECTED && item.Status != InvoiceStatusEnum.DRAFT)
            return StatusCode(403, new { detail = "Invoice hanya bisa diupdate saat status Draft atau Rejected" });

        if (file.ContentType != "application/pdf")
            return StatusCode(400, new { detail = "File invoice harus berformat PDF" });

        var storedFilename = $"{Guid.NewGuid():N}.pdf";
        var destPath = Path.Combine(_uploadDir, storedFilename);
        using (var stream = System.IO.File.Create(destPath))
        {
            await file.CopyToAsync(stream);
        }

        var originalFilename = string.IsNullOrEmpty(file.FileName) ? "invoice.pdf" : file.FileName;
        var wasRejected = item.Status == InvoiceStatusEnum.REJECTED;
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
        return Ok(InvoiceOut.From(item));
    }

    [HttpGet("")]
    public async Task<IActionResult> ListInvoice(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50" });

        var query = _db.Invoices.AsQueryable();
        if (user!.Role == RoleEnum.KPU)
            query = query.Where(i => i.UploadedBy == user.Id);
        else
            query = query.Where(i => i.Status != InvoiceStatusEnum.DRAFT);

        if (!string.IsNullOrEmpty(bulan)) query = query.Where(i => i.Bulan == bulan);
        if (!string.IsNullOrEmpty(search)) query = query.Where(i => i.OriginalFilename.Contains(search));

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(i => i.UploadedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        return Ok(new InvoiceListResponse
        {
            Items = items.Select(InvoiceOut.From).ToList(),
            Total = total,
            Page = page,
            Limit = limit,
        });
    }

    [HttpGet("{invoiceId}/file")]
    public async Task<IActionResult> DownloadInvoiceFile(int invoiceId, [FromQuery] bool download = false)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (!CanViewInvoice(item, user!))
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });

        var path = Path.Combine(_uploadDir, item.FilePath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File invoice tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var disposition = download ? "attachment" : "inline";
        Response.Headers["Content-Disposition"] = $"{disposition}; filename=\"{item.OriginalFilename}\"";
        return File(bytes, "application/pdf");
    }

    [HttpDelete("{invoiceId}")]
    public async Task<IActionResult> DeleteInvoice(int invoiceId)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN, RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.Invoices.Include(i => i.Logs).FirstOrDefaultAsync(i => i.Id == invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });

        if (user!.Role == RoleEnum.KPU)
        {
            if (item.UploadedBy != user.Id)
                return StatusCode(403, new { detail = "Bukan invoice milik Anda" });
            if (item.Status != InvoiceStatusEnum.DRAFT && item.Status != InvoiceStatusEnum.REJECTED)
                return StatusCode(403, new { detail = "Invoice hanya bisa dihapus saat status Draft atau Rejected" });
        }

        // InvoiceLog rows are cascade-deleted with the invoice, so every revision's file
        // (not just the current one) needs to be removed here or it's orphaned on disk forever.
        var filesToDelete = item.Logs.Select(l => l.FilePath).Append(item.FilePath).Where(f => f != null).Distinct();
        foreach (var f in filesToDelete)
        {
            var path = Path.Combine(_uploadDir, f!);
            if (System.IO.File.Exists(path))
                System.IO.File.Delete(path);
        }

        _db.Invoices.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{invoiceId}/approve")]
    public async Task<IActionResult> ApproveInvoice(int invoiceId, [FromBody] InvoiceReviewRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (error != null) return error;

        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (item.Status != InvoiceStatusEnum.PENDING)
            return StatusCode(403, new { detail = "Invoice sudah diproses sebelumnya" });

        item.Status = InvoiceStatusEnum.APPROVED;
        item.Catatan = payload.Catatan;
        item.ReviewedBy = user!.Id;
        item.ReviewedAt = DateTime.UtcNow;
        AddLog(item, "APPROVED", user, payload.Catatan);

        await _db.SaveChangesAsync();
        return Ok(InvoiceOut.From(item));
    }

    [HttpPatch("{invoiceId}/reject")]
    public async Task<IActionResult> RejectInvoice(int invoiceId, [FromBody] InvoiceReviewRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (error != null) return error;

        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (item.Status != InvoiceStatusEnum.PENDING)
            return StatusCode(403, new { detail = "Invoice sudah diproses sebelumnya" });

        item.Status = InvoiceStatusEnum.REJECTED;
        item.Catatan = payload.Catatan;
        item.ReviewedBy = user!.Id;
        item.ReviewedAt = DateTime.UtcNow;
        AddLog(item, "REJECTED", user, payload.Catatan);

        await _db.SaveChangesAsync();
        return Ok(InvoiceOut.From(item));
    }

    [HttpGet("{invoiceId}/logs")]
    public async Task<IActionResult> GetLogs(int invoiceId)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var item = await _db.Invoices
            .Include(i => i.Logs).ThenInclude(l => l.Aktor)
            .FirstOrDefaultAsync(i => i.Id == invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (!CanViewInvoice(item, user!))
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });

        var result = item.Logs
            .OrderBy(l => l.CreatedAt)
            .Select(l => new InvoiceLogOut(
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

        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (!CanViewInvoice(item, user!))
            return StatusCode(403, new { detail = "Bukan invoice milik Anda" });

        var log = await _db.InvoiceLogs.FirstOrDefaultAsync(l => l.Id == logId && l.InvoiceId == invoiceId);
        if (log == null || log.FilePath == null)
            return NotFound(new { detail = "File riwayat tidak ditemukan" });

        var path = Path.Combine(_uploadDir, log.FilePath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File invoice tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var disposition = download ? "attachment" : "inline";
        Response.Headers["Content-Disposition"] = $"{disposition}; filename=\"{log.OriginalFilename}\"";
        return File(bytes, "application/pdf");
    }
}
