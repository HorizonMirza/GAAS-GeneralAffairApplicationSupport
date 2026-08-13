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

public record DivisiOut(string Nama, List<string> Departemen);

public record DirektoratOut(string Nama, List<DivisiOut> Divisi);

public record OrgStructureResponse(
    List<string> Direktorat,
    List<string> Divisi,
    List<string> Departemen,
    List<DirektoratOut> DirektoratTree
);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
