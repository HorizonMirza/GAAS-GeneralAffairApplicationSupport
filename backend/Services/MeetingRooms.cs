namespace PengirimanApi.Services;

public record RoomOption(string Nama, int Kapasitas);

public static class MeetingRooms
{
    public static readonly List<RoomOption> Rooms = new()
    {
        new("Ruang A", 16),
        new("Ruang B", 8),
        new("Ruang C", 4),
        new("Ruang D", 4),
        new("Ruang E", 4),
    };

    public static int? GetCapacity(string namaRuang) =>
        Rooms.FirstOrDefault(r => r.Nama == namaRuang)?.Kapasitas;

    public static bool IsValidRoom(string namaRuang) =>
        Rooms.Any(r => r.Nama == namaRuang);
}
