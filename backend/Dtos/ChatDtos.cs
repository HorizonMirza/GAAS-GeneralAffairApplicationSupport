using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public record ChatMessageOut(
    int Id,
    int SenderId,
    string SenderNama,
    RoleEnum SenderRole,
    string Message,
    bool HasImage,
    DateTime CreatedAt
);
