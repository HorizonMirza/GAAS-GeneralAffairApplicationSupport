using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public record AdminUserOut(
    int Id, string Username, string? Password, string Nama, RoleEnum Role,
    string? Direktorat, string? Divisi, string? Departemen,
    string? Email, string? NoHp, bool IsActive, bool MustChangePassword, DateTime CreatedAt)
{
    public static AdminUserOut From(User u) => new(
        u.Id, u.Username, u.PlainPassword ?? "123456789", u.Nama, u.Role, u.Direktorat, u.Divisi, u.Departemen,
        u.Email, u.NoHp, u.IsActive, u.MustChangePassword, u.CreatedAt);
}

public record AdminUserListResponse(List<AdminUserOut> Items, int Total, int Page, int Limit);

public record CreateUserRequest(
    string Username, string Nama, RoleEnum Role,
    string? Direktorat, string? Divisi, string? Departemen,
    string? Email, string? NoHp,
    string? Password = null);

// Partial update - a field left out of the JSON body (or sent as null) is left untouched, same as
// how every other field on the account it doesn't mention stays as it was. Username/PasswordHash
// deliberately aren't here - those go through their own endpoints (UsersAdminController's own
// convention, see its class comment).
//
// Divisi/Departemen can't reuse the same "null means untouched" convention as everything else
// above, because null is also the value that means "this account belongs to no unit" (GA/KPU/
// Super Admin accounts) - a caller sending null there is genuinely ambiguous between "leave it"
// and "clear it". ClearDivisi/ClearDepartemen resolve that: explicitly true clears the field to
// null regardless of what Divisi/Departemen itself carries, so the Edit form in SuperAdminUsersTab
// can actually unassign a user's unit instead of that edit silently no-op'ing.
public record UpdateUserRequest(
    string? Nama, string? Email, string? NoHp, RoleEnum? Role,
    string? Direktorat, string? Divisi, string? Departemen,
    bool ClearDivisi = false, bool ClearDepartemen = false,
    string? Password = null,
    string? NewPassword = null);

public record AdminPasswordConfirmRequest(string Password);

// One-time plaintext password - see ProvisionedAccountOut's own comment in OrgAdminDtos.cs, same
// idea.
public record CreatedUserOut(AdminUserOut User, string Password);

// A sensitive Super Admin action: CurrentPassword re-authenticates the operator, NewPassword is
// applied to the selected account, and MustChangePassword optionally turns it into a temporary
// credential that the user must replace at their next login.
public record AdminChangePasswordRequest(
    string CurrentPassword,
    string NewPassword,
    bool MustChangePassword = true);

// Mirrors LoginResponse's shape - the frontend routes "Login As" the same way a real login result
// would (dashboard, or the forced change-password screen).
public record ImpersonateResponse(string Message, string Role, bool MustChangePassword);
