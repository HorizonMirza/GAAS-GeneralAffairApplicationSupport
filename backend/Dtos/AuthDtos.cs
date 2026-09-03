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
    string? Departemen,
    string? NoHp,
    string? Email,
    bool HasPhoto,
    bool HasCoverPhoto,
    string? CoverPreset
)
{
    public static MeResponse From(User user) => new(
        user.Id,
        user.Username,
        user.Nama,
        user.Role,
        user.Direktorat,
        user.Divisi,
        user.Departemen,
        user.NoHp,
        user.Email,
        user.PhotoPath != null,
        user.CoverPhotoPath != null,
        user.CoverPreset
    );
}

public record DivisiOut(string Nama, List<string> Departemen);

public record DirektoratOut(string Nama, List<DivisiOut> Divisi);

public record OrgStructureResponse(
    List<string> Direktorat,
    List<string> Divisi,
    List<string> Departemen,
    List<DirektoratOut> DirektoratTree
);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record UpdateProfileRequest(string Nama, string Username, string? NoHp, string? Email, string? CurrentPassword);

public record UpdateCoverPresetRequest(string Preset);
