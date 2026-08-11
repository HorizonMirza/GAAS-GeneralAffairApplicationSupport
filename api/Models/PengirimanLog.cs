namespace PengirimanApi.Models;

public class PengirimanLog
{
    public int Id { get; set; }
    public int PengirimanId { get; set; }
    public string Action { get; set; } = null!;
    public int? ActorId { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }

    public Pengiriman Pengiriman { get; set; } = null!;
    public User? Aktor { get; set; }
}
