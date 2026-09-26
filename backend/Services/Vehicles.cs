using PengirimanApi.Data;

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

public static class Vehicles
{
    // The fleet exactly as it was hardcoded before this feature existed. Used ONLY as one-time
    // seed data for the vehicle table the very first time this app boots against a database that
    // doesn't have it yet (see the backfill block in Program.cs) - NOT read by anything else.
    // Once that backfill has run, Fleet below is rebuilt from the database instead (see
    // LoadFromDb), so an edit to this literal after go-live has no effect on a running
    // deployment - the only way to change the fleet after that point is through
    // VehicleAdminController.
    public static readonly List<VehicleOption> SeedData = new()
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

    // Populated once at startup (Program.cs calls LoadFromDb right after the one-time backfill),
    // then rebuilt on every VehicleAdminController write within that same request - see
    // OrgTree.Tree for the identical pattern this mirrors.
    public static List<VehicleOption> Fleet { get; private set; } = SeedData;

    // Rebuilds Fleet from whatever vehicle rows exist right now - called once at startup and again
    // after every add/edit/delete in VehicleAdminController, so every one of this class's own call
    // sites (BookingKendaraanController) already reflects the change on its very next read,
    // including this same process's very next request.
    public static void LoadFromDb(AppDbContext db)
    {
        Fleet = db.Vehicles
            .OrderBy(v => v.Id)
            .AsEnumerable()
            .Select(v => new VehicleOption(
                v.Nama, v.PlatNomor, v.Kapasitas, v.Supir, v.Merek, v.Model, v.Tahun, v.Warna, v.NomorTeleponSupir, v.LokasiParkir))
            .ToList();
    }

    public static int? GetKapasitas(string namaKendaraan) =>
        Fleet.FirstOrDefault(v => v.Nama == namaKendaraan)?.Kapasitas;

    public static string? GetPlatNomor(string namaKendaraan) =>
        Fleet.FirstOrDefault(v => v.Nama == namaKendaraan)?.PlatNomor;

    public static string? GetSupir(string namaKendaraan) =>
        Fleet.FirstOrDefault(v => v.Nama == namaKendaraan)?.Supir;

    public static bool IsValidVehicle(string namaKendaraan) =>
        Fleet.Any(v => v.Nama == namaKendaraan);
}
