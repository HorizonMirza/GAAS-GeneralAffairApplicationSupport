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
[Route("api/perbaikan-sarana/{perbaikanSaranaId:int}/chat")]
public class PerbaikanSaranaChatController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;

    public PerbaikanSaranaChatController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub) : base(currentUser)
    {
        _db = db;
        _hub = hub;
    }

    private async Task MarkRead(int perbaikanSaranaId, int userId, DateTime at)
    {
        var read = await _db.PerbaikanSaranaChatReads.FirstOrDefaultAsync(r => r.PerbaikanSaranaId == perbaikanSaranaId && r.UserId == userId);
        if (read == null)
        {
            _db.PerbaikanSaranaChatReads.Add(new PerbaikanSaranaChatRead { PerbaikanSaranaId = perbaikanSaranaId, UserId = userId, LastReadAt = at });
        }
        else
        {
            read.LastReadAt = at;
        }
    }

    [HttpGet("")]
    public async Task<IActionResult> List(int perbaikanSaranaId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PerbaikanSaranas.FindAsync(perbaikanSaranaId);
        if (item == null) return NotFound(new { detail = "Laporan tidak ditemukan" });
        if (!CanAccessPerbaikanSarana(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var messages = await _db.PerbaikanSaranaChatMessages
            .Include(m => m.Sender)
            .Where(m => m.PerbaikanSaranaId == perbaikanSaranaId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ChatMessageOut(m.Id, m.SenderId, m.Sender.Nama, m.Sender.Role, m.Message, m.CreatedAt))
            .ToListAsync();

        await MarkRead(perbaikanSaranaId, user!.Id, DateTime.UtcNow);
        await _db.SaveChangesAsync();

        return Ok(messages);
    }

    [HttpPost("")]
    public async Task<IActionResult> Send(int perbaikanSaranaId, [FromBody] SendChatMessageRequest payload)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PerbaikanSaranas.FindAsync(perbaikanSaranaId);
        if (item == null) return NotFound(new { detail = "Laporan tidak ditemukan" });
        if (!CanAccessPerbaikanSarana(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var text = payload.Message?.Trim();
        if (string.IsNullOrEmpty(text))
            return BadRequest(new { detail = "Pesan tidak boleh kosong" });

        var message = new PerbaikanSaranaChatMessage
        {
            PerbaikanSaranaId = perbaikanSaranaId,
            SenderId = user!.Id,
            Message = text,
        };
        _db.PerbaikanSaranaChatMessages.Add(message);
        await _db.SaveChangesAsync();

        var outMessage = new ChatMessageOut(message.Id, user.Id, user.Nama, user.Role, message.Message, message.CreatedAt);
        await _hub.Clients.Group(ChatHub.SaranaGroup(perbaikanSaranaId)).SendAsync("ReceiveSaranaMessage", outMessage);

        return StatusCode(201, outMessage);
    }
}
