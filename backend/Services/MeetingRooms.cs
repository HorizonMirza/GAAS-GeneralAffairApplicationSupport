namespace PengirimanApi.Services;

public record RoomOption(string Nama, int Kapasitas);

public static class MeetingRooms
{
    public static readonly List<RoomOption> Rooms = new()
    {
        new("Ruang Eksternal Receptionist", 10),
        new("Ruang Eksternal Besar", 10),
        new("Ruang Eksternal Kecil", 10),
        new("Ruang Golf", 10),
        new("Ruang Open Space", 10),
        new("Ruang ECC", 10),
        new("Ruang Solution 1", 10),
        new("Ruang Solution 2", 10),
        new("Ruang Solution 3", 10),
        new("Ruang Solution Utama", 10),
    };

    public static int? GetCapacity(string namaRuang) =>
        Rooms.FirstOrDefault(r => r.Nama == namaRuang)?.Kapasitas;

    public static bool IsValidRoom(string namaRuang) =>
        Rooms.Any(r => r.Nama == namaRuang);
}
