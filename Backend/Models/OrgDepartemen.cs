namespace PengirimanApi.Models;

public class OrgDepartemen
{
    public int Id { get; set; }
    public string Nama { get; set; } = null!;
    public int DivisiId { get; set; }
    public DateTime CreatedAt { get; set; }

    public OrgDivisi Divisi { get; set; } = null!;
}
