namespace PengirimanApi.Models;

public class BookingChatMessage
{
    public int Id { get; set; }
    public int BookingRuangId { get; set; }
    public int SenderId { get; set; }
    public string Message { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public BookingRuang BookingRuang { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
