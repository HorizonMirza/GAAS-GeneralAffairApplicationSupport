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
[Route("api/permintaan-arsip/{permintaanArsipId:int}/chat")]
public class PermintaanArsipChatController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;

    public PermintaanArsipChatController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub) : base(currentUser)
    {
        _db = db;
        _hub = hub;
    }

    private async Task MarkRead(int permintaanArsipId, int userId, DateTime at)
    {
        var read = await _db.PermintaanArsipChatReads.FirstOrDefaultAsync(r => r.PermintaanArsipId == permintaanArsipId && r.UserId == userId);
        if (read == null)
        {
            _db.PermintaanArsipChatReads.Add(new PermintaanArsipChatRead { PermintaanArsipId = permintaanArsipId, UserId = userId, LastReadAt = at });
        }
        else
        {
            read.LastReadAt = at;
        }
    }

    [HttpGet("")]
    public async Task<IActionResult> List(int permintaanArsipId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PermintaanArsips.FindAsync(permintaanArsipId);
        if (item == null) return NotFound(new { detail = "Permintaan tidak ditemukan" });
        if (!CanAccessPermintaanArsip(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var messages = await _db.PermintaanArsipChatMessages
            .Include(m => m.Sender)
            .Where(m => m.PermintaanArsipId == permintaanArsipId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatMessageOut(m.Id, m.SenderId, m.Sender.Nama, m.Sender.Role, m.Message, m.CreatedAt))
            .ToListAsync();

        await MarkRead(permintaanArsipId, user!.Id, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("")]
    public async Task<IActionResult> Send(int permintaanArsipId, [FromBody] SendChatMessageRequest payload)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PermintaanArsips.FindAsync(permintaanArsipId);
        if (item == null) return NotFound(new { detail = "Permintaan tidak ditemukan" });
        if (!CanAccessPermintaanArsip(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var text = payload.Message?.Trim();
        if (string.IsNullOrEmpty(text))
            return BadRequest(new { detail = "Pesan tidak boleh kosong" });

        var message = new PermintaanArsipChatMessage
        {
            PermintaanArsipId = permintaanArsipId,
            SenderId = user!.Id,
            Message = text,
        };
        _db.PermintaanArsipChatMessages.Add(message);
        await _db.SaveChangesAsync();

        var outMessage = new ChatMessageOut(message.Id, user.Id, user.Nama, user.Role, message.Message, message.CreatedAt);
        await _hub.Clients.Group(ChatHub.ArsipGroup(permintaanArsipId)).SendAsync("ReceiveArsipMessage", outMessage);

        var recipientIds = await _db.Users.Where(u => u.Id != user.Id).ToListAsync();
        await BroadcastChatNotificationAsync(
            _hub,
            recipientIds.Where(u => CanAccessPermintaanArsip(u, item)).Select(u => u.Id),
            "arsip",
            permintaanArsipId,
            $"{item.Keperluan} - {item.NomorArsip ?? "#" + permintaanArsipId}",
            user.Nama,
            text);

        return StatusCode(201, outMessage);
    }
}
