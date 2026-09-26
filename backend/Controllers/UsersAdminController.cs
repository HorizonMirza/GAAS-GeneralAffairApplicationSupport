using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Super Admin's user account management - the UI for what DbSeeder.cs used to only be able to do
// once, at boot, from a hardcoded org tree. Username and PasswordHash are never editable from
// UpdateUser directly - a username change would break login for whoever already knows it, and a
// password only ever changes through ResetPassword (Super Admin-initiated) or ProfileController.
// ChangePassword (self-service), both of which hash it and never return the old value.
[Route("api/users-admin")]
public class UsersAdminController : ApiControllerBase
{
    private static readonly HashSet<int> AllowedLimits = new() { 10, 20, 50, 100 };

    private readonly AppDbContext _db;

    public UsersAdminController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] RoleEnum? role = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery] string? search = null,
        [FromQuery(Name = "isActive")] bool? isActive = null)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (page < 1) return BadRequest(new { detail = "Halaman tidak valid" });
        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = $"Limit harus salah satu dari {string.Join(",", AllowedLimits)}" });

        var query = _db.Users.AsQueryable();
        if (role.HasValue) query = query.Where(u => u.Role == role.Value);
        if (!string.IsNullOrEmpty(divisi)) query = query.Where(u => u.Divisi == divisi);
        if (!string.IsNullOrEmpty(departemen)) query = query.Where(u => u.Departemen == departemen);
        if (isActive.HasValue) query = query.Where(u => u.IsActive == isActive.Value);
        if (!string.IsNullOrEmpty(search))
            query = query.Where(u => EF.Functions.ILike(u.Username, $"%{search}%") || EF.Functions.ILike(u.Nama, $"%{search}%"));

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(u => u.Nama)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(u => AdminUserOut.From(u))
            .ToListAsync();

        return Ok(new AdminUserListResponse(items, total, page, limit));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var username = payload.Username?.Trim() ?? "";
        var nama = payload.Nama?.Trim() ?? "";
        if (username.Length == 0)
            return StatusCode(400, new { detail = "Username wajib diisi" });
        if (nama.Length == 0)
            return StatusCode(400, new { detail = "Nama akun wajib diisi" });
        if (await _db.Users.AnyAsync(u => u.Username == username))
            return StatusCode(400, new { detail = "Username sudah dipakai akun lain" });

        var (orgError, direktorat, divisi, departemen) = ValidateOrgFields(payload.Divisi, payload.Departemen);
        if (orgError != null) return StatusCode(400, new { detail = orgError });
        var consistencyError = ValidateRoleOrgConsistency(payload.Role, divisi, departemen);
        if (consistencyError != null) return StatusCode(400, new { detail = consistencyError });

        var password = PasswordGenerator.Generate();
        var user = new User
        {
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Nama = nama,
            Role = payload.Role,
            Direktorat = direktorat,
            Divisi = divisi,
            Departemen = departemen,
            Email = string.IsNullOrWhiteSpace(payload.Email) ? null : payload.Email.Trim(),
            NoHp = string.IsNullOrWhiteSpace(payload.NoHp) ? null : payload.NoHp.Trim(),
            MustChangePassword = true,
        };
        _db.Users.Add(user);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Closes the race the AnyAsync check above can't: two requests can both pass it
            // before either commits, so the table's own UNIQUE index is what actually catches the
            // second one - as this exception, not a clean result.
            return StatusCode(400, new { detail = "Username sudah dipakai akun lain" });
        }

        return StatusCode(201, new CreatedUserOut(AdminUserOut.From(user), password));
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { detail = "Akun tidak ditemukan" });

        if (payload.Nama != null)
        {
            var nama = payload.Nama.Trim();
            if (nama.Length == 0) return StatusCode(400, new { detail = "Nama akun wajib diisi" });
            user.Nama = nama;
        }
        if (payload.Email != null)
            user.Email = string.IsNullOrWhiteSpace(payload.Email) ? null : payload.Email.Trim();
        if (payload.NoHp != null)
            user.NoHp = string.IsNullOrWhiteSpace(payload.NoHp) ? null : payload.NoHp.Trim();

        // Effective Role/Divisi/Departemen this request would end up with - computed up front
        // (rather than applied field-by-field) so the two checks below always see the FULL
        // resulting combination, even when a request only touches one of the three (e.g. changing
        // just Role against an untouched, already-stored Divisi/Departemen from before).
        var effectiveRole = payload.Role ?? user.Role;
        var direktorat = user.Direktorat;
        var divisi = user.Divisi;
        var departemen = user.Departemen;
        if (payload.Divisi != null || payload.Departemen != null || payload.ClearDivisi || payload.ClearDepartemen)
        {
            var newDivisi = payload.ClearDivisi ? null : (payload.Divisi ?? user.Divisi);
            var newDepartemen = payload.ClearDepartemen ? null : (payload.Departemen ?? user.Departemen);
            var (orgError, validDirektorat, validDivisi, validDepartemen) = ValidateOrgFields(newDivisi, newDepartemen);
            if (orgError != null) return StatusCode(400, new { detail = orgError });
            direktorat = validDirektorat;
            divisi = validDivisi;
            departemen = validDepartemen;
        }

        // Lockout guard: with only one seeded Super Admin account and no other way back into
        // /superadmin, letting that last account demote itself (or another Super Admin demote it)
        // away from SUPER_ADMIN would strand the whole feature with no recovery path short of a
        // manual database edit.
        if (payload.Role.HasValue && payload.Role.Value != user.Role && user.Role == RoleEnum.SUPER_ADMIN
            && await IsLastActiveSuperAdmin(_db, user))
            return StatusCode(400, new { detail = "Tidak dapat mengubah role - ini satu-satunya akun Super Admin aktif" });

        var consistencyError = ValidateRoleOrgConsistency(effectiveRole, divisi, departemen);
        if (consistencyError != null) return StatusCode(400, new { detail = consistencyError });

        user.Direktorat = direktorat;
        user.Divisi = divisi;
        user.Departemen = departemen;
        user.Role = effectiveRole;

        await _db.SaveChangesAsync();
        return Ok(AdminUserOut.From(user));
    }

    [HttpPost("{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { detail = "Akun tidak ditemukan" });

        var password = PasswordGenerator.Generate();
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        user.MustChangePassword = true;
        // Same reasoning as ProfileController.ChangePassword: stamping this revokes every session
        // issued before the reset, so a stolen/expired session on this account doesn't outlive it.
        user.PasswordChangedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new ResetPasswordOut(password));
    }

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var (currentUser, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { detail = "Akun tidak ditemukan" });
        if (user.Id == currentUser!.Id)
            return StatusCode(400, new { detail = "Tidak dapat menonaktifkan akun yang sedang digunakan" });
        if (await IsLastActiveSuperAdmin(_db, user))
            return StatusCode(400, new { detail = "Tidak dapat menonaktifkan - ini satu-satunya akun Super Admin aktif" });

        user.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(AdminUserOut.From(user));
    }

    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { detail = "Akun tidak ditemukan" });

        user.IsActive = true;
        await _db.SaveChangesAsync();
        return Ok(AdminUserOut.From(user));
    }

    // Light referential validation against the current org tree (OrgTree.Tree, DB-backed - see
    // Services/OrgTree.cs) - null/empty fields pass through untouched (GA/KPU/Super Admin accounts
    // have none of the three), a non-empty value has to actually exist in the tree, and Departemen
    // additionally has to belong to the given Divisi when both are set. Direktorat is only ever
    // implied (GetDirektoratForDivisi), matching how the rest of the app treats it - it's not
    // independently choosable here.
    private static (string? Error, string? Direktorat, string? Divisi, string? Departemen) ValidateOrgFields(string? divisi, string? departemen)
    {
        var normDivisi = string.IsNullOrWhiteSpace(divisi) ? null : divisi.Trim();
        var normDepartemen = string.IsNullOrWhiteSpace(departemen) ? null : departemen.Trim();

        if (normDivisi != null && !OrgTree.AllDivisi.Contains(normDivisi))
            return ("Divisi tidak dikenali", null, null, null);
        if (normDepartemen != null)
        {
            if (normDivisi == null || !OrgTree.GetDepartemenOptions(normDivisi).Contains(normDepartemen))
                return ("Departemen tidak dikenali atau tidak sesuai dengan Divisi", null, null, null);
        }

        var resolvedDirektorat = normDivisi != null ? OrgTree.GetDirektoratForDivisi(normDivisi) : null;
        return (null, resolvedDirektorat, normDivisi, normDepartemen);
    }

    // true only when `target` is itself an active SUPER_ADMIN and no OTHER active SUPER_ADMIN
    // account exists - called before demoting/deactivating a Super Admin account, never before
    // any other change, so a role change into SUPER_ADMIN or an edit to a non-Super-Admin account
    // never hits this check at all. Public static (db passed explicitly, like ChatHub's own
    // Can...Chat helpers) so backend.Tests can exercise it directly against an in-memory
    // AppDbContext without also standing up a real CurrentUserService/HttpContext.
    public static async Task<bool> IsLastActiveSuperAdmin(AppDbContext db, User target)
    {
        if (target.Role != RoleEnum.SUPER_ADMIN || !target.IsActive) return false;
        var othersActive = await db.Users.CountAsync(u => u.Id != target.Id && u.Role == RoleEnum.SUPER_ADMIN && u.IsActive);
        return othersActive == 0;
    }

    // Blocks Role+Divisi/Departemen combinations that can't occur through normal seeding
    // (DbSeeder.BuildAccounts) and that the rest of the app doesn't expect: ADMIN_GA/APPROVAL_GA/
    // KPU/SUPER_ADMIN are never tied to any org unit; ADMIN_DIVISI/APPROVAL_DIVISI stop at Divisi
    // (no Departemen); ADMIN_DEPARTEMEN/APPROVAL_DEPARTEMEN need both. Called with the FULL
    // resulting Role+Divisi+Departemen a request would end up with, not just whichever fields it
    // happened to touch - see the two call sites. Public for the same testability reason as
    // IsLastActiveSuperAdmin above.
    public static string? ValidateRoleOrgConsistency(RoleEnum role, string? divisi, string? departemen)
    {
        switch (role)
        {
            case RoleEnum.ADMIN_GA:
            case RoleEnum.APPROVAL_GA:
            case RoleEnum.KPU:
            case RoleEnum.SUPER_ADMIN:
                if (divisi != null || departemen != null)
                    return "Role ini tidak terikat ke Divisi/Departemen manapun - kosongkan keduanya";
                break;
            case RoleEnum.ADMIN_DIVISI:
            case RoleEnum.APPROVAL_DIVISI:
                if (divisi == null)
                    return "Role ini wajib memiliki Divisi";
                if (departemen != null)
                    return "Role ini tidak boleh memiliki Departemen (hanya sampai level Divisi)";
                break;
            case RoleEnum.ADMIN_DEPARTEMEN:
            case RoleEnum.APPROVAL_DEPARTEMEN:
                if (divisi == null || departemen == null)
                    return "Role ini wajib memiliki Divisi dan Departemen";
                break;
        }
        return null;
    }
}
