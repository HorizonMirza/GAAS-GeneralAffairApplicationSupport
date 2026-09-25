namespace PengirimanApi.Models;

public class OrgDivisi
{
    public int Id { get; set; }
    public string Nama { get; set; } = null!;
    public int DirektoratId { get; set; }
    // Prefix used to build this Divisi's NomorTransmittal/nomor pemesanan across every module
    // (see OrgTree.GetKodeSatuanKerja) - falls back to "GA" when unset, same default as before.
    public string KodeSatuanKerja { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public OrgDirektorat Direktorat { get; set; } = null!;
    public ICollection<OrgDepartemen> Departemen { get; set; } = new List<OrgDepartemen>();
}
