namespace PengirimanApi.Models;

// DB-backed Direktorat -> Divisi -> Departemen org structure (see Services/OrgTree.cs for the
// in-memory cache these are loaded into, and Controllers/OrgAdminController.cs for the Super
// Admin CRUD that writes them). Replaces OrgTree.cs's old compile-time-literal Tree as the
// *source of data*, not the 37 existing call sites' public API - see OrgTree.cs's own comment.
public class OrgDirektorat
{
    public int Id { get; set; }
    public string Nama { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public ICollection<OrgDivisi> Divisi { get; set; } = new List<OrgDivisi>();
}
