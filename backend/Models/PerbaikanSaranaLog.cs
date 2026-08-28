namespace PengirimanApi.Models;

public class PerbaikanSaranaLog
{
    public int Id { get; set; }
    public int PerbaikanSaranaId { get; set; }
    public string Action { get; set; } = null!;
    public int? ActorId { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }

    public PerbaikanSarana PerbaikanSarana { get; set; } = null!;
    public User? Aktor { get; set; }
}
