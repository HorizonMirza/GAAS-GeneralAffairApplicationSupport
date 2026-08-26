namespace PengirimanApi.Models;

public class BookingKendaraanChatMessage
{
    public int Id { get; set; }
    public int BookingKendaraanId { get; set; }
    public int SenderId { get; set; }
    public string Message { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public BookingKendaraan BookingKendaraan { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
