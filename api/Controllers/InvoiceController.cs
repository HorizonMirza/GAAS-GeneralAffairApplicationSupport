using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[ApiController]
[Route("api/invoice")]
public class InvoiceController : ApiControllerBase
{
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
    public async Task<IActionResult> UploadInvoice([FromForm] string bulan, [FromForm] IFormFile file)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.KPU);
        if (error != null) return error;

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
        await _db.SaveChangesAsync();

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
    public async Task<IActionResult> UpdateInvoice(int invoiceId, [FromForm] IFormFile file)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.KPU);
        if (error != null) return error;

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
        if (wasRejected)
        {
            item.Status = InvoiceStatusEnum.PENDING;
            item.Catatan = null;
            item.ReviewedBy = null;
            item.ReviewedAt = null;
        }
        AddLog(item, wasRejected ? "REVISED" : "DRAFT_UPDATED", user, filePath: storedFilename, originalFilename: originalFilename);

        await _db.SaveChangesAsync();
        return Ok(InvoiceOut.From(item));
    }

    [HttpGet("")]
    public async Task<IActionResult> ListInvoice()
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var query = _db.Invoices.AsQueryable();
        if (user!.Role == RoleEnum.KPU)
            query = query.Where(i => i.UploadedBy == user.Id);
        else
            query = query.Where(i => i.Status != InvoiceStatusEnum.DRAFT);

        var items = query.OrderByDescending(i => i.UploadedAt).ToList();
        return Ok(items.Select(InvoiceOut.From));
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
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null)
            return NotFound(new { detail = "Invoice tidak ditemukan" });

        var path = Path.Combine(_uploadDir, item.FilePath);
        if (System.IO.File.Exists(path))
            System.IO.File.Delete(path);

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
