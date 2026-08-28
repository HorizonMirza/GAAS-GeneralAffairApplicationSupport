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
    private readonly string _uploadDir;

    public ChatController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub, IConfiguration config) : base(currentUser)
    {
        _db = db;
        _hub = hub;
        _uploadDir = ChatImageStorage.ResolveUploadDir(config);
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
            .Select(m => new ChatMessageOut(m.Id, m.SenderId, m.Sender.Nama, m.Sender.Role, m.Message, m.ImagePath != null, m.CreatedAt))
            .ToListAsync();

        // Reading happens strictly after every message already stored was created, so "now" is a safe read cursor here.
        await MarkRead(pengirimanId, user!.Id, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("")]
    public async Task<IActionResult> Send(int pengirimanId, [FromForm] string? message, [FromForm] IFormFile? image)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.Pengiriman.FindAsync(pengirimanId);
        if (item == null) return NotFound(new { detail = "Transaksi tidak ditemukan" });
        if (!CanAccessPengiriman(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var text = message?.Trim() ?? "";
        var hasImage = image != null && image.Length > 0;
        if (string.IsNullOrEmpty(text) && !hasImage)
            return BadRequest(new { detail = "Pesan atau gambar wajib diisi" });

        string? storedImage = null;
        if (hasImage)
        {
            if (image!.Length > ChatImageStorage.MaxSizeBytes)
                return StatusCode(400, new { detail = $"Ukuran gambar maksimal {ChatImageStorage.MaxSizeBytes / 1024 / 1024} MB" });
            if (!ChatImageStorage.IsAllowedContentType(image.ContentType))
                return StatusCode(400, new { detail = "Format gambar harus JPG, PNG, WEBP, atau GIF" });
            storedImage = await ChatImageStorage.SaveAsync(image, _uploadDir);
        }

        var entity = new ChatMessage
        {
            PengirimanId = pengirimanId,
            SenderId = user!.Id,
            Message = text,
            ImagePath = storedImage,
            ImageOriginalFilename = hasImage ? image!.FileName : null,
        };
        _db.ChatMessages.Add(entity);
        await _db.SaveChangesAsync();

        // Mark read using the message's own CreatedAt (stamped above) so the sender never sees their own message as unread.
        await MarkRead(pengirimanId, user.Id, entity.CreatedAt);
        await _db.SaveChangesAsync();

        var outMessage = new ChatMessageOut(entity.Id, user.Id, user.Nama, user.Role, entity.Message, entity.ImagePath != null, entity.CreatedAt);
        // Pushed to everyone with this thread open (see ChatHub.JoinPengirimanChat) instead of
        // making them wait for their next poll - the sender's own ChatModal also receives this,
        // but it already appended the message locally on a successful POST, so it's a harmless
        // duplicate there (same id, same content).
        await _hub.Clients.Group(ChatHub.PengirimanGroup(pengirimanId)).SendAsync("ReceivePengirimanMessage", outMessage);

        return StatusCode(201, outMessage);
    }

    [HttpGet("messages/{messageId:int}/image")]
    public async Task<IActionResult> GetImage(int pengirimanId, int messageId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.Pengiriman.FindAsync(pengirimanId);
        if (item == null) return NotFound(new { detail = "Transaksi tidak ditemukan" });
        if (!CanAccessPengiriman(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var msg = await _db.ChatMessages.FirstOrDefaultAsync(m => m.Id == messageId && m.PengirimanId == pengirimanId);
        if (msg?.ImagePath == null) return NotFound(new { detail = "Gambar tidak ditemukan" });

        var path = Path.Combine(_uploadDir, msg.ImagePath);
        if (!System.IO.File.Exists(path)) return NotFound(new { detail = "File gambar tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        return File(bytes, ChatImageStorage.ContentTypeFor(msg.ImagePath));
    }
}
