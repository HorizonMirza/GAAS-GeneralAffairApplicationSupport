namespace PengirimanApi.Models;

public class PerbaikanSaranaChatRead
{
    public int Id { get; set; }
    public int PerbaikanSaranaId { get; set; }
    public int UserId { get; set; }
    public DateTime LastReadAt { get; set; }

    public PerbaikanSarana PerbaikanSarana { get; set; } = null!;
    public User User { get; set; } = null!;
}
