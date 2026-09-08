using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Hubs;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// The one global setting in the app: which sound plays for chat notifications vs. workflow
// (transaction/approval) notifications, chosen by Superadmin from a fixed list of 20 presets
// (see frontend/src/lib/notificationSound.ts's SOUND_PRESETS - this list must stay in sync with
// that one). There is no per-user override; every logged-in user reads the same singleton row.
[Route("api/notification-settings")]
public class NotificationSettingsController : ApiControllerBase
{
    private static readonly HashSet<string> ValidSoundIds = new()
    {
        "ding", "pop", "bell", "marimba", "chime", "alert", "soft", "digital", "harp", "pulse",
        "xylophone", "arpeggio", "buzz", "whistle", "knock", "sparkle", "drop", "beep", "coin", "zen",
    };

    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;

    public NotificationSettingsController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub) : base(currentUser)
    {
        _db = db;
        _hub = hub;
    }

    private async Task<NotificationSoundSettings> GetOrCreateAsync()
    {
        var settings = await _db.NotificationSoundSettings.FindAsync(1);
        if (settings != null) return settings;
        // Only reachable if the Program.cs seed insert somehow never ran - falls back to the
        // same defaults as that seed so the app never has to handle a "no settings row" case.
        settings = new NotificationSoundSettings { Id = 1, ChatSoundId = "ding", ActivitySoundId = "pop", UpdatedAt = DateTime.UtcNow };
        _db.NotificationSoundSettings.Add(settings);
        await _db.SaveChangesAsync();
        return settings;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var (_, error) = await RequireRoleAsync();
        if (error != null) return error;
        var settings = await GetOrCreateAsync();
        return Ok(new NotificationSoundSettingsOut(settings.ChatSoundId, settings.ActivitySoundId));
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateNotificationSoundSettingsRequest request)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;
        if (!ValidSoundIds.Contains(request.ChatSoundId) || !ValidSoundIds.Contains(request.ActivitySoundId))
            return BadRequest(new { detail = "Pilihan suara tidak valid" });

        var settings = await GetOrCreateAsync();
        settings.ChatSoundId = request.ChatSoundId;
        settings.ActivitySoundId = request.ActivitySoundId;
        settings.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var result = new NotificationSoundSettingsOut(settings.ChatSoundId, settings.ActivitySoundId);
        // Broadcast to every connection (not just a recipient list like the chat/activity
        // notifications above) - this setting isn't scoped to who can see one item, it's global.
        await _hub.Clients.All.SendAsync("ReceiveNotificationSettingsChanged", result);
        return Ok(result);
    }
}
