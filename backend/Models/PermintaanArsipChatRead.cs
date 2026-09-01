namespace PengirimanApi.Models;

public class PermintaanArsipChatRead
{
    public int Id { get; set; }
    public int PermintaanArsipId { get; set; }
    public int UserId { get; set; }
    public DateTime LastReadAt { get; set; }

    public PermintaanArsip PermintaanArsip { get; set; } = null!;
    public User User { get; set; } = null!;
}
