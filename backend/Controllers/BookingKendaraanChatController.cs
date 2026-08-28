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
[Route("api/booking-kendaraan/{bookingKendaraanId:int}/chat")]
public class BookingKendaraanChatController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;
    private readonly string _uploadDir;

    public BookingKendaraanChatController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub, IConfiguration config) : base(currentUser)
    {
        _db = db;
        _hub = hub;
        _uploadDir = ChatImageStorage.ResolveUploadDir(config);
    }

    private async Task MarkRead(int bookingKendaraanId, int userId, DateTime at)
    {
        var read = await _db.BookingKendaraanChatReads.FirstOrDefaultAsync(r => r.BookingKendaraanId == bookingKendaraanId && r.UserId == userId);
        if (read == null)
        {
            _db.BookingKendaraanChatReads.Add(new BookingKendaraanChatRead { BookingKendaraanId = bookingKendaraanId, UserId = userId, LastReadAt = at });
        }
        else
        {
            read.LastReadAt = at;
        }
    }

    [HttpGet("")]
    public async Task<IActionResult> List(int bookingKendaraanId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.BookingKendaraans.FindAsync(bookingKendaraanId);
        if (item == null) return NotFound(new { detail = "Booking tidak ditemukan" });
        if (!CanAccessBookingKendaraan(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var messages = await _db.BookingKendaraanChatMessages
            .Include(m => m.Sender)
            .Where(m => m.BookingKendaraanId == bookingKendaraanId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatMessageOut(m.Id, m.SenderId, m.Sender.Nama, m.Sender.Role, m.Message, m.ImagePath != null, m.CreatedAt))
            .ToListAsync();

        await MarkRead(bookingKendaraanId, user!.Id, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("")]
    public async Task<IActionResult> Send(int bookingKendaraanId, [FromForm] string? message, [FromForm] IFormFile? image)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.BookingKendaraans.FindAsync(bookingKendaraanId);
        if (item == null) return NotFound(new { detail = "Booking tidak ditemukan" });
        if (!CanAccessBookingKendaraan(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

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

        var entity = new BookingKendaraanChatMessage
        {
            BookingKendaraanId = bookingKendaraanId,
            SenderId = user!.Id,
            Message = text,
            ImagePath = storedImage,
            ImageOriginalFilename = hasImage ? image!.FileName : null,
        };
        _db.BookingKendaraanChatMessages.Add(entity);
        await _db.SaveChangesAsync();

        var outMessage = new ChatMessageOut(entity.Id, user.Id, user.Nama, user.Role, entity.Message, entity.ImagePath != null, entity.CreatedAt);
        await _hub.Clients.Group(ChatHub.KendaraanGroup(bookingKendaraanId)).SendAsync("ReceiveKendaraanMessage", outMessage);

        return StatusCode(201, outMessage);
    }

    [HttpGet("messages/{messageId:int}/image")]
    public async Task<IActionResult> GetImage(int bookingKendaraanId, int messageId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.BookingKendaraans.FindAsync(bookingKendaraanId);
        if (item == null) return NotFound(new { detail = "Booking tidak ditemukan" });
        if (!CanAccessBookingKendaraan(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var msg = await _db.BookingKendaraanChatMessages.FirstOrDefaultAsync(m => m.Id == messageId && m.BookingKendaraanId == bookingKendaraanId);
        if (msg?.ImagePath == null) return NotFound(new { detail = "Gambar tidak ditemukan" });

        var path = Path.Combine(_uploadDir, msg.ImagePath);
        if (!System.IO.File.Exists(path)) return NotFound(new { detail = "File gambar tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        return File(bytes, ChatImageStorage.ContentTypeFor(msg.ImagePath));
    }
}
