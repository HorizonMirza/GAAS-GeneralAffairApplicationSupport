namespace PengirimanApi.Models;

public class AtkInvoiceChatRead
{
    public int Id { get; set; }
    public int AtkInvoiceId { get; set; }
    public int UserId { get; set; }
    public DateTime LastReadAt { get; set; }

    public AtkInvoice AtkInvoice { get; set; } = null!;
    public User User { get; set; } = null!;
}
