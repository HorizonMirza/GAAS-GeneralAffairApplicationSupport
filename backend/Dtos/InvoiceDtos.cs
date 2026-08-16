using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public record InvoiceReviewRequest(string? Catatan);

public record InvoiceLogOut(
    int Id,
    string Action,
    string? ActorNama,
    RoleEnum? ActorRole,
    string? Reason,
    string? OriginalFilename,
    DateTime CreatedAt
);

public class InvoiceOut
{
    public int Id { get; set; }
    public string Bulan { get; set; } = null!;
    public string OriginalFilename { get; set; } = null!;
    public InvoiceStatusEnum Status { get; set; }
    public string? Catatan { get; set; }
    public int UploadedBy { get; set; }
    public int? ReviewedBy { get; set; }
    public DateTime UploadedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public static InvoiceOut From(Invoice i) => new()
    {
        Id = i.Id,
        Bulan = i.Bulan,
        OriginalFilename = i.OriginalFilename,
        Status = i.Status,
        Catatan = i.Catatan,
        UploadedBy = i.UploadedBy,
        ReviewedBy = i.ReviewedBy,
        UploadedAt = i.UploadedAt,
        ReviewedAt = i.ReviewedAt,
    };
}
