using Microsoft.AspNetCore.Mvc;
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

    protected async Task<(User? user, IActionResult? error)> RequireRoleAsync(params RoleEnum[] roles)
    {
        var user = await CurrentUser.GetCurrentUserAsync();
        if (user == null) return (null, StatusCode(401, new { detail = "Belum login" }));
        if (roles.Length > 0 && !roles.Contains(user.Role))
            return (null, StatusCode(403, new { detail = "Tidak memiliki akses" }));
        return (user, null);
    }

    // Admin/Approval GA/KPU/Super Admin see every item; Admin/Approval Departemen/Divisi only
    // see items from their own unit (or their own DRAFT/rejected-back-to-them items).
    protected static bool CanAccessPengiriman(User user, Pengiriman item)
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

    protected static bool CanAccessBookingRuang(User user, BookingRuang item)
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
}
