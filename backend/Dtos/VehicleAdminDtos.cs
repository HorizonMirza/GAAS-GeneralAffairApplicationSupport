namespace PengirimanApi.Dtos;

public record VehicleOut(
    int Id, string Nama, string PlatNomor, int Kapasitas, string Supir,
    string Merek, string Model, int Tahun, string Warna, string NomorTeleponSupir, string LokasiParkir)
{
    public static VehicleOut From(Models.Vehicle v) =>
        new(v.Id, v.Nama, v.PlatNomor, v.Kapasitas, v.Supir, v.Merek, v.Model, v.Tahun, v.Warna, v.NomorTeleponSupir, v.LokasiParkir);
}

public record VehicleListResponse(List<VehicleOut> Vehicles);

public record CreateVehicleRequest(
    string Nama, string PlatNomor, int Kapasitas, string Supir,
    string Merek, string Model, int Tahun, string Warna, string NomorTeleponSupir, string LokasiParkir);

public record UpdateVehicleRequest(
    string Nama, string PlatNomor, int Kapasitas, string Supir,
    string Merek, string Model, int Tahun, string Warna, string NomorTeleponSupir, string LokasiParkir);
