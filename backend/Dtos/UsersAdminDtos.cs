using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

// Never carries PasswordHash - see UsersAdminController.List/Get.
public record AdminUserOut(
    int Id, string Username, string Nama, RoleEnum Role,
    string? Direktorat, string? Divisi, string? Departemen,
    string? Email, string? NoHp, bool IsActive, bool MustChangePassword, DateTime CreatedAt)
{
    public static AdminUserOut From(User u) => new(
        u.Id, u.Username, u.Nama, u.Role, u.Direktorat, u.Divisi, u.Departemen,
        u.Email, u.NoHp, u.IsActive, u.MustChangePassword, u.CreatedAt);
}

public record AdminUserListResponse(List<AdminUserOut> Items, int Total, int Page, int Limit);

public record CreateUserRequest(
    string Username, string Nama, RoleEnum Role,
    string? Direktorat, string? Divisi, string? Departemen,
    string? Email, string? NoHp);

// Partial update - a field left out of the JSON body (or sent as null) is left untouched, same as
// how every other field on the account it doesn't mention stays as it was. Username/PasswordHash
// deliberately aren't here - those go through their own endpoints (UsersAdminController's own
// convention, see its class comment).
public record UpdateUserRequest(
    string? Nama, string? Email, string? NoHp, RoleEnum? Role,
    string? Direktorat, string? Divisi, string? Departemen);

// One-time plaintext password - see ProvisionedAccountOut's own comment in OrgAdminDtos.cs, same
// idea.
public record CreatedUserOut(AdminUserOut User, string Password);
public record ResetPasswordOut(string Password);
