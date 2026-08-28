namespace PengirimanApi.Models;

public class ChatMessage
{
    public int Id { get; set; }
    public int PengirimanId { get; set; }
    public int SenderId { get; set; }
    public string Message { get; set; } = null!;
    public string? ImagePath { get; set; }
    public string? ImageOriginalFilename { get; set; }
    public DateTime CreatedAt { get; set; }

    public Pengiriman Pengiriman { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
