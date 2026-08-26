namespace PengirimanApi.Services;

public record VehicleOption(string Nama, string PlatNomor, int Kapasitas, string Supir);

// Placeholder fleet - 10 example vehicles so the module works end-to-end. Replace with the real
// company fleet (and real assigned drivers) whenever the actual list is available (same
// convention as MeetingRooms.Rooms) - Supir below is a random placeholder name, not a real
// employee record.
public static class Vehicles
{
    public static readonly List<VehicleOption> Fleet = new()
    {
        new("Toyota Avanza 1", "B 1234 ABC", 6, "Sutrisno"),
        new("Toyota Avanza 2", "B 1235 ABC", 6, "Wahyudi"),
        new("Toyota Innova", "B 2201 XYZ", 7, "Agus Salim"),
        new("Toyota Fortuner", "B 3310 QRS", 6, "Bambang Hariyanto"),
        new("Honda Brio", "B 4421 DEF", 4, "Dedi Kurniawan"),
        new("Honda HR-V", "B 5532 GHI", 5, "Rudi Hartono"),
        new("Mitsubishi Xpander", "B 6643 JKL", 7, "Joko Prasetyo"),
        new("Daihatsu Gran Max (Box)", "B 7754 MNO", 2, "Slamet Riyadi"),
        new("Isuzu Elf (Minibus)", "B 8865 PQR", 15, "Hendra Gunawan"),
        new("Hyundai Staria", "B 9976 STU", 11, "Fajar Nugroho"),
    };

    public static int? GetKapasitas(string namaKendaraan) =>
        Fleet.FirstOrDefault(v => v.Nama == namaKendaraan)?.Kapasitas;

    public static string? GetPlatNomor(string namaKendaraan) =>
        Fleet.FirstOrDefault(v => v.Nama == namaKendaraan)?.PlatNomor;

    public static string? GetSupir(string namaKendaraan) =>
        Fleet.FirstOrDefault(v => v.Nama == namaKendaraan)?.Supir;

    public static bool IsValidVehicle(string namaKendaraan) =>
        Fleet.Any(v => v.Nama == namaKendaraan);
}
