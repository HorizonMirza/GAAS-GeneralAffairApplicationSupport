namespace PengirimanApi.Models;

public class InvoiceChatRead
{
    public int Id { get; set; }
    public int InvoiceId { get; set; }
    public int UserId { get; set; }
    public DateTime LastReadAt { get; set; }

    public Invoice Invoice { get; set; } = null!;
    public User User { get; set; } = null!;
}
