namespace PengirimanApi.Models;

public class BookingChatRead
{
    public int Id { get; set; }
    public int BookingRuangId { get; set; }
    public int UserId { get; set; }
    public DateTime LastReadAt { get; set; }

    public BookingRuang BookingRuang { get; set; } = null!;
    public User User { get; set; } = null!;
}
