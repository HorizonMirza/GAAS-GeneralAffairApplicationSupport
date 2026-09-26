using PengirimanApi.Data;

namespace PengirimanApi.Services;

public record RoomOption(string Nama, int Kapasitas, string Lantai, List<string> Fasilitas);

public static class MeetingRooms
{
    // The room roster exactly as it was hardcoded before this feature existed. Used ONLY as
    // one-time seed data for the meeting_room table the very first time this app boots against a
    // database that doesn't have it yet (see the backfill block in Program.cs) - NOT read by
    // anything else. Once that backfill has run, Rooms below is rebuilt from the database instead
    // (see LoadFromDb), so an edit to this literal after go-live has no effect on a running
    // deployment - the only way to change the roster after that point is through
    // MeetingRoomAdminController.
    public static readonly List<RoomOption> SeedData = new()
    {
        new("Ruang Eksternal Receptionist", 64, "Lantai 1", new() { "TV", "AC", "WiFi", "Sofa Tamu" }),
        new("Ruang Eksternal Besar", 64, "Lantai 1", new() { "TV", "AC", "Proyektor", "Sound System", "WiFi", "Podium" }),
        new("Ruang Eksternal Kecil", 64, "Lantai 1", new() { "TV", "AC", "WiFi", "Whiteboard" }),
        new("Ruang Golf", 64, "Lantai 3", new() { "TV", "AC", "Proyektor", "WiFi", "Whiteboard" }),
        new("Ruang Open Space", 64, "Lantai 2", new() { "AC", "WiFi", "Whiteboard", "Meja Panjang" }),
        new("Ruang ECC", 64, "Lantai 4", new() { "TV", "AC", "Proyektor", "WiFi", "Video Conference" }),
        new("Ruang Solution 1", 64, "Lantai 5", new() { "TV", "AC", "WiFi", "Whiteboard" }),
        new("Ruang Solution 2", 64, "Lantai 5", new() { "TV", "AC", "WiFi", "Whiteboard" }),
        new("Ruang Solution 3", 64, "Lantai 5", new() { "TV", "AC", "WiFi", "Whiteboard" }),
        new("Ruang Solution Utama", 64, "Lantai 5", new() { "TV", "AC", "Proyektor", "Sound System", "WiFi", "Video Conference" }),
    };

    // Populated once at startup (Program.cs calls LoadFromDb right after the one-time backfill),
    // then rebuilt on every MeetingRoomAdminController write within that same request - see
    // OrgTree.Tree for the identical pattern this mirrors.
    public static List<RoomOption> Rooms { get; private set; } = SeedData;

    // Rebuilds Rooms from whatever meeting_room rows exist right now - called once at startup and
    // again after every add/rename/delete in MeetingRoomAdminController, so every one of this
    // class's own call sites (BookingRuangController) already reflects the change on its very next
    // read, including this same process's very next request.
    public static void LoadFromDb(AppDbContext db)
    {
        Rooms = db.MeetingRooms
            .OrderBy(r => r.Id)
            .AsEnumerable()
            .Select(r => new RoomOption(
                r.Nama,
                r.Kapasitas,
                r.Lantai,
                r.FasilitasCsv.Length == 0 ? new List<string>() : r.FasilitasCsv.Split(',').ToList()))
            .ToList();
    }

    public static int? GetCapacity(string namaRuang) =>
        Rooms.FirstOrDefault(r => r.Nama == namaRuang)?.Kapasitas;

    public static bool IsValidRoom(string namaRuang) =>
        Rooms.Any(r => r.Nama == namaRuang);
}
