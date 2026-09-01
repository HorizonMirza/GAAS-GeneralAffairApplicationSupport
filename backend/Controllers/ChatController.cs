using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Hubs;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[ApiController]
[Route("api/pengiriman/{pengirimanId:int}/chat")]
public class ChatController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;

    public ChatController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub) : base(currentUser)
    {
        _db = db;
        _hub = hub;
    }

    private async Task MarkRead(int pengirimanId, int userId, DateTime at)
    {
        var read = await _db.ChatReads.FirstOrDefaultAsync(r => r.PengirimanId == pengirimanId && r.UserId == userId);
        if (read == null)
        {
            _db.ChatReads.Add(new ChatRead { PengirimanId = pengirimanId, UserId = userId, LastReadAt = at });
        }
        else
        {
            read.LastReadAt = at;
        }
    }

    [HttpGet("")]
    public async Task<IActionResult> List(int pengirimanId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.Pengiriman.FindAsync(pengirimanId);
        if (item == null) return NotFound(new { detail = "Transaksi tidak ditemukan" });
        if (!CanAccessPengiriman(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var messages = await _db.ChatMessages
            .Include(m => m.Sender)
            .Where(m => m.PengirimanId == pengirimanId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatMessageOut(m.Id, m.SenderId, m.Sender.Nama, m.Sender.Role, m.Message, m.CreatedAt))
            .ToListAsync();

        // Reading happens strictly after every message already stored was created, so "now" is a safe read cursor here.
        await MarkRead(pengirimanId, user!.Id, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("")]
    public async Task<IActionResult> Send(int pengirimanId, [FromBody] SendChatMessageRequest payload)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.Pengiriman.FindAsync(pengirimanId);
        if (item == null) return NotFound(new { detail = "Transaksi tidak ditemukan" });
        if (!CanAccessPengiriman(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var text = payload.Message?.Trim();
        if (string.IsNullOrEmpty(text))
            return BadRequest(new { detail = "Pesan tidak boleh kosong" });

        var message = new ChatMessage
        {
            PengirimanId = pengirimanId,
            SenderId = user!.Id,
            Message = text,
        };
        _db.ChatMessages.Add(message);
        await _db.SaveChangesAsync();

        // Mark read using the message's own CreatedAt (stamped above) so the sender never sees their own message as unread.
        await MarkRead(pengirimanId, user.Id, message.CreatedAt);
        await _db.SaveChangesAsync();

        var outMessage = new ChatMessageOut(message.Id, user.Id, user.Nama, user.Role, message.Message, message.CreatedAt);
        // Pushed to everyone with this thread open (see ChatHub.JoinPengirimanChat) instead of
        // making them wait for their next poll - the sender's own ChatModal also receives this,
        // but it already appended the message locally on a successful POST, so it's a harmless
        // duplicate there (same id, same content).
        await _hub.Clients.Group(ChatHub.PengirimanGroup(pengirimanId)).SendAsync("ReceivePengirimanMessage", outMessage);

        var recipientIds = await _db.Users.Where(u => u.Id != user.Id).ToListAsync();
        await BroadcastChatNotificationAsync(
            _hub,
            recipientIds.Where(u => CanAccessPengiriman(u, item)).Select(u => u.Id),
            "pengiriman",
            pengirimanId,
            $"Pengiriman {item.NomorTransmittal}",
            user.Nama,
            text);

        return StatusCode(201, outMessage);
    }
}
