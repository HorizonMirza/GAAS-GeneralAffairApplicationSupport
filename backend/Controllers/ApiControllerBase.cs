using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    // Admin/Approval GA/KPU/Super Admin see every item; Admin/Approval Departemen only see items
    // from their own Departemen (or their own DRAFT/rejected-back-to-them items). Admin/Approval
    // Divisi see their own Divisi-level items the same way, PLUS every child Departemen's items
    // under their Divisi read-only for oversight - once those are out of DRAFT (a child
    // Departemen's own team still owns its drafts-in-progress, and only that Departemen's own
    // Approval account can actually approve/reject it, see RequireL1ActorAsync). Public (not just
    // protected) so ChatHub - which can't inherit this class, Hub already has its own base - can
    // reuse the exact same rule instead of duplicating it when deciding whether to let a
    // connection join a chat's SignalR group.
    public static bool CanAccessPengiriman(User user, Pengiriman item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        if (user.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            if (item.Divisi != user.Divisi) return false;
            if (item.Departemen != null) return item.Status != StatusEnum.DRAFT;
            return item.Status == StatusEnum.DRAFT
                ? item.CreatedBy == user.Id || item.RejectReason != null
                : true;
        }

        var sameDepartemen = user.Departemen == item.Departemen;
        return item.Status == StatusEnum.DRAFT
            ? item.CreatedBy == user.Id || (item.RejectReason != null && sameDepartemen)
            : sameDepartemen;
    }

    // Public for the same reason as CanAccessPengiriman above - reused by ChatHub. Unlike
    // Pengiriman, a rejected BookingRuang is a dead end - it's never sent back to DRAFT for
    // revision (see IsEditableByOrigin), so a DRAFT item here can only be its creator's own
    // not-yet-submitted draft (no RejectReason exception needed).
    public static bool CanAccessBookingRuang(User user, BookingRuang item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        if (user.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            if (item.Divisi != user.Divisi) return false;
            if (item.Departemen != null) return item.Status != BookingStatusEnum.DRAFT;
            return item.Status == BookingStatusEnum.DRAFT ? item.CreatedBy == user.Id : true;
        }

        var sameDepartemen = user.Departemen == item.Departemen;
        return item.Status == BookingStatusEnum.DRAFT ? item.CreatedBy == user.Id : sameDepartemen;
    }

    // Same rule as CanAccessBookingRuang, and public for the same reason - ChatHub reuses it.
    public static bool CanAccessPerbaikanSarana(User user, PerbaikanSarana item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        if (user.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            if (item.Divisi != user.Divisi) return false;
            if (item.Departemen != null) return item.Status != BookingStatusEnum.DRAFT;
            return item.Status == BookingStatusEnum.DRAFT ? item.CreatedBy == user.Id : true;
        }

        var sameDepartemen = user.Departemen == item.Departemen;
        return item.Status == BookingStatusEnum.DRAFT ? item.CreatedBy == user.Id : sameDepartemen;
    }

    // Same rule as CanAccessBookingRuang, and public for the same reason - ChatHub reuses it.
    public static bool CanAccessPermintaanAtk(User user, PermintaanAtk item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        if (user.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            if (item.Divisi != user.Divisi) return false;
            if (item.Departemen != null) return item.Status != BookingStatusEnum.DRAFT;
            return item.Status == BookingStatusEnum.DRAFT ? item.CreatedBy == user.Id : true;
        }

        var sameDepartemen = user.Departemen == item.Departemen;
        return item.Status == BookingStatusEnum.DRAFT ? item.CreatedBy == user.Id : sameDepartemen;
    }

    // Same rule as CanAccessBookingRuang, and public for the same reason - ChatHub reuses it.
    public static bool CanAccessBookingKendaraan(User user, BookingKendaraan item)
    {
        if (user.Role is not (RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI))
            return true;

        if (user.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            if (item.Divisi != user.Divisi) return false;
            if (item.Departemen != null) return item.Status != BookingStatusEnum.DRAFT;
            return item.Status == BookingStatusEnum.DRAFT ? item.CreatedBy == user.Id : true;
        }

        var sameDepartemen = user.Departemen == item.Departemen;
        return item.Status == BookingStatusEnum.DRAFT ? item.CreatedBy == user.Id : sameDepartemen;
    }
}
