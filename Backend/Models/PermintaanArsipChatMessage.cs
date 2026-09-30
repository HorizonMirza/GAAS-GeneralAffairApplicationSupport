namespace PengirimanApi.Models;

public class PermintaanArsipChatMessage
{
    public int Id { get; set; }
    public int PermintaanArsipId { get; set; }
    public int SenderId { get; set; }
    public string Message { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public PermintaanArsip PermintaanArsip { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
