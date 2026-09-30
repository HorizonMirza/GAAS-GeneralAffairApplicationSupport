using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;

namespace PengirimanApi.Services;

// In-memory cache of the AppSettings singleton row + the Holiday table, refreshed by
// AppSettingsController on every write - same "load once from DB, every controller reads the
// static cache instead of querying again" pattern as MasterData/MeetingRooms/Vehicles/OrgTree.
public static class AppSettingsCache
{
    public static string CompanyName { get; private set; } = "PGN Solution";
    public static string? LogoPath { get; private set; }
    public static string? LogoContentType { get; private set; }
    public static TimeOnly OperatingStart { get; private set; } = new(7, 0);
    public static TimeOnly OperatingEnd { get; private set; } = new(18, 0);
    private static HashSet<DateOnly> _holidays = new();

    // Resolved once at startup (Program.cs) - the same directory AppSettingsController resolves
    // per-request via DI, needed here too so the PDF services (static classes with no DI) can read
    // whichever logo is actually current instead of always the bundled default.
    private static string? _logoUploadDir;
    private static readonly string BundledDefaultLogoPath = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-pgm-solution.png");

    public static void Configure(string logoUploadDir)
    {
        _logoUploadDir = logoUploadDir;
    }

    public static void LoadFromDb(AppDbContext db)
    {
        var settings = db.AppSettings.Find(1);
        if (settings != null)
        {
            CompanyName = settings.CompanyName;
            LogoPath = settings.LogoPath;
            LogoContentType = settings.LogoContentType;
            OperatingStart = settings.OperatingStart;
            OperatingEnd = settings.OperatingEnd;
        }
        _holidays = db.Holidays.Select(h => h.Date).ToHashSet();
    }

    public static bool IsHoliday(DateOnly date) => _holidays.Contains(date);

    // Read fresh on every call (not cached) so an uploaded logo shows up in the very next PDF -
    // this is only ever called while building a PDF, which is rare enough that re-reading a small
    // file from disk each time costs nothing.
    public static byte[] GetLogoBytes()
    {
        var path = LogoPath != null && _logoUploadDir != null ? Path.Combine(_logoUploadDir, LogoPath) : BundledDefaultLogoPath;
        if (!File.Exists(path)) path = BundledDefaultLogoPath;
        return File.ReadAllBytes(path);
    }
}
