using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Super Admin's org structure editor - the UI for the tables OrgTree.cs now reads through
// (Models/OrgDirektorat.cs/OrgDivisi.cs/OrgDepartemen.cs). Every write here calls
// OrgTree.LoadFromDb at the end, inside the same request, so the next call to any of the 37
// existing OrgTree.* call sites across the app - including this same process's very next request
// - already reflects the change.
[Route("api/org-admin")]
public class OrgAdminController : ApiControllerBase
{
    private readonly AppDbContext _db;

    public OrgAdminController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    [HttpGet("tree")]
    public async Task<IActionResult> GetTree()
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var direktorats = await _db.OrgDirektorats
            .Include(d => d.Divisi).ThenInclude(v => v.Departemen)
            .OrderBy(d => d.Id)
            .ToListAsync();

        return Ok(new OrgTreeResponse(direktorats.Select(OrgDirektoratOut.From).ToList()));
    }

    // ---- Direktorat ----

    [HttpPost("direktorat")]
    public async Task<IActionResult> CreateDirektorat([FromBody] CreateDirektoratRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var nama = payload.Nama?.Trim() ?? "";
        if (nama.Length == 0)
            return StatusCode(400, new { detail = "Nama direktorat wajib diisi" });
        if (await _db.OrgDirektorats.AnyAsync(d => d.Nama == nama))
            return StatusCode(400, new { detail = "Nama direktorat sudah dipakai" });

        var row = new OrgDirektorat { Nama = nama };
        _db.OrgDirektorats.Add(row);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Closes the race the AnyAsync check above can't: two requests can both pass it
            // before either commits, so the table's own UNIQUE index is what actually catches the
            // second one - as this exception, not a clean result.
            return StatusCode(400, new { detail = "Nama direktorat sudah dipakai" });
        }
        OrgTree.LoadFromDb(_db);

        return StatusCode(201, new OrgDirektoratOut(row.Id, row.Nama, new List<OrgDivisiOut>()));
    }

    [HttpPatch("direktorat/{id:int}")]
    public async Task<IActionResult> RenameDirektorat(int id, [FromBody] RenameRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var row = await _db.OrgDirektorats.Include(d => d.Divisi).ThenInclude(v => v.Departemen).FirstOrDefaultAsync(d => d.Id == id);
        if (row == null) return NotFound(new { detail = "Direktorat tidak ditemukan" });

        var nama = payload.Nama?.Trim() ?? "";
        if (nama.Length == 0)
            return StatusCode(400, new { detail = "Nama direktorat wajib diisi" });
        if (await _db.OrgDirektorats.AnyAsync(d => d.Id != id && d.Nama == nama))
            return StatusCode(400, new { detail = "Nama direktorat sudah dipakai" });

        // Rename only ever changes what the org tree/dropdowns show going forward - every existing
        // Pengiriman/BookingRuang/.../user row keeps whatever Divisi/Departemen string it already
        // has stored (Direktorat isn't stamped onto business rows at all, only onto users - and
        // even there this deliberately leaves it as-is, same "renaming doesn't rewrite history"
        // rule OrgAdminController applies to Divisi/Departemen below).
        row.Nama = nama;
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            return StatusCode(400, new { detail = "Nama direktorat sudah dipakai" });
        }
        OrgTree.LoadFromDb(_db);

        return Ok(OrgDirektoratOut.From(row));
    }

    [HttpDelete("direktorat/{id:int}")]
    public async Task<IActionResult> DeleteDirektorat(int id)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        await using var transaction = await _db.Database.BeginTransactionAsync();
        // Paired with the same lock in CreateDivisi above - see comment there.
        await LockResourceAsync(_db, $"org-direktorat|{id}");

        var row = await _db.OrgDirektorats.Include(d => d.Divisi).FirstOrDefaultAsync(d => d.Id == id);
        if (row == null) return NotFound(new { detail = "Direktorat tidak ditemukan" });
        if (row.Divisi.Count > 0)
            return StatusCode(409, new { detail = "Direktorat masih memiliki Divisi. Hapus atau pindahkan Divisi di dalamnya terlebih dahulu." });

        _db.OrgDirektorats.Remove(row);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();
        OrgTree.LoadFromDb(_db);

        return NoContent();
    }

    // ---- Divisi ----

    [HttpPost("divisi")]
    public async Task<IActionResult> CreateDivisi([FromBody] CreateDivisiRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var nama = payload.Nama?.Trim() ?? "";
        var kode = payload.KodeSatuanKerja?.Trim() ?? "";
        if (nama.Length == 0)
            return StatusCode(400, new { detail = "Nama divisi wajib diisi" });
        if (kode.Length == 0)
            return StatusCode(400, new { detail = "Kode satuan kerja wajib diisi" });

        await using var transaction = await _db.Database.BeginTransactionAsync();
        // Paired with the same lock in DeleteDirektorat below - serializes this create against a
        // concurrent delete of the SAME Direktorat, so one of the two always sees the other's
        // committed result instead of racing (a Divisi created under a Direktorat mid-delete, or a
        // Direktorat deleted out from under a Divisi that's mid-create).
        await LockResourceAsync(_db, $"org-direktorat|{payload.DirektoratId}");

        var direktorat = await _db.OrgDirektorats.FirstOrDefaultAsync(d => d.Id == payload.DirektoratId);
        if (direktorat == null) return StatusCode(400, new { detail = "Direktorat tidak ditemukan" });
        if (await _db.OrgDivisis.AnyAsync(v => v.Nama == nama))
            return StatusCode(400, new { detail = "Nama divisi sudah dipakai" });

        var row = new OrgDivisi { Nama = nama, DirektoratId = direktorat.Id, KodeSatuanKerja = kode };
        _db.OrgDivisis.Add(row);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            return StatusCode(400, new { detail = "Nama divisi sudah dipakai" });
        }

        var accounts = await ProvisionAccountsAsync(
            adminUsername: $"{nama} Admin Div", approvalUsername: $"{nama} Approval Div",
            nama, RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
            direktorat: direktorat.Nama, divisi: nama, departemen: null);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();
        OrgTree.LoadFromDb(_db);

        return StatusCode(201, new CreateDivisiResponse(new OrgDivisiOut(row.Id, row.Nama, row.KodeSatuanKerja, new List<OrgDepartemenOut>()), accounts));
    }

    [HttpPatch("divisi/{id:int}")]
    public async Task<IActionResult> UpdateDivisi(int id, [FromBody] UpdateDivisiRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var row = await _db.OrgDivisis.Include(v => v.Departemen).FirstOrDefaultAsync(v => v.Id == id);
        if (row == null) return NotFound(new { detail = "Divisi tidak ditemukan" });

        var nama = payload.Nama?.Trim() ?? "";
        var kode = payload.KodeSatuanKerja?.Trim() ?? "";
        if (nama.Length == 0)
            return StatusCode(400, new { detail = "Nama divisi wajib diisi" });
        if (kode.Length == 0)
            return StatusCode(400, new { detail = "Kode satuan kerja wajib diisi" });
        if (await _db.OrgDivisis.AnyAsync(v => v.Id != id && v.Nama == nama))
            return StatusCode(400, new { detail = "Nama divisi sudah dipakai" });

        // Same "does not touch history" rule as RenameDirektorat above - existing rows across
        // every business table and every user account keep whatever Divisi string they already
        // have; only NEW records/dropdowns pick up the renamed value or the new kode.
        row.Nama = nama;
        row.KodeSatuanKerja = kode;
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            return StatusCode(400, new { detail = "Nama divisi sudah dipakai" });
        }
        OrgTree.LoadFromDb(_db);

        return Ok(OrgDivisiOut.From(row));
    }

    [HttpDelete("divisi/{id:int}")]
    public async Task<IActionResult> DeleteDivisi(int id)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        await using var transaction = await _db.Database.BeginTransactionAsync();
        // Paired with the same lock in CreateDepartemen above, fully closing that race. Also
        // narrows - but, deliberately, does not fully close - the window against an ordinary
        // create endpoint elsewhere in the app (Pengiriman, BookingRuang, ..., Users) stamping a
        // new row with this Divisi's name at the exact same instant: those tables store Divisi as
        // a plain string, not an FK to org_divisi (a rename never rewrites historical rows - see
        // UpdateDivisi above), so nothing outside this controller takes this lock. Fully closing
        // that residual window would mean every create endpoint across six modules + Users taking
        // it too, which is disproportionate for how rare "delete this Divisi at the exact instant
        // someone submits a new transaction under it" actually is for an admin-only action.
        await LockResourceAsync(_db, $"org-divisi|{id}");

        var row = await _db.OrgDivisis.Include(v => v.Departemen).FirstOrDefaultAsync(v => v.Id == id);
        if (row == null) return NotFound(new { detail = "Divisi tidak ditemukan" });
        if (row.Departemen.Count > 0)
            return StatusCode(409, new { detail = "Divisi masih memiliki Departemen. Hapus atau pindahkan Departemen di dalamnya terlebih dahulu." });

        if (await IsDivisiInUse(_db, row.Nama))
            return StatusCode(409, new { detail = "Divisi masih digunakan oleh akun pengguna atau data transaksi dan tidak dapat dihapus." });

        _db.OrgDivisis.Remove(row);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();
        OrgTree.LoadFromDb(_db);

        return NoContent();
    }

    // ---- Departemen ----

    [HttpPost("departemen")]
    public async Task<IActionResult> CreateDepartemen([FromBody] CreateDepartemenRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var nama = payload.Nama?.Trim() ?? "";
        if (nama.Length == 0)
            return StatusCode(400, new { detail = "Nama departemen wajib diisi" });

        await using var transaction = await _db.Database.BeginTransactionAsync();
        // Paired with the same lock in DeleteDivisi below - see comment there.
        await LockResourceAsync(_db, $"org-divisi|{payload.DivisiId}");

        var divisi = await _db.OrgDivisis.Include(v => v.Direktorat).FirstOrDefaultAsync(v => v.Id == payload.DivisiId);
        if (divisi == null) return StatusCode(400, new { detail = "Divisi tidak ditemukan" });
        if (await _db.OrgDepartemens.AnyAsync(d => d.Nama == nama))
            return StatusCode(400, new { detail = "Nama departemen sudah dipakai" });

        var row = new OrgDepartemen { Nama = nama, DivisiId = divisi.Id };
        _db.OrgDepartemens.Add(row);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            return StatusCode(400, new { detail = "Nama departemen sudah dipakai" });
        }

        var accounts = await ProvisionAccountsAsync(
            adminUsername: $"{nama} Admin", approvalUsername: $"{nama} Approval",
            nama, RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
            direktorat: divisi.Direktorat.Nama, divisi: divisi.Nama, departemen: nama);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();
        OrgTree.LoadFromDb(_db);

        return StatusCode(201, new CreateDepartemenResponse(new OrgDepartemenOut(row.Id, row.Nama), accounts));
    }

    [HttpPatch("departemen/{id:int}")]
    public async Task<IActionResult> UpdateDepartemen(int id, [FromBody] RenameRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var row = await _db.OrgDepartemens.FirstOrDefaultAsync(d => d.Id == id);
        if (row == null) return NotFound(new { detail = "Departemen tidak ditemukan" });

        var nama = payload.Nama?.Trim() ?? "";
        if (nama.Length == 0)
            return StatusCode(400, new { detail = "Nama departemen wajib diisi" });
        if (await _db.OrgDepartemens.AnyAsync(d => d.Id != id && d.Nama == nama))
            return StatusCode(400, new { detail = "Nama departemen sudah dipakai" });

        // Same "does not touch history" rule as UpdateDivisi above.
        row.Nama = nama;
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            return StatusCode(400, new { detail = "Nama departemen sudah dipakai" });
        }
        OrgTree.LoadFromDb(_db);

        return Ok(OrgDepartemenOut.From(row));
    }

    [HttpDelete("departemen/{id:int}")]
    public async Task<IActionResult> DeleteDepartemen(int id)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        await using var transaction = await _db.Database.BeginTransactionAsync();
        // Same reasoning as DeleteDivisi above - no create-under-a-Departemen counterpart exists
        // (Departemen is a leaf), so this only narrows the window against ordinary business-record
        // creates, same residual scope as there.
        await LockResourceAsync(_db, $"org-departemen|{id}");

        var row = await _db.OrgDepartemens.FirstOrDefaultAsync(d => d.Id == id);
        if (row == null) return NotFound(new { detail = "Departemen tidak ditemukan" });

        if (await IsDepartemenInUse(_db, row.Nama))
            return StatusCode(409, new { detail = "Departemen masih digunakan oleh akun pengguna atau data transaksi dan tidak dapat dihapus." });

        _db.OrgDepartemens.Remove(row);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();
        OrgTree.LoadFromDb(_db);

        return NoContent();
    }

    // Checked before a Divisi delete - (a) any user account stamped with this Divisi, and (b) any
    // row in all six business tables with a matching Divisi column. AnyAsync per table rather than
    // one combined query: this is an admin-only, low-frequency action, not a hot path, and it
    // keeps each check trivially readable. Public static (db passed explicitly, like ChatHub's own
    // Can...Chat helpers) so backend.Tests can exercise it directly against an in-memory
    // AppDbContext without also standing up a real CurrentUserService/HttpContext.
    public static async Task<bool> IsDivisiInUse(AppDbContext db, string nama) =>
        await db.Users.AnyAsync(u => u.Divisi == nama) ||
        await db.Pengiriman.AnyAsync(p => p.Divisi == nama) ||
        await db.BookingRuangs.AnyAsync(b => b.Divisi == nama) ||
        await db.BookingKendaraans.AnyAsync(b => b.Divisi == nama) ||
        await db.PermintaanAtks.AnyAsync(p => p.Divisi == nama) ||
        await db.PerbaikanSaranas.AnyAsync(p => p.Divisi == nama) ||
        await db.PermintaanArsips.AnyAsync(p => p.Divisi == nama);

    // Same idea as IsDivisiInUse, for a Departemen delete.
    public static async Task<bool> IsDepartemenInUse(AppDbContext db, string nama) =>
        await db.Users.AnyAsync(u => u.Departemen == nama) ||
        await db.Pengiriman.AnyAsync(p => p.Departemen == nama) ||
        await db.BookingRuangs.AnyAsync(b => b.Departemen == nama) ||
        await db.BookingKendaraans.AnyAsync(b => b.Departemen == nama) ||
        await db.PermintaanAtks.AnyAsync(p => p.Departemen == nama) ||
        await db.PerbaikanSaranas.AnyAsync(p => p.Departemen == nama) ||
        await db.PermintaanArsips.AnyAsync(p => p.Departemen == nama);

    // Mirrors DbSeeder.BuildAccounts' own username convention exactly ("{Nama} Admin Div"/
    // "{Nama} Approval Div" for a Divisi, "{Nama} Admin"/"{Nama} Approval" for a Departemen) -
    // called right after a new Divisi/Departemen is created, so its standard Admin+Approval
    // accounts exist immediately instead of only appearing after the next full app restart (when
    // DbSeeder.Seed would otherwise have picked them up from the now-updated OrgTree). Does not
    // call SaveChangesAsync itself - the caller does, after this returns, same transaction as the
    // org row it was called for.
    private async Task<List<ProvisionedAccountOut>> ProvisionAccountsAsync(
        string adminUsername, string approvalUsername, string nama,
        RoleEnum adminRole, RoleEnum approvalRole,
        string? direktorat, string? divisi, string? departemen)
    {
        var accounts = new List<ProvisionedAccountOut>();
        foreach (var (username, role) in new[] { (adminUsername, adminRole), (approvalUsername, approvalRole) })
        {
            if (await _db.Users.AnyAsync(u => u.Username == username)) continue;
            var password = PasswordGenerator.Generate();
            _db.Users.Add(new User
            {
                Username = username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                Nama = nama,
                Role = role,
                Direktorat = direktorat,
                Divisi = divisi,
                Departemen = departemen,
                MustChangePassword = true,
            });
            accounts.Add(new ProvisionedAccountOut(username, nama, role.ToString(), password));
        }
        return accounts;
    }
}
