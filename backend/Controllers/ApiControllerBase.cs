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
}
