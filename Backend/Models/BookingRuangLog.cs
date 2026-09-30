namespace PengirimanApi.Models;

public class BookingRuangLog
{
    public int Id { get; set; }
    public int BookingRuangId { get; set; }
    public string Action { get; set; } = null!;
    public int? ActorId { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }

    public BookingRuang BookingRuang { get; set; } = null!;
    public User? Aktor { get; set; }
}
