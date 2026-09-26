using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public record AtkInvoiceReviewRequest(string? Catatan);

public record AtkInvoiceLogOut(
    int Id,
    string Action,
    string? ActorNama,
    RoleEnum? ActorRole,
    string? Reason,
    string? OriginalFilename,
    DateTime CreatedAt
);

public class AtkInvoiceOut
{
    public int Id { get; set; }
    public string Nama { get; set; } = null!;
    public string Bulan { get; set; } = null!;
    public string OriginalFilename { get; set; } = null!;
    public InvoiceStatusEnum Status { get; set; }
    public string? Catatan { get; set; }
    public int UploadedBy { get; set; }
    // Null unless the query that produced this AtkInvoice included Pengunggah (see
    // AtkInvoiceController.ListAtkInvoice) - mirrors InvoiceOut's own UploaderNama exactly.
    public string? UploaderNama { get; set; }
    public int? ReviewedBy { get; set; }
    public DateTime UploadedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public static AtkInvoiceOut From(AtkInvoice i) => new()
    {
        Id = i.Id,
        Nama = i.Nama,
        Bulan = i.Bulan,
        OriginalFilename = i.OriginalFilename,
        Status = i.Status,
        Catatan = i.Catatan,
        UploadedBy = i.UploadedBy,
        UploaderNama = i.Pengunggah?.Nama,
        ReviewedBy = i.ReviewedBy,
        UploadedAt = i.UploadedAt,
        ReviewedAt = i.ReviewedAt,
    };
}

public class AtkInvoiceListResponse
{
    public List<AtkInvoiceOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}
