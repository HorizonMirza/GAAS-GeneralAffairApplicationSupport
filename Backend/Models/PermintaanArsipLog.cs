namespace PengirimanApi.Models;

public class PermintaanArsipLog
{
    public int Id { get; set; }
    public int PermintaanArsipId { get; set; }
    public string Action { get; set; } = null!;
    public int? ActorId { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }

    public PermintaanArsip PermintaanArsip { get; set; } = null!;
    public User? Aktor { get; set; }
}
