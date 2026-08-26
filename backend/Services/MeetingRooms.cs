namespace PengirimanApi.Services;

public record RoomOption(string Nama, int Kapasitas);

public static class MeetingRooms
{
    // Matches BookingRuangController.MaxJumlahPeserta (64) - every room's real capacity, not the
    // stale value of 10 this list previously carried.
    public static readonly List<RoomOption> Rooms = new()
    {
        new("Ruang Eksternal Receptionist", 64),
        new("Ruang Eksternal Besar", 64),
        new("Ruang Eksternal Kecil", 64),
        new("Ruang Golf", 64),
        new("Ruang Open Space", 64),
        new("Ruang ECC", 64),
        new("Ruang Solution 1", 64),
        new("Ruang Solution 2", 64),
        new("Ruang Solution 3", 64),
        new("Ruang Solution Utama", 64),
    };

    public static int? GetCapacity(string namaRuang) =>
        Rooms.FirstOrDefault(r => r.Nama == namaRuang)?.Kapasitas;

    public static bool IsValidRoom(string namaRuang) =>
        Rooms.Any(r => r.Nama == namaRuang);
}
