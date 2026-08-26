namespace PengirimanApi.Models;

public class Invoice
{
    public int Id { get; set; }
    public string Bulan { get; set; } = null!;
    public string FilePath { get; set; } = null!;
    public string OriginalFilename { get; set; } = null!;
    public InvoiceStatusEnum Status { get; set; } = InvoiceStatusEnum.DRAFT;
    public string? Catatan { get; set; }

    public int UploadedBy { get; set; }
    public int? ReviewedBy { get; set; }

    public DateTime UploadedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public User Pengunggah { get; set; } = null!;
    public User? Peninjau { get; set; }

    public ICollection<InvoiceLog> Logs { get; set; } = new List<InvoiceLog>();
}
