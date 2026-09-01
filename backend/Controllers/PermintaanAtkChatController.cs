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
[Route("api/permintaan-atk/{permintaanAtkId:int}/chat")]
public class PermintaanAtkChatController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;

    public PermintaanAtkChatController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub) : base(currentUser)
    {
        _db = db;
        _hub = hub;
    }

    private async Task MarkRead(int permintaanAtkId, int userId, DateTime at)
    {
        var read = await _db.PermintaanAtkChatReads.FirstOrDefaultAsync(r => r.PermintaanAtkId == permintaanAtkId && r.UserId == userId);
        if (read == null)
        {
            _db.PermintaanAtkChatReads.Add(new PermintaanAtkChatRead { PermintaanAtkId = permintaanAtkId, UserId = userId, LastReadAt = at });
        }
        else
        {
            read.LastReadAt = at;
        }
    }

    [HttpGet("")]
    public async Task<IActionResult> List(int permintaanAtkId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PermintaanAtks.FindAsync(permintaanAtkId);
        if (item == null) return NotFound(new { detail = "Permintaan tidak ditemukan" });
        if (!CanAccessPermintaanAtk(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var messages = await _db.PermintaanAtkChatMessages
            .Include(m => m.Sender)
            .Where(m => m.PermintaanAtkId == permintaanAtkId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatMessageOut(m.Id, m.SenderId, m.Sender.Nama, m.Sender.Role, m.Message, m.CreatedAt))
            .ToListAsync();

        await MarkRead(permintaanAtkId, user!.Id, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("")]
    public async Task<IActionResult> Send(int permintaanAtkId, [FromBody] SendChatMessageRequest payload)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PermintaanAtks.FindAsync(permintaanAtkId);
        if (item == null) return NotFound(new { detail = "Permintaan tidak ditemukan" });
        if (!CanAccessPermintaanAtk(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var text = payload.Message?.Trim();
        if (string.IsNullOrEmpty(text))
            return BadRequest(new { detail = "Pesan tidak boleh kosong" });

        var message = new PermintaanAtkChatMessage
        {
            PermintaanAtkId = permintaanAtkId,
            SenderId = user!.Id,
            Message = text,
        };
        _db.PermintaanAtkChatMessages.Add(message);
        await _db.SaveChangesAsync();

        var outMessage = new ChatMessageOut(message.Id, user.Id, user.Nama, user.Role, message.Message, message.CreatedAt);
        await _hub.Clients.Group(ChatHub.AtkGroup(permintaanAtkId)).SendAsync("ReceiveAtkMessage", outMessage);

        var recipientIds = await _db.Users.Where(u => u.Id != user.Id).ToListAsync();
        await BroadcastChatNotificationAsync(
            _hub,
            recipientIds.Where(u => CanAccessPermintaanAtk(u, item)).Select(u => u.Id),
            "atk",
            permintaanAtkId,
            $"{item.Keperluan} - {item.NomorPermintaan ?? "#" + permintaanAtkId}",
            user.Nama,
            text);

        return StatusCode(201, outMessage);
    }
}
