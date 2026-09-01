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

    public BookingKendaraanChatController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub) : base(currentUser)
    {
        _db = db;
        _hub = hub;
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
            .Select(m => new ChatMessageOut(m.Id, m.SenderId, m.Sender.Nama, m.Sender.Role, m.Message, m.CreatedAt))
            .ToListAsync();

        await MarkRead(bookingKendaraanId, user!.Id, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("")]
    public async Task<IActionResult> Send(int bookingKendaraanId, [FromBody] SendChatMessageRequest payload)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.BookingKendaraans.FindAsync(bookingKendaraanId);
        if (item == null) return NotFound(new { detail = "Booking tidak ditemukan" });
        if (!CanAccessBookingKendaraan(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var text = payload.Message?.Trim();
        if (string.IsNullOrEmpty(text))
            return BadRequest(new { detail = "Pesan tidak boleh kosong" });

        var message = new BookingKendaraanChatMessage
        {
            BookingKendaraanId = bookingKendaraanId,
            SenderId = user!.Id,
            Message = text,
        };
        _db.BookingKendaraanChatMessages.Add(message);
        await _db.SaveChangesAsync();

        var outMessage = new ChatMessageOut(message.Id, user.Id, user.Nama, user.Role, message.Message, message.CreatedAt);
        await _hub.Clients.Group(ChatHub.KendaraanGroup(bookingKendaraanId)).SendAsync("ReceiveKendaraanMessage", outMessage);

        var recipientIds = await _db.Users.Where(u => u.Id != user.Id).ToListAsync();
        await BroadcastChatNotificationAsync(
            _hub,
            recipientIds.Where(u => CanAccessBookingKendaraan(u, item)).Select(u => u.Id),
            "kendaraan",
            bookingKendaraanId,
            $"{item.NamaKendaraan} - {item.NomorPemesanan ?? item.PlatNomor ?? "-"}",
            user.Nama,
            text);

        return StatusCode(201, outMessage);
    }
}
