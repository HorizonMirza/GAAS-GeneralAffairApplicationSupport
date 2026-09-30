using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;

namespace PengirimanApi.Services;

public record MasterDataOption(string Key, string Label, string? Extra);

// In-memory cache of MasterDataItem, refreshed by MasterDataController on every write - same
// "load once from DB, every controller validates against the static cache instead of querying
// again" pattern as MeetingRooms/Vehicles/OrgTree (see their own class comments).
public static class MasterData
{
    private static Dictionary<string, List<MasterDataOption>> _byCategory = new();

    public static void LoadFromDb(AppDbContext db)
    {
        _byCategory = db.MasterDataItems
            .OrderBy(m => m.SortOrder).ThenBy(m => m.Id)
            .AsEnumerable()
            .GroupBy(m => m.Category)
            .ToDictionary(g => g.Key, g => g.Select(m => new MasterDataOption(m.Key, m.Label, m.Extra)).ToList());
    }

    public static bool IsValidKey(string category, string key) =>
        _byCategory.TryGetValue(category, out var options) && options.Any(o => o.Key == key);
}
