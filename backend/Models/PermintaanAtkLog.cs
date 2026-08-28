namespace PengirimanApi.Models;

public class PermintaanAtkLog
{
    public int Id { get; set; }
    public int PermintaanAtkId { get; set; }
    public string Action { get; set; } = null!;
    public int? ActorId { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }

    public PermintaanAtk PermintaanAtk { get; set; } = null!;
    public User? Aktor { get; set; }
}
