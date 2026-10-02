using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Infrastructure;
using Microsoft.Extensions.Options;
using PengirimanApi.Models;

namespace PengirimanApi.Services;

public class GaasAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly CurrentUserService _currentUser;

    public const string SchemeName = "GAAS_Auth";

    public GaasAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        CurrentUserService currentUser)
        : base(options, logger, encoder)
    {
        _currentUser = currentUser;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null)
        {
            return AuthenticateResult.NoResult();
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Nama),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("username", user.Username),
            new("role", user.Role.ToString()),
        };

        if (!string.IsNullOrEmpty(user.Direktorat)) claims.Add(new("direktorat", user.Direktorat));
        if (!string.IsNullOrEmpty(user.Divisi)) claims.Add(new("divisi", user.Divisi));
        if (!string.IsNullOrEmpty(user.Departemen)) claims.Add(new("departemen", user.Departemen));

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return AuthenticateResult.Success(ticket);
    }

    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        Response.ContentType = "application/json";
        await Response.WriteAsync(JsonSerializer.Serialize(new { detail = "Belum login" }));
    }

    protected override async Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        Response.ContentType = "application/json";
        await Response.WriteAsync(JsonSerializer.Serialize(new { detail = "Tidak memiliki akses" }));
    }
}

// Custom role handler so that RoleEnum.SUPER_ADMIN automatically passes every [Authorize(Roles = "...")] check,
// preserving the app's deliberate rule: "Super Admin passes every allowlist unconditionally".
public class SuperAdminRoleAuthorizationHandler : AuthorizationHandler<RolesAuthorizationRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, RolesAuthorizationRequirement requirement)
    {
        if (context.User.IsInRole(RoleEnum.SUPER_ADMIN.ToString()))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        if (requirement.AllowedRoles.Any(role => context.User.IsInRole(role)))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
