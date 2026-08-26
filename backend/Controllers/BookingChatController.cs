using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[ApiController]
[Route("api/booking-ruang/{bookingRuangId:int}/chat")]
public class BookingChatController : ApiControllerBase
{
    private readonly AppDbContext _db;

    public BookingChatController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    private async Task MarkRead(int bookingRuangId, int userId, DateTime at)
    {
        var read = await _db.BookingChatReads.FirstOrDefaultAsync(r => r.BookingRuangId == bookingRuangId && r.UserId == userId);
        if (read == null)
        {
            _db.BookingChatReads.Add(new BookingChatRead { BookingRuangId = bookingRuangId, UserId = userId, LastReadAt = at });
        }
        else
        {
            read.LastReadAt = at;
        }
    }

    [HttpGet("")]
    public async Task<IActionResult> List(int bookingRuangId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.BookingRuangs.FindAsync(bookingRuangId);
        if (item == null) return NotFound(new { detail = "Booking tidak ditemukan" });
        if (!CanAccessBookingRuang(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var messages = await _db.BookingChatMessages
            .Include(m => m.Sender)
            .Where(m => m.BookingRuangId == bookingRuangId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatMessageOut(m.Id, m.SenderId, m.Sender.Nama, m.Sender.Role, m.Message, m.CreatedAt))
            .ToListAsync();

        // Reading happens strictly after every message already stored was created, so "now" is a safe read cursor here.
        await MarkRead(bookingRuangId, user!.Id, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("")]
    public async Task<IActionResult> Send(int bookingRuangId, [FromBody] SendChatMessageRequest payload)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.BookingRuangs.FindAsync(bookingRuangId);
        if (item == null) return NotFound(new { detail = "Booking tidak ditemukan" });
        if (!CanAccessBookingRuang(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var text = payload.Message?.Trim();
        if (string.IsNullOrEmpty(text))
            return BadRequest(new { detail = "Pesan tidak boleh kosong" });

        var message = new BookingChatMessage
        {
            BookingRuangId = bookingRuangId,
            SenderId = user!.Id,
            Message = text,
        };
        _db.BookingChatMessages.Add(message);
        await _db.SaveChangesAsync();

        // No read-cursor update here - the sender's own messages are excluded from the unread
        // count by SenderId (see BookingRuangController.List), not by advancing this cursor past
        // them. Advancing it to "now" on send would also sweep up any other user's message that
        // happened to arrive moments earlier but hasn't been loaded into this user's view yet,
        // silently marking it read before they ever saw it.

        return StatusCode(201, new ChatMessageOut(message.Id, user.Id, user.Nama, user.Role, message.Message, message.CreatedAt));
    }
}
