namespace PengirimanApi.Models;

public class InvoiceChatMessage
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public int SenderId { get; set; }
    public string Message { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public Invoice Invoice { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
