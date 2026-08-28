namespace PengirimanApi.Models;

public class PermintaanAtkChatRead
{
    public int Id { get; set; }
    public int PermintaanAtkId { get; set; }
    public int UserId { get; set; }
    public DateTime LastReadAt { get; set; }

    public PermintaanAtk PermintaanAtk { get; set; } = null!;
    public User User { get; set; } = null!;
}
