using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Hubs;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Chat for Ekspedisi's own Invoice (vendor-billing) workflow - mirrors PermintaanAtkChatController
// exactly, scoped by CanViewInvoice instead of a CanAccessX check: only KPU (their own uploads),
// Admin GA, Approval GA, and Super Admin ever see an invoice at all, so those are the only 4
// parties who can ever open or post in its chat.
[ApiController]
[Route("api/invoice/{invoiceId:int}/chat")]
public class InvoiceChatController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;

    public InvoiceChatController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub) : base(currentUser)
    {
        _db = db;
        _hub = hub;
    }

    private static readonly string[] MonthNamesId = { "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember" };

    // Label shown in the chat notification banner - mirrors InvoiceController.ItemLabel exactly.
    private static string ItemLabel(Invoice item)
    {
        var parts = item.Bulan.Split('-');
        var monthLabel = parts.Length == 2 && int.TryParse(parts[1], out var month) && month is >= 1 and <= 12
            ? $"{MonthNamesId[month - 1]} {parts[0]}"
            : item.Bulan;
        return $"Invoice {monthLabel} - {item.Nama}";
    }

    private async Task MarkRead(int invoiceId, int userId, DateTime at)
    {
        var read = await _db.InvoiceChatReads.FirstOrDefaultAsync(r => r.InvoiceId == invoiceId && r.UserId == userId);
        if (read == null)
        {
            _db.InvoiceChatReads.Add(new InvoiceChatRead { InvoiceId = invoiceId, UserId = userId, LastReadAt = at });
        }
        else
        {
            read.LastReadAt = at;
        }
    }

    [HttpGet("")]
    public async Task<IActionResult> List(int invoiceId)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null) return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (!CanViewInvoice(user!, item)) return StatusCode(403, new { detail = "Bukan invoice milik Anda" });

        var messages = await _db.InvoiceChatMessages
            .Include(m => m.Sender)
            .Where(m => m.InvoiceId == invoiceId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatMessageOut(m.Id, m.SenderId, m.Sender.Nama, m.Sender.Role, m.Message, m.CreatedAt))
            .ToListAsync();

        await MarkRead(invoiceId, user!.Id, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("")]
    public async Task<IActionResult> Send(int invoiceId, [FromBody] SendChatMessageRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null) return NotFound(new { detail = "Invoice tidak ditemukan" });
        if (!CanViewInvoice(user!, item)) return StatusCode(403, new { detail = "Bukan invoice milik Anda" });

        var text = payload.Message?.Trim();
        if (string.IsNullOrEmpty(text))
            return BadRequest(new { detail = "Pesan tidak boleh kosong" });
        if (text.Length > ChatLimits.MaxMessageLength)
            return BadRequest(new { detail = $"Pesan maksimal {ChatLimits.MaxMessageLength} karakter" });

        var message = new InvoiceChatMessage
        {
            InvoiceId = invoiceId,
            SenderId = user!.Id,
            Message = text,
        };
        _db.InvoiceChatMessages.Add(message);
        await _db.SaveChangesAsync();

        var outMessage = new ChatMessageOut(message.Id, user.Id, user.Nama, user.Role, message.Message, message.CreatedAt);
        await _hub.Clients.Group(ChatHub.InvoiceGroup(invoiceId)).SendAsync("ReceiveInvoiceMessage", outMessage);

        var recipientIds = await _db.Users.Where(u => u.Id != user.Id)
            .Select(u => new AccessUser(u.Id, u.Role, u.Divisi, u.Departemen))
            .ToListAsync();
        await BroadcastChatNotificationAsync(
            _hub,
            recipientIds.Where(u => CanViewInvoice(u, item)).Select(u => u.Id),
            "invoice",
            invoiceId,
            ItemLabel(item),
            user.Id,
            user.Nama,
            user.Role.ToString(),
            text);

        return StatusCode(201, outMessage);
    }
}
