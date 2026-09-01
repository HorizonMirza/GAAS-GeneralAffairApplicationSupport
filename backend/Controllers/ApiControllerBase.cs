using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Dtos;
using PengirimanApi.Hubs;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected readonly CurrentUserService CurrentUser;

    protected ApiControllerBase(CurrentUserService currentUser)
    {
        CurrentUser = currentUser;
    }

    // Pushed app-wide (every recipient's personal ChatHub.UserGroup) right after a *ChatController
    // saves a message, on top of that thread's own group broadcast - lets a global listener
    // (frontend AppShell) show a WhatsApp-style banner/sound for anyone who can see the item,
    // whether or not they have that specific chat thread (or that page at all) open. Recipients
    // is every user CanAccessX(...) already lets in, minus the sender - reuses the exact same
    // visibility rule as the join check instead of a separate notion of "who gets notified".
    protected static async Task BroadcastChatNotificationAsync(
        IHubContext<ChatHub> hub,
        IEnumerable<int> recipientUserIds,
        string kind,
        int itemId,
        string itemLabel,
        string senderNama,
        string message)
    {
        var recipients = recipientUserIds.ToList();
        if (recipients.Count == 0) return;
        var preview = message.Length > 120 ? message[..120] + "…" : message;
        var notification = new ChatNotificationOut(kind, itemId, itemLabel, senderNama, preview, DateTime.UtcNow);
        await hub.Clients.Groups(recipients.Select(ChatHub.UserGroup).ToList()).SendAsync("ReceiveChatNotification", notification);
    }

    // Same recipient-targeting idea as BroadcastChatNotificationAsync, but for a workflow event
    // (a new transaction submitted, or an approve/reject step) instead of a chat message - pushed
    // on "ReceiveActivityNotification" so the frontend can play a different sound for it. Called
    // once per real user action, after the triggering SaveChangesAsync succeeds - never from
    // inside a per-series-member loop (a recurring booking's Submit/Approve still only fires one
    // notification for the whole action, not one per occurrence).
    protected static async Task BroadcastActivityNotificationAsync(
        IHubContext<ChatHub> hub,
        IEnumerable<int> recipientUserIds,
        string type,
        string kind,
        int itemId,
        string itemLabel,
        string actorNama,
        string message)
    {
        var recipients = recipientUserIds.ToList();
        if (recipients.Count == 0) return;
        var notification = new ActivityNotificationOut(type, kind, itemId, itemLabel, actorNama, message, DateTime.UtcNow);
        await hub.Clients.Groups(recipients.Select(ChatHub.UserGroup).ToList()).SendAsync("ReceiveActivityNotification", notification);
    }

    // Wraps SaveChangesAsync for approve/reject endpoints guarded by an IsConcurrencyToken
    // property (Pengiriman.Status, Invoice.Status): if another request already changed that row
    // between this request's read and its save, EF throws DbUpdateConcurrencyException instead
    // of silently overwriting - this turns that into a clean 409 the caller can show and retry
    // from, instead of a duplicate approval log or a lost update.
    protected async Task<IActionResult?> TrySaveChangesAsync(DbContext db)
    {
        try
        {
            await db.SaveChangesAsync();
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return StatusCode(409, new { detail = "Data sudah diubah oleh pengguna lain. Muat ulang halaman dan coba lagi." });
        }
    }

    protected async Task<(User? user, IActionResult? error)> RequireRoleAsync(params RoleEnum[] roles)
    {
        var user = await CurrentUser.GetCurrentUserAsync();
        if (user == null) return (null, StatusCode(401, new { detail = "Belum login" }));
        if (roles.Length > 0 && !roles.Contains(user.Role))
            return (null, StatusCode(403, new { detail = "Tidak memiliki akses" }));
        return (user, null);
    }

    // Like RequireRoleAsync, but as a denylist instead of an allowlist - for endpoints meant to
    // stay open to "everyone except role X" (e.g. Room Booking read/chat endpoints excluding KPU,
    // who only deals with Expedition per AppShell's KPU_HIDDEN_CATEGORIES) without having to spell
    // out every other role by hand.
    protected async Task<(User? user, IActionResult? error)> RequireRoleExceptAsync(params RoleEnum[] excludedRoles)
    {
        var user = await CurrentUser.GetCurrentUserAsync();
        if (user == null) return (null, StatusCode(401, new { detail = "Belum login" }));
        if (excludedRoles.Contains(user.Role))
            return (null, StatusCode(403, new { detail = "Tidak memiliki akses" }));
        return (user, null);
    }

    // Admin/Approval GA/KPU/Super Admin see every item; Admin/Approval Departemen/Divisi only
    // see items from their own unit (or their own DRAFT/rejected-back-to-them items). Public (not
    // just protected) so ChatHub - which can't inherit this class, Hub already has its own base -
    // can reuse the exact same rule instead of duplicating it when deciding whether to let a
    // connection join a chat's SignalR group.
    public static bool CanAccessPengiriman(User user, Pengiriman item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        var sameUnit = item.Departemen != null
            ? user.Departemen == item.Departemen
            : user.Divisi == item.Divisi && user.Departemen == null;
        return item.Status == StatusEnum.DRAFT
            ? item.CreatedBy == user.Id || (item.RejectReason != null && sameUnit)
            : sameUnit;
    }

    // Public for the same reason as CanAccessPengiriman above - reused by ChatHub.
    public static bool CanAccessBookingRuang(User user, BookingRuang item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        var sameUnit = item.Departemen != null
            ? user.Departemen == item.Departemen
            : user.Divisi == item.Divisi && user.Departemen == null;
        // Unlike Pengiriman, a rejected BookingRuang is a dead end - it's never sent back to
        // DRAFT for revision (see IsEditableByOrigin), so a DRAFT item here can only be its
        // creator's own not-yet-submitted draft.
        return item.Status == BookingStatusEnum.DRAFT
            ? item.CreatedBy == user.Id
            : sameUnit;
    }

    // Same rule as CanAccessBookingRuang, and public for the same reason - ChatHub reuses it.
    public static bool CanAccessPerbaikanSarana(User user, PerbaikanSarana item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        var sameUnit = item.Departemen != null
            ? user.Departemen == item.Departemen
            : user.Divisi == item.Divisi && user.Departemen == null;
        return item.Status == BookingStatusEnum.DRAFT
            ? item.CreatedBy == user.Id
            : sameUnit;
    }

    // Same rule as CanAccessBookingRuang, and public for the same reason - ChatHub reuses it.
    public static bool CanAccessPermintaanAtk(User user, PermintaanAtk item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        var sameUnit = item.Departemen != null
            ? user.Departemen == item.Departemen
            : user.Divisi == item.Divisi && user.Departemen == null;
        return item.Status == StatusEnum.DRAFT
            ? item.CreatedBy == user.Id
            : sameUnit;
    }

    // Same rule as CanAccessBookingRuang, and public for the same reason - ChatHub reuses it.
    public static bool CanAccessBookingKendaraan(User user, BookingKendaraan item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        var sameUnit = item.Departemen != null
            ? user.Departemen == item.Departemen
            : user.Divisi == item.Divisi && user.Departemen == null;
        return item.Status == BookingStatusEnum.DRAFT
            ? item.CreatedBy == user.Id
            : sameUnit;
    }
}
