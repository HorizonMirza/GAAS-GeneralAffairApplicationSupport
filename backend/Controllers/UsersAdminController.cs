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
        await _db.SaveChangesAsync();

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

        if (payload.Divisi != null || payload.Departemen != null)
        {
            var divisi = payload.Divisi ?? user.Divisi;
            var departemen = payload.Departemen ?? user.Departemen;
            var (orgError, validDirektorat, validDivisi, validDepartemen) = ValidateOrgFields(divisi, departemen);
            if (orgError != null) return StatusCode(400, new { detail = orgError });
            user.Direktorat = validDirektorat;
            user.Divisi = validDivisi;
            user.Departemen = validDepartemen;
        }
        if (payload.Role.HasValue) user.Role = payload.Role.Value;

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
}
