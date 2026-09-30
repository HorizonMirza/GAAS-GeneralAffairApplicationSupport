namespace PengirimanApi.Dtos;

public record OrgDepartemenOut(int Id, string Nama)
{
    public static OrgDepartemenOut From(Models.OrgDepartemen d) => new(d.Id, d.Nama);
}

public record OrgDivisiOut(int Id, string Nama, string KodeSatuanKerja, List<OrgDepartemenOut> Departemen)
{
    public static OrgDivisiOut From(Models.OrgDivisi v) =>
        new(v.Id, v.Nama, v.KodeSatuanKerja, v.Departemen.OrderBy(d => d.Id).Select(OrgDepartemenOut.From).ToList());
}

public record OrgDirektoratOut(int Id, string Nama, List<OrgDivisiOut> Divisi)
{
    public static OrgDirektoratOut From(Models.OrgDirektorat d) =>
        new(d.Id, d.Nama, d.Divisi.OrderBy(v => v.Id).Select(OrgDivisiOut.From).ToList());
}

public record OrgTreeResponse(List<OrgDirektoratOut> Direktorat);

public record CreateDirektoratRequest(string Nama);
public record RenameRequest(string Nama);
public record CreateDivisiRequest(int DirektoratId, string Nama, string KodeSatuanKerja);
public record UpdateDivisiRequest(string Nama, string KodeSatuanKerja);
public record CreateDepartemenRequest(int DivisiId, string Nama);

// One-time credential for an account OrgAdminController auto-provisioned (POST divisi/departemen)
// or UsersAdminController created/reset - Password is only ever present in this one response, the
// backend never stores or logs it in plaintext anywhere past this point.
public record ProvisionedAccountOut(string Username, string Nama, string Role, string Password);

public record CreateDivisiResponse(OrgDivisiOut Divisi, List<ProvisionedAccountOut> Accounts);
public record CreateDepartemenResponse(OrgDepartemenOut Departemen, List<ProvisionedAccountOut> Accounts);
