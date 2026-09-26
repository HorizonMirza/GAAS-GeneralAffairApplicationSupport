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
        int senderId,
        string senderNama,
        string senderRole,
        string message)
    {
        var recipients = recipientUserIds.ToList();
        if (recipients.Count == 0) return;
        var preview = message.Length > 120 ? message[..120] + "…" : message;
        var notification = new ChatNotificationOut(kind, itemId, itemLabel, senderId, senderNama, senderRole, preview, DateTime.UtcNow);
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
        int actorId,
        string actorNama,
        string actorRole,
        string message)
    {
        var recipients = recipientUserIds.ToList();
        if (recipients.Count == 0) return;
        var notification = new ActivityNotificationOut(type, kind, itemId, itemLabel, actorId, actorNama, actorRole, message, DateTime.UtcNow);
        await hub.Clients.Groups(recipients.Select(ChatHub.UserGroup).ToList()).SendAsync("ReceiveActivityNotification", notification);
    }

    // Wraps SaveChangesAsync for approve/reject endpoints guarded by an IsConcurrencyToken
    // status property: if another request already changed that row
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

    // Serializes concurrent DB work for one logical resource (e.g. "ruang|Serbaguna|2026-09-08")
    // for the lifetime of the CURRENT transaction - pg_advisory_xact_lock blocks a second caller
    // locking the same key until this transaction commits or rolls back, and releases
    // automatically at that point (no explicit unlock needed). Only closes a check-then-act race
    // ("read whether a conflict exists, then write a confirming status") when the caller has
    // already opened an explicit transaction spanning both the check and the write - called
    // without one, the lock is released right after this single statement and gives no
    // protection at all, since Npgsql auto-commits a statement that isn't inside a BEGIN.
    protected static async Task LockResourceAsync(DbContext db, string resourceKey) =>
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({resourceKey}, 0))");

    // true when `ex` is a Postgres unique-constraint violation (SqlState 23505) - the race that
    // slips past an app-level "AnyAsync(name already exists)" pre-check: two requests can both
    // pass that check before either commits, so the DB's own UNIQUE index is what actually
    // catches the second one, as a thrown exception rather than a clean result. Callers wrap the
    // SaveChangesAsync that follows a create/rename in a try/catch on DbUpdateException and check
    // this before deciding it really is a duplicate-name conflict (a 400/409) rather than some
    // other failure that should keep surfacing as an unhandled 500.
    protected static bool IsUniqueConstraintViolation(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation };

    // Queues one deletion_log row (see Models/DeletionLog.cs) - called right before the row(s) it
    // describes are actually removed, in every SuperAdminDelete/SuperAdminBulkDelete across the
    // seven modules that have one. Not saved here - it rides along in the same SaveChangesAsync
    // (or, for the six bulk deletes that use ExecuteDeleteAsync, the same request) as the deletion
    // itself, so a failed delete never leaves an orphaned log row behind.
    protected static void LogDeletion(AppDbContext db, string modul, int itemId, string? itemNomor, User actor, string? filterSummary = null)
    {
        db.DeletionLogs.Add(new DeletionLog
        {
            Modul = modul,
            ItemId = itemId,
            ItemNomor = itemNomor,
            DeletedBy = actor.Id,
            DeletedByNama = actor.Nama,
            FilterSummary = filterSummary,
        });
    }

    // Short human-readable summary of whatever filters a bulk-delete request actually carried
    // ("status: REJECTED, divisi: Finance") - stored on each row's DeletionLog.FilterSummary so
    // the cross-module activity feed (RiwayatAktivitasController) can show why a batch of items
    // went, not just how many.
    protected static string? BuildFilterSummary(params (string Key, string? Value)[] filters)
    {
        var parts = filters.Where(f => !string.IsNullOrEmpty(f.Value)).Select(f => $"{f.Key}: {f.Value}").ToList();
        return parts.Count > 0 ? string.Join(", ", parts) : null;
    }

    protected async Task<(User? user, IActionResult? error)> RequireRoleAsync(params RoleEnum[] roles)
    {
        var user = await CurrentUser.GetCurrentUserAsync();
        if (user == null) return (null, StatusCode(401, new { detail = "Belum login" }));
        // Super Admin passes every allowlist unconditionally - the one deliberate exception to
        // "allowlist means allowlist" in this whole app. This is what lets Super Admin perform any
        // tier's action (approve/reject/create/edit/KPU fields) across every module without this
        // method's ~90 call sites each needing their own bypass.
        if (user.Role == RoleEnum.SUPER_ADMIN) return (user, null);
        if (roles.Length > 0 && !roles.Contains(user.Role))
            return (null, StatusCode(403, new { detail = "Tidak memiliki akses" }));
        return (user, null);
    }

    // Like RequireRoleAsync, but as a denylist instead of an allowlist - for endpoints meant to
    // stay open to "everyone except role X" (e.g. Room Booking read/chat endpoints excluding KPU,
    // whose workflows are Expedition and Office Supplies) without having to spell
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
    public static bool CanAccessPengiriman(AccessUser user, Pengiriman item)
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
    public static bool CanAccessBookingRuang(AccessUser user, BookingRuang item)
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
    public static bool CanAccessPerbaikanSarana(AccessUser user, PerbaikanSarana item)
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
    public static bool CanAccessPermintaanArsip(AccessUser user, PermintaanArsip item)
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
    public static bool CanAccessPermintaanAtk(AccessUser user, PermintaanAtk item)
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
    public static bool CanAccessBookingKendaraan(AccessUser user, BookingKendaraan item)
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
