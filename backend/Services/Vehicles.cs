namespace PengirimanApi.Services;

public record VehicleOption(
    string Nama,
    string PlatNomor,
    int Kapasitas,
    string Supir,
    string Merek,
    string Model,
    int Tahun,
    string Warna,
    string NomorTeleponSupir,
    string LokasiParkir
);

// Placeholder fleet - 10 example vehicles so the module works end-to-end. Replace with the real
// company fleet (and real assigned drivers) whenever the actual list is available (same
// convention as MeetingRooms.Rooms) - Supir, NomorTeleponSupir, Tahun, Warna and LokasiParkir
// below are all placeholder values, not real employee/asset records.
public static class Vehicles
{
    public static readonly List<VehicleOption> Fleet = new()
    {
        new("Toyota Avanza 1", "B 1234 ABC", 6, "Sutrisno", "Toyota", "Avanza", 2022, "Silver", "0812-3456-7801", "Parkir Basement B1 - Slot A1"),
        new("Toyota Avanza 2", "B 1235 ABC", 6, "Wahyudi", "Toyota", "Avanza", 2021, "Putih", "0812-3456-7802", "Parkir Basement B1 - Slot A2"),
        new("Toyota Innova", "B 2201 XYZ", 7, "Agus Salim", "Toyota", "Innova", 2023, "Hitam", "0812-3456-7803", "Parkir Basement B1 - Slot A3"),
        new("Toyota Fortuner", "B 3310 QRS", 6, "Bambang Hariyanto", "Toyota", "Fortuner", 2022, "Hitam", "0812-3456-7804", "Parkir Basement B1 - Slot A4"),
        new("Honda Brio", "B 4421 DEF", 4, "Dedi Kurniawan", "Honda", "Brio", 2021, "Merah", "0812-3456-7805", "Parkir Basement B1 - Slot A5"),
        new("Honda HR-V", "B 5532 GHI", 5, "Rudi Hartono", "Honda", "HR-V", 2023, "Putih", "0812-3456-7806", "Parkir Basement B1 - Slot A6"),
        new("Mitsubishi Xpander", "B 6643 JKL", 7, "Joko Prasetyo", "Mitsubishi", "Xpander", 2022, "Silver", "0812-3456-7807", "Parkir Basement B1 - Slot A7"),
        new("Daihatsu Gran Max (Box)", "B 7754 MNO", 2, "Slamet Riyadi", "Daihatsu", "Gran Max Blind Van", 2020, "Putih", "0812-3456-7808", "Parkir Basement B2 - Slot B1"),
        new("Isuzu Elf (Minibus)", "B 8865 PQR", 15, "Hendra Gunawan", "Isuzu", "Elf NLR", 2021, "Putih", "0812-3456-7809", "Parkir Basement B2 - Slot B2"),
        new("Hyundai Staria", "B 9976 STU", 11, "Fajar Nugroho", "Hyundai", "Staria", 2023, "Abu-abu", "0812-3456-7810", "Parkir Basement B2 - Slot B3"),
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
