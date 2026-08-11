namespace PengirimanApi.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string Nama { get; set; } = null!;
    public RoleEnum Role { get; set; }
    public string? Direktorat { get; set; }
    public string? Divisi { get; set; }
    public string? Departemen { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<Pengiriman> PengirimanDibuat { get; set; } = new List<Pengiriman>();
}
