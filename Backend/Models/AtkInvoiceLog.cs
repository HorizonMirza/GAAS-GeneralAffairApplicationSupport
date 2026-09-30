namespace PengirimanApi.Models;

public class AtkInvoiceLog
{
    public int Id { get; set; }
    public int AtkInvoiceId { get; set; }
    public string Action { get; set; } = null!;
    public int? ActorId { get; set; }
    public string? Reason { get; set; }
    public string? FilePath { get; set; }
    public string? OriginalFilename { get; set; }
    public DateTime CreatedAt { get; set; }

    public AtkInvoice AtkInvoice { get; set; } = null!;
    public User? Aktor { get; set; }
}
