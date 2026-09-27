namespace PengirimanApi.Models;

public class AtkInvoiceChatMessage
{
    public int Id { get; set; }
    public int AtkInvoiceId { get; set; }
    public int SenderId { get; set; }
    public string Message { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public AtkInvoice AtkInvoice { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
