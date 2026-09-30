namespace PengirimanApi.Models;

public class ChatRead
{
    public int Id { get; set; }
    public int PengirimanId { get; set; }
    public int UserId { get; set; }
    public DateTime LastReadAt { get; set; }

    public Pengiriman Pengiriman { get; set; } = null!;
    public User User { get; set; } = null!;
}
