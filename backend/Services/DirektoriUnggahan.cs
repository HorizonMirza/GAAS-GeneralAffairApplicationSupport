namespace PengirimanApi.Services;

// Where each module's uploaded files live on disk.
//
// This resolution was copy-pasted identically into four controllers. It is centralised here
// because PembersihFileYatim now has to resolve the *same* directories in order to delete from
// them - a fifth copy that drifted by one path segment would mean the cleaner scanning an empty
// folder (and reporting nothing) or, worse, deleting out of the wrong one.
public static class DirektoriUnggahan
{
    public const string KunciInvoice = "UploadDir";
    public const string KunciSarana = "SaranaUploadDir";
    public const string KunciFotoProfil = "ProfilePhotoUploadDir";

    public const string DefaultInvoice = "uploads/invoices";
    public const string DefaultSarana = "uploads/sarana";
    public const string DefaultFotoProfil = "uploads/profile-photos";

    // A relative path in appsettings is taken relative to the project folder, not the build
    // output - AppContext.BaseDirectory points at bin/<config>/<tfm>/, hence the three levels up.
    public static string Resolve(IConfiguration config, string kunci, string fallback)
    {
        var configured = config.GetValue<string>(kunci) ?? fallback;
        var path = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(AppContext.BaseDirectory, "..", "..", "..", configured);
        return Path.GetFullPath(path);
    }

    // Same thing for the writers, which need the folder to exist before the first upload lands.
    public static string ResolveDanBuat(IConfiguration config, string kunci, string fallback)
    {
        var path = Resolve(config, kunci, fallback);
        Directory.CreateDirectory(path);
        return path;
    }
}
