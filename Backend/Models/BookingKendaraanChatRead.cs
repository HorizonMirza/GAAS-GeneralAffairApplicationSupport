namespace PengirimanApi.Models;

public class BookingKendaraanChatRead
{
    public int Id { get; set; }
    public int BookingKendaraanId { get; set; }
    public int UserId { get; set; }
    public DateTime LastReadAt { get; set; }

    public BookingKendaraan BookingKendaraan { get; set; } = null!;
    public User User { get; set; } = null!;
}
