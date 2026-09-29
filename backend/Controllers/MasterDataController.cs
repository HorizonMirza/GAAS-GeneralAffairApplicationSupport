using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Super Admin-managed lookup lists (see MasterDataItem's own class comment) - List is open to
// every logged-in role so each module's own dropdown (standalone pages and Super Admin's replica
// alike) reads the exact same options; every write is Super Admin-only and password-gated, same
// convention as VehicleAdminController/MeetingRoomAdminController.
[Route("api/master-data")]
public class MasterDataController : ApiControllerBase
{
    private readonly AppDbContext _db;

    public MasterDataController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string category)
    {
        var (_, error) = await RequireRoleExceptAsync();
        if (error != null) return error;

        if (!MasterDataCategories.IsValid(category))
            return StatusCode(400, new { detail = "Kategori master data tidak dikenal" });

        var items = await _db.MasterDataItems
            .Where(m => m.Category == category)
            .OrderBy(m => m.SortOrder)
            .ThenBy(m => m.Id)
            .ToListAsync();
        return Ok(new MasterDataListResponse(items.Select(MasterDataItemOut.From).ToList()));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMasterDataRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (string.IsNullOrEmpty(payload.Password) || !BCrypt.Net.BCrypt.Verify(payload.Password, user!.PasswordHash))
            return StatusCode(400, new { detail = "Password salah" });

        if (!MasterDataCategories.IsValid(payload.Category))
            return StatusCode(400, new { detail = "Kategori master data tidak dikenal" });
        var label = payload.Label?.Trim();
        if (string.IsNullOrWhiteSpace(label))
            return StatusCode(400, new { detail = "Nama wajib diisi" });

        // New entries are keyed by their own label (trimmed) - only the defaults seeded at
        // startup keep a separate short code (e.g. Key "AC" / Label "Pendingin Ruangan") for the
        // enum values that already existed in old data before this table existed.
        if (await _db.MasterDataItems.AnyAsync(m => m.Category == payload.Category && m.Key == label))
            return StatusCode(400, new { detail = "Nama ini sudah ada di daftar" });

        var maxOrder = await _db.MasterDataItems.Where(m => m.Category == payload.Category)
            .Select(m => (int?)m.SortOrder).MaxAsync() ?? -1;

        var row = new MasterDataItem
        {
            Category = payload.Category,
            Key = label,
            Label = label,
            Extra = string.IsNullOrWhiteSpace(payload.Extra) ? null : payload.Extra.Trim(),
            SortOrder = maxOrder + 1,
        };
        _db.MasterDataItems.Add(row);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            return StatusCode(400, new { detail = "Nama ini sudah ada di daftar" });
        }
        MasterData.LoadFromDb(_db);

        return StatusCode(201, MasterDataItemOut.From(row));
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMasterDataRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (string.IsNullOrEmpty(payload.Password) || !BCrypt.Net.BCrypt.Verify(payload.Password, user!.PasswordHash))
            return StatusCode(400, new { detail = "Password salah" });

        var row = await _db.MasterDataItems.FirstOrDefaultAsync(m => m.Id == id);
        if (row == null) return NotFound(new { detail = "Data tidak ditemukan" });

        var label = payload.Label?.Trim();
        if (string.IsNullOrWhiteSpace(label))
            return StatusCode(400, new { detail = "Nama wajib diisi" });

        // Key never changes on edit - it's what every existing business record already has
        // stored, so renaming would silently orphan them. Only the display Label (and Extra)
        // are editable.
        row.Label = label;
        row.Extra = string.IsNullOrWhiteSpace(payload.Extra) ? null : payload.Extra.Trim();
        await _db.SaveChangesAsync();
        MasterData.LoadFromDb(_db);

        return Ok(MasterDataItemOut.From(row));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromBody] DeleteMasterDataRequest payload)
    {
        var (user, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (string.IsNullOrEmpty(payload.Password) || !BCrypt.Net.BCrypt.Verify(payload.Password, user!.PasswordHash))
            return StatusCode(400, new { detail = "Password salah" });

        var row = await _db.MasterDataItems.FirstOrDefaultAsync(m => m.Id == id);
        if (row == null) return NotFound(new { detail = "Data tidak ditemukan" });

        if (await IsInUse(_db, row.Category, row.Key))
            return StatusCode(409, new { detail = "Data ini masih dipakai oleh transaksi yang sudah ada dan tidak dapat dihapus." });

        _db.MasterDataItems.Remove(row);
        await _db.SaveChangesAsync();
        MasterData.LoadFromDb(_db);

        return NoContent();
    }

    // Same reasoning as VehicleAdminController.IsVehicleInUse - blocks deleting an option that
    // some existing row still references by its Key, so nothing in the app is ever left pointing
    // at a category value that no longer exists in the list.
    private static async Task<bool> IsInUse(AppDbContext db, string category, string key) => category switch
    {
        MasterDataCategories.Asuransi => await db.Pengiriman.AnyAsync(p => p.AsuransiStatus == key),
        MasterDataCategories.Pengemasan => await db.Pengiriman.AnyAsync(p => p.RequestPacking == key),
        MasterDataCategories.TipeBooking => await db.BookingRuangs.AnyAsync(b => b.Tipe == key),
        MasterDataCategories.AtkKategori => await db.PermintaanAtks.AnyAsync(p => p.Kategori == key),
        MasterDataCategories.AtkNamaBarang => await db.PermintaanAtkItems.AnyAsync(i => i.NamaBarang == key),
        MasterDataCategories.KategoriKerusakan => await db.PerbaikanSaranas.AnyAsync(p => p.Kategori == key),
        MasterDataCategories.ArchiveKategori => await db.PermintaanArsips.AnyAsync(p => p.Kategori == key),
        MasterDataCategories.ArsipTahun => await db.PermintaanArsips.AnyAsync(p => p.TahunArsip == key),
        _ => false,
    };
}
