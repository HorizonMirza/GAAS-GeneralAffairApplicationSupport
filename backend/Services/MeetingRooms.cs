namespace PengirimanApi.Services;

public record RoomOption(string Nama, int Kapasitas, string Lantai, List<string> Fasilitas);

public static class MeetingRooms
{
    // Matches BookingRuangController.MaxJumlahPeserta (64) - every room's real capacity, not the
    // stale value of 10 this list previously carried. Lantai is a placeholder (real floor
    // assignments aren't known yet) - Fasilitas is a best-guess per room, not yet verified against
    // what's actually installed.
    public static readonly List<RoomOption> Rooms = new()
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

    public static int? GetCapacity(string namaRuang) =>
        Rooms.FirstOrDefault(r => r.Nama == namaRuang)?.Kapasitas;

    public static bool IsValidRoom(string namaRuang) =>
        Rooms.Any(r => r.Nama == namaRuang);
}
