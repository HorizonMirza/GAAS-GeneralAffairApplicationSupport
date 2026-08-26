namespace PengirimanApi.Models;

public class BookingKendaraanLog
{
    public int Id { get; set; }
    public int BookingKendaraanId { get; set; }
    public string Action { get; set; } = null!;
    public int? ActorId { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }

    public BookingKendaraan BookingKendaraan { get; set; } = null!;
    public User? Aktor { get; set; }
}
