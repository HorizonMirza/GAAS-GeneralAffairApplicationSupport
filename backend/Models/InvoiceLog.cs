namespace PengirimanApi.Models;

public class InvoiceLog
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public string Action { get; set; } = null!;
    public int? ActorId { get; set; }
    public string? Reason { get; set; }
    public string? FilePath { get; set; }
    public string? OriginalFilename { get; set; }
    public DateTime CreatedAt { get; set; }

    public Invoice Invoice { get; set; } = null!;
    public User? Aktor { get; set; }
}
