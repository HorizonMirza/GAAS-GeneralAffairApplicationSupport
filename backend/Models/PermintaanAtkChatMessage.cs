namespace PengirimanApi.Models;

public class PermintaanAtkChatMessage
{
    public int Id { get; set; }
    public int PermintaanAtkId { get; set; }
    public int SenderId { get; set; }
    public string Message { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public PermintaanAtk PermintaanAtk { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
