namespace PengirimanApi.Models;

// DB-backed replacement for the hardcoded literal Services/Vehicles.cs used to carry (see
// Vehicles.SeedData/LoadFromDb) - same "renaming/deleting doesn't rewrite history" principle as
// the Org tree: BookingKendaraan stores a vehicle's Nama/PlatNomor/Kapasitas/Supir as plain
// string/int snapshots, not FKs to this table, so editing or removing a row here never touches
// an existing booking.
public class Vehicle
{
    public int Id { get; set; }
    public string Nama { get; set; } = null!;
    public string PlatNomor { get; set; } = null!;
    public int Kapasitas { get; set; }
    public string Supir { get; set; } = null!;
    public string Merek { get; set; } = null!;
    public string Model { get; set; } = null!;
    public int Tahun { get; set; }
    public string Warna { get; set; } = null!;
    public string NomorTeleponSupir { get; set; } = null!;
    public string LokasiParkir { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
