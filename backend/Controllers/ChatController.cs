using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[ApiController]
[Route("api/pengiriman/{pengirimanId:int}/chat")]
public class ChatController : ApiControllerBase
{
    private readonly AppDbContext _db;

    public ChatController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
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

        var exists = await _db.Pengiriman.AnyAsync(p => p.Id == pengirimanId);
        if (!exists) return NotFound(new { detail = "Transaksi tidak ditemukan" });

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

        var exists = await _db.Pengiriman.AnyAsync(p => p.Id == pengirimanId);
        if (!exists) return NotFound(new { detail = "Transaksi tidak ditemukan" });

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

        return StatusCode(201, new ChatMessageOut(message.Id, user.Id, user.Nama, user.Role, message.Message, message.CreatedAt));
    }
}
