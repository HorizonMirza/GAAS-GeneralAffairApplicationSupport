using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public record LoginRequest(string Username, string Password);

public record MeResponse(
    int Id,
    string Username,
    string Nama,
    RoleEnum Role,
    string? Direktorat,
    string? Divisi,
    string? Departemen
);

public record OrgStructureResponse(
    List<string> Direktorat,
    List<string> Divisi,
    List<string> Departemen
);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
