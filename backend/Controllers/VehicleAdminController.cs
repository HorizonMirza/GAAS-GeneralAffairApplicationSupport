using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Super Admin's vehicle fleet editor - the UI for the vehicle table Vehicles.cs's in-memory cache
// is loaded from (see Vehicles.LoadFromDb). Every write here calls that at the end, inside the
// same request, so BookingKendaraanController's own read of Vehicles.Fleet already reflects the
// change on its very next call, including this same process's very next request.
[Route("api/vehicle-admin")]
public class VehicleAdminController : ApiControllerBase
{
    // Same reasoning as MeetingRoomAdminController.DeadEndStatuses - a booking in one of these will
    // never be acted on again for that vehicle, so it doesn't count as "still using" it.
    private static readonly BookingStatusEnum[] DeadEndStatuses =
    {
        BookingStatusEnum.REJECTED_L1, BookingStatusEnum.REJECTED_GA, BookingStatusEnum.REJECTED_GA_APPROVAL, BookingStatusEnum.CANCELLED,
    };

    private readonly AppDbContext _db;

    public VehicleAdminController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var vehicles = await _db.Vehicles.OrderBy(v => v.Id).ToListAsync();
        return Ok(new VehicleListResponse(vehicles.Select(VehicleOut.From).ToList()));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateVehicleRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var validationError = ValidatePayload(payload.Nama, payload.PlatNomor, payload.Kapasitas, payload.Supir, payload.Merek, payload.Model, payload.Tahun, payload.Warna, payload.NomorTeleponSupir, payload.LokasiParkir);
        if (validationError != null) return StatusCode(400, new { detail = validationError });
        if (await _db.Vehicles.AnyAsync(v => v.Nama == payload.Nama.Trim()))
            return StatusCode(400, new { detail = "Nama kendaraan sudah dipakai" });

        var row = new Vehicle
        {
            Nama = payload.Nama.Trim(),
            PlatNomor = payload.PlatNomor.Trim(),
            Kapasitas = payload.Kapasitas,
            Supir = payload.Supir.Trim(),
            Merek = payload.Merek.Trim(),
            Model = payload.Model.Trim(),
            Tahun = payload.Tahun,
            Warna = payload.Warna.Trim(),
            NomorTeleponSupir = payload.NomorTeleponSupir.Trim(),
            LokasiParkir = payload.LokasiParkir.Trim(),
        };
        _db.Vehicles.Add(row);
        await _db.SaveChangesAsync();
        Vehicles.LoadFromDb(_db);

        return StatusCode(201, VehicleOut.From(row));
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateVehicleRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var row = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == id);
        if (row == null) return NotFound(new { detail = "Kendaraan tidak ditemukan" });

        var validationError = ValidatePayload(payload.Nama, payload.PlatNomor, payload.Kapasitas, payload.Supir, payload.Merek, payload.Model, payload.Tahun, payload.Warna, payload.NomorTeleponSupir, payload.LokasiParkir);
        if (validationError != null) return StatusCode(400, new { detail = validationError });
        if (await _db.Vehicles.AnyAsync(v => v.Id != id && v.Nama == payload.Nama.Trim()))
            return StatusCode(400, new { detail = "Nama kendaraan sudah dipakai" });

        // Same "does not touch history" rule as OrgAdminController's rename endpoints - an existing
        // BookingKendaraan row keeps whatever NamaKendaraan/PlatNomor/KapasitasKendaraan/Supir it
        // already has stored; only new bookings and this dropdown pick up the edited values.
        row.Nama = payload.Nama.Trim();
        row.PlatNomor = payload.PlatNomor.Trim();
        row.Kapasitas = payload.Kapasitas;
        row.Supir = payload.Supir.Trim();
        row.Merek = payload.Merek.Trim();
        row.Model = payload.Model.Trim();
        row.Tahun = payload.Tahun;
        row.Warna = payload.Warna.Trim();
        row.NomorTeleponSupir = payload.NomorTeleponSupir.Trim();
        row.LokasiParkir = payload.LokasiParkir.Trim();
        await _db.SaveChangesAsync();
        Vehicles.LoadFromDb(_db);

        return Ok(VehicleOut.From(row));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var row = await _db.Vehicles.FirstOrDefaultAsync(v => v.Id == id);
        if (row == null) return NotFound(new { detail = "Kendaraan tidak ditemukan" });

        if (await IsVehicleInUse(_db, row.Nama))
            return StatusCode(409, new { detail = "Kendaraan masih digunakan oleh booking yang belum selesai dan tidak dapat dihapus." });

        _db.Vehicles.Remove(row);
        await _db.SaveChangesAsync();
        Vehicles.LoadFromDb(_db);

        return NoContent();
    }

    // Same reasoning as MeetingRoomAdminController.IsRoomInUse (public static for testability).
    public static async Task<bool> IsVehicleInUse(AppDbContext db, string nama) =>
        await db.BookingKendaraans.AnyAsync(b => b.NamaKendaraan == nama && !DeadEndStatuses.Contains(b.Status));

    private static string? ValidatePayload(string? nama, string? platNomor, int kapasitas, string? supir, string? merek, string? model, int tahun, string? warna, string? noTeleponSupir, string? lokasiParkir)
    {
        if (string.IsNullOrWhiteSpace(nama)) return "Nama kendaraan wajib diisi";
        if (string.IsNullOrWhiteSpace(platNomor)) return "Plat nomor wajib diisi";
        if (kapasitas <= 0) return "Kapasitas harus lebih dari 0";
        if (string.IsNullOrWhiteSpace(supir)) return "Nama supir wajib diisi";
        if (string.IsNullOrWhiteSpace(merek)) return "Merek wajib diisi";
        if (string.IsNullOrWhiteSpace(model)) return "Model wajib diisi";
        if (tahun < 1900 || tahun > 2100) return "Tahun tidak valid";
        if (string.IsNullOrWhiteSpace(warna)) return "Warna wajib diisi";
        if (string.IsNullOrWhiteSpace(noTeleponSupir)) return "No. telepon supir wajib diisi";
        if (string.IsNullOrWhiteSpace(lokasiParkir)) return "Lokasi parkir wajib diisi";
        return null;
    }
}
