namespace PengirimanApi.Models;

public class PerbaikanSaranaChatMessage
{
    public int Id { get; set; }
    public int PerbaikanSaranaId { get; set; }
    public int SenderId { get; set; }
    public string Message { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public PerbaikanSarana PerbaikanSarana { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
