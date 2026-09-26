using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Hubs;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Office Supplies (Permintaan ATK): same approval chain as Pengiriman (Departemen/Divisi -> Admin
// GA -> Approval GA -> KPU, since Admin GA/Approval GA buy either through KPU or the external
// PaDi channel - see SumberPembelian). Unlike Pengiriman, reject at any tier here goes straight
// back to the origin creator to revise and resubmit - there is no RejectTarget-style GA/origin
// routing since no other party fills in authoritative data at approval time (see
// IsEditableByOrigin below). One request carries many item
// rows (PermintaanAtkItem) - there is no scheduling/conflict dimension here.
[Route("api/permintaan-atk")]
public class PermintaanAtkController : ApiControllerBase
{
    // 1000 is the sentinel "unbounded" value for Overview's recent-requests list (see
    // PengirimanController for the full rationale) - 5/10/20/50 stay for the paginated
    // Transaksi table's page-size dropdown.
    private static readonly HashSet<int> AllowedLimits = new() { 5, 10, 20, 50, 1000 };
    private const int MaxItemRows = 10;
    private const int MaxJumlahPerItem = 9999;

    private static readonly RoleEnum[] OriginRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
        RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA,
    };

    // Mirrors PengirimanController.TotalVisibleRoles - everyone who can see this list at all.
    private static readonly RoleEnum[] TotalVisibleRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
        RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN,
    };

    // Same mixing as the booking modules - Admin/Approval GA accounts have no Divisi/Departemen
    // of their own, so requests they input are stamped with the real GA unit.
    private const string GaDivisiLabel = "Procurement and General Affair";
    private const string GaDepartemenLabel = "Asset Management and General Affair";

    private static readonly StatusEnum[] RejectedStatuses =
    {
        StatusEnum.REJECTED_L1, StatusEnum.REJECTED_GA, StatusEnum.REJECTED_GA_APPROVAL, StatusEnum.REJECTED_KPU,
    };

    // Same collapsing idea as RejectedStatuses above, for the "On-Approval" option.
    private static readonly StatusEnum[] OnApprovalStatuses =
    {
        StatusEnum.SUBMITTED, StatusEnum.APPROVED_L1, StatusEnum.APPROVED_GA, StatusEnum.APPROVED_GA_APPROVAL,
    };

    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;

    public PermintaanAtkController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub) : base(currentUser)
    {
        _db = db;
        _hub = hub;
    }

    // Label shown in the "transaksi baru"/"proses approval" notification banner - same
    // Keperluan+Nomor convention as BookingRuangController's ItemLabel.
    private static string ItemLabel(PermintaanAtk item) => $"{item.Keperluan} - {item.NomorPermintaan ?? "#" + item.Id}";

    // Every recipient of a workflow notification for this request: everyone CanAccessPermintaanAtk
    // already lets see it, minus the actor who just triggered the event.
    private async Task<List<int>> ActivityRecipientIdsAsync(PermintaanAtk item, int actorId)
    {
        var users = await _db.Users.Where(u => u.Id != actorId)
            .Select(u => new AccessUser(u.Id, u.Role, u.Divisi, u.Departemen))
            .ToListAsync();
        return users.Where(u => CanAccessPermintaanAtk(u, item)).Select(u => u.Id).ToList();
    }

    private static string EffectiveDivisi(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDivisiLabel : user.Divisi!;

    private static string? EffectiveDepartemen(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDepartemenLabel : user.Departemen;

    private static bool IsGaActor(User user) => user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA or RoleEnum.SUPER_ADMIN;

    // Same on-behalf allowance as PengirimanController - Admin/Approval GA can request office
    // supplies for any divisi/departemen (payload.Divisi/Departemen), not just their own GA home
    // unit. Every other role always requests as itself; GA requesting with no Divisi chosen falls
    // back to their own GA home unit, same as before this feature existed.
    private static (string divisi, string? departemen) EffectiveOwner(User user, PermintaanAtkCreate payload) =>
        IsGaActor(user) && !string.IsNullOrEmpty(payload.Divisi)
            ? (payload.Divisi, payload.Departemen)
            : (EffectiveDivisi(user), EffectiveDepartemen(user));

    // Unlike Room/Vehicle Booking, a rejected request here isn't a dead end - no other party
    // fills in authoritative data at approval time the way Pengiriman's KPU does, so there's no
    // need for RejectTarget-style routing. Any reject, at any tier, goes straight back to its
    // origin creator to revise and resubmit (see Update() below).
    private static bool IsEditableByOrigin(PermintaanAtk item, User currentUser) =>
        (item.Status == StatusEnum.DRAFT || RejectedStatuses.Contains(item.Status)) && item.CreatedBy == currentUser.Id;

    private static bool IsL1Actionable(PermintaanAtk item) => item.Status == StatusEnum.SUBMITTED;
    private static bool IsGaActionable(PermintaanAtk item) => item.Status == StatusEnum.APPROVED_L1;
    private static bool IsGaApprovalActionable(PermintaanAtk item) => item.Status == StatusEnum.APPROVED_GA;
    private static bool IsKpuActionable(PermintaanAtk item) => item.Status == StatusEnum.APPROVED_GA_APPROVAL;

    private void AddLog(PermintaanAtk item, string action, User actor, string? reason = null)
    {
        _db.PermintaanAtkLogs.Add(new PermintaanAtkLog
        {
            PermintaanAtkId = item.Id,
            Action = action,
            ActorId = actor.Id,
            Reason = reason,
        });
    }

    // Accepts either "YYYY-MM" (a specific month, used by the List/Report pages) or a bare
    // "YYYY" (the whole year, used by GetStats so the dashboard tiles reset every year instead
    // of carrying every request ever made) - both share this one filter since they're really the
    // same "which Tanggal range" concept at two different granularities.
    private static IQueryable<PermintaanAtk> ApplyBulanFilter(IQueryable<PermintaanAtk> query, string? bulan)
    {
        if (string.IsNullOrEmpty(bulan)) return query;
        var parts = bulan.Split('-');
        if (parts.Length == 1)
        {
            if (!int.TryParse(parts[0], out var yearOnly))
                throw new ArgumentException("Format bulan harus YYYY atau YYYY-MM");
            return query.Where(p => p.Tanggal.Year == yearOnly);
        }
        if (parts.Length != 2 || !int.TryParse(parts[0], out var year) || !int.TryParse(parts[1], out var month))
            throw new ArgumentException("Format bulan harus YYYY atau YYYY-MM");
        return query.Where(p => p.Tanggal.Year == year && p.Tanggal.Month == month);
    }

    public static IQueryable<PermintaanAtk> ApplyListFilters(
        AppDbContext db,
        IQueryable<PermintaanAtk> query,
        User currentUser,
        StatusEnum? statusFilter,
        string? divisi,
        string? departemen,
        string? direktorat = null,
        string? bulan = null,
        string? search = null,
        bool onlyRejected = false,
        DateOnly? tanggal = null,
        SumberPembelianEnum? sumberPembelian = null,
        bool onlyOnApproval = false)
    {
        if (currentUser.Role is RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN)
        {
            query = query.Where(p => p.Departemen == currentUser.Departemen
                && (p.Status != StatusEnum.DRAFT || p.CreatedBy == currentUser.Id));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            query = query.Where(p => p.Divisi == currentUser.Divisi && p.Departemen == null
                && (p.Status != StatusEnum.DRAFT || p.CreatedBy == currentUser.Id));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA)
        {
            query = query.Where(p => p.Status != StatusEnum.DRAFT || p.CreatedBy == currentUser.Id);
        }
        else
        {
            query = query.Where(p => p.Status != StatusEnum.DRAFT);
        }

        if (statusFilter.HasValue) query = query.Where(p => p.Status == statusFilter.Value);
        else if (onlyRejected) query = query.Where(p => RejectedStatuses.Contains(p.Status));
        else if (onlyOnApproval) query = query.Where(p => OnApprovalStatuses.Contains(p.Status));
        if (!string.IsNullOrEmpty(divisi)) query = query.Where(p => p.Divisi == divisi);
        if (!string.IsNullOrEmpty(departemen)) query = query.Where(p => p.Departemen == departemen);
        if (!string.IsNullOrEmpty(direktorat))
        {
            // Derived from the item's own recorded Divisi (via the static org tree), not from a
            // live join to the creator's current User.Direktorat - Admin/Approval GA accounts
            // have no Direktorat of their own (see DbSeeder), so a live-join filter silently
            // dropped every GA-created item from every specific Direktorat filter while still
            // counting it in the unfiltered total, making the two disagree.
            var divisiInDirektorat = OrgTree.GetDivisiOptions(direktorat);
            query = query.Where(p => divisiInDirektorat.Contains(p.Divisi));
        }
        // Menjangkau nomor permintaan, tujuan, nama pemohon, dan nama barang - orang lebih sering
        // ingat salah satu dari empat itu daripada nomor dokumennya.
        if (!string.IsNullOrEmpty(search))
            query = query.Where(p =>
                (p.NomorPermintaan != null && EF.Functions.ILike(p.NomorPermintaan, $"%{search}%")) ||
                EF.Functions.ILike(p.Keperluan, $"%{search}%") ||
                EF.Functions.ILike(p.NamaPemohon, $"%{search}%") ||
                p.Items.Any(i => EF.Functions.ILike(i.NamaBarang, $"%{search}%")));
        if (tanggal.HasValue) query = query.Where(p => p.Tanggal == tanggal.Value);
        if (sumberPembelian.HasValue) query = query.Where(p => p.SumberPembelian == sumberPembelian.Value);

        return ApplyBulanFilter(query, bulan);
    }

    private static string? ValidatePayload(PermintaanAtkCreate payload, bool isGaActor)
    {
        // Only Admin/Approval GA can request on behalf of another unit - the field is silently
        // ignored for every other role (see EffectiveOwner above), so it's only validated here
        // when it could actually take effect.
        if (isGaActor && !string.IsNullOrEmpty(payload.Divisi))
        {
            if (!OrgTree.AllDivisi.Contains(payload.Divisi))
                return "Divisi tidak ditemukan";
            if (!string.IsNullOrEmpty(payload.Departemen) && !OrgTree.GetDepartemenOptions(payload.Divisi).Contains(payload.Departemen))
                return "Departemen tidak ditemukan pada divisi tersebut";
        }
        if (!Enum.IsDefined(typeof(AtkKategoriEnum), payload.Kategori))
            return "Kategori tidak valid";
        if (string.IsNullOrWhiteSpace(payload.Keperluan))
            return "Tujuan wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.NamaPemohon))
            return "Nama pemohon wajib diisi";
        if (!IsValidPhone(payload.NoTeleponPemohon ?? ""))
            return "No. Telepon pemohon tidak valid";
        if (payload.Items.Count == 0)
            return "Minimal satu barang harus diisi";
        if (payload.Items.Count > MaxItemRows)
            return $"Maksimal {MaxItemRows} baris barang per permintaan";
        foreach (var item in payload.Items)
        {
            if (string.IsNullOrWhiteSpace(item.NamaBarang))
                return "Nama barang wajib diisi pada setiap baris";
            if (item.Jumlah <= 0)
                return "Jumlah setiap barang harus lebih dari 0";
            if (item.Jumlah > MaxJumlahPerItem)
                return $"Jumlah setiap barang maksimal {MaxJumlahPerItem}";
            if (string.IsNullOrWhiteSpace(item.Satuan))
                return "Satuan wajib diisi pada setiap baris (contoh: pcs, rim, box)";
        }
        return null;
    }

    private void ApplyCreatePayload(PermintaanAtk item, PermintaanAtkCreate payload)
    {
        item.Tanggal = payload.Tanggal;
        item.Kategori = payload.Kategori;
        item.Keperluan = payload.Keperluan.Trim();
        item.NamaPemohon = payload.NamaPemohon.Trim();
        item.NoTeleponPemohon = payload.NoTeleponPemohon.Trim();
        item.Catatan = payload.Catatan;
        // Replace-all: the form always sends the complete item list, so on update the old rows
        // are dropped and rewritten rather than diffed.
        item.Items.Clear();
        foreach (var row in payload.Items)
        {
            item.Items.Add(new PermintaanAtkItem
            {
                NamaBarang = row.NamaBarang.Trim(),
                Jumlah = row.Jumlah,
                Satuan = row.Satuan.Trim(),
            });
        }
    }

    private async Task<int> PeekNextNomorSequenceAsync(string divisi, int year, int month)
    {
        var counter = await _db.AtkCounters.FindAsync(divisi, year, month);
        return (counter?.LastSequence ?? 0) + 1;
    }

    private async Task<int> IncrementNomorSequenceAsync(string divisi, int year, int month)
    {
        var results = await _db.Database.SqlQueryRaw<int>(
            """
            INSERT INTO atk_counters (divisi, year, month, last_sequence)
            VALUES ({0}, {1}, {2}, 1)
            ON CONFLICT (divisi, year, month)
            DO UPDATE SET last_sequence = atk_counters.last_sequence + 1
            RETURNING last_sequence AS "Value"
            """,
            divisi, year, month
        ).ToListAsync();
        return results[0];
    }

    private static string BuildNomorPermintaan(string divisi, int seq, DateOnly tanggal) =>
        $"{seq:D4}.{OrgTree.GetKodeSatuanKerja(divisi)}.{tanggal:MM}.{tanggal:yyyy}";

    [HttpGet("next-nomor")]
    public async Task<IActionResult> NextNomor([FromQuery] DateOnly? tanggal, [FromQuery] string? divisi)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;
        var effectiveDivisi = IsGaActor(user!) && !string.IsNullOrEmpty(divisi) && OrgTree.AllDivisi.Contains(divisi)
            ? divisi
            : EffectiveDivisi(user!);
        if (string.IsNullOrEmpty(effectiveDivisi))
            return Ok(new { nomorPermintaan = "" });

        // Nomor memuat bulan/tahun, jadi tanggal acuannya harus hari kalender WIB. DateTime.UtcNow
        // masih menunjuk hari kemarin sampai pukul 07:00 WIB, yang membuat transaksi tanggal 1
        // pukul 00:30 WIB bernomor bulan sebelumnya.
        var effectiveTanggal = tanggal ?? DateOnly.FromDateTime(WaktuWib.Now);
        var seq = await PeekNextNomorSequenceAsync(effectiveDivisi, effectiveTanggal.Year, effectiveTanggal.Month);
        return Ok(new { nomorPermintaan = BuildNomorPermintaan(effectiveDivisi, seq, effectiveTanggal) });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PermintaanAtkCreate payload)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;

        var validationError = ValidatePayload(payload, IsGaActor(user!));
        if (validationError != null) return BadRequest(new { detail = validationError });

        var (divisi, departemen) = EffectiveOwner(user!, payload);
        if (string.IsNullOrEmpty(divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var item = new PermintaanAtk
        {
            CreatedBy = user!.Id,
            CreatedByRole = user.Role,
            Status = StatusEnum.DRAFT,
            Divisi = divisi,
            Departemen = departemen,
        };
        ApplyCreatePayload(item, payload);

        var seq = await IncrementNomorSequenceAsync(divisi, payload.Tanggal.Year, payload.Tanggal.Month);
        item.NomorPermintaan = BuildNomorPermintaan(divisi, seq, payload.Tanggal);
        _db.PermintaanAtks.Add(item);
        await _db.SaveChangesAsync();

        AddLog(item, "CREATED", user);
        await _db.SaveChangesAsync();

        return StatusCode(201, PermintaanAtkOut.From(item));
    }

    [HttpPut("{itemId:int}")]
    public async Task<IActionResult> Update(int itemId, [FromBody] PermintaanAtkCreate payload)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat diubah pada tahap ini" });

        var validationError = ValidatePayload(payload, IsGaActor(user!));
        if (validationError != null) return BadRequest(new { detail = validationError });

        // A rejected request goes back to DRAFT after being revised - origin still has to open it
        // and submit again explicitly (mirrors the original create flow). RejectReason is kept so
        // the note stays visible while the revision is pending.
        var wasRejected = RejectedStatuses.Contains(item.Status);

        // NomorPermintaan embeds its MM.YYYY, so reissue it (new sequence, same divisi) when the
        // edit moves the item into a different month/year, same pattern as Room Booking's
        // equivalent change.
        if (item.Tanggal.Year != payload.Tanggal.Year || item.Tanggal.Month != payload.Tanggal.Month)
        {
            var seq = await IncrementNomorSequenceAsync(item.Divisi, payload.Tanggal.Year, payload.Tanggal.Month);
            item.NomorPermintaan = BuildNomorPermintaan(item.Divisi, seq, payload.Tanggal);
        }

        // Only takes effect when Admin/Approval GA is revising a request that already has a
        // SumberPembelian on it (set earlier by ApproveGa/ApproveGaApproval) - e.g. fixing a wrong
        // pick after Approval GA/Mitra rejects it. Every other role/state leaves it untouched,
        // since first-selection still only happens via those two approve endpoints.
        var sumberPembelianChanged = false;
        if (IsGaActor(user!) && item.SumberPembelian.HasValue && payload.SumberPembelian.HasValue)
        {
            if (!Enum.IsDefined(typeof(SumberPembelianEnum), payload.SumberPembelian.Value))
                return BadRequest(new { detail = "Sumber pembelian tidak valid" });
            sumberPembelianChanged = item.SumberPembelian != payload.SumberPembelian.Value;
            item.SumberPembelian = payload.SumberPembelian.Value;
        }

        ApplyCreatePayload(item, payload);
        if (wasRejected)
        {
            item.Status = StatusEnum.DRAFT;
            AddLog(item, "REVISED", user!, sumberPembelianChanged ? $"Sumber pembelian diubah menjadi {item.SumberPembelian}" : null);
        }
        await _db.SaveChangesAsync();
        return Ok(PermintaanAtkOut.From(item));
    }

    // Same in-flight window as Room/Vehicle Booking's IsGaReschedulable - still updatable up to
    // the last tier before it's finally approved. Also reachable once rejected by Approval GA or
    // Mitra (REJECTED_GA_APPROVAL/REJECTED_KPU) - both only happen after SumberPembelian was
    // already picked, so Admin/Approval GA can still fix it here before it's revised and resent.
    private static bool IsGaUpdatable(PermintaanAtk item) => item.Status is
        StatusEnum.DRAFT or StatusEnum.SUBMITTED or StatusEnum.APPROVED_L1 or StatusEnum.APPROVED_GA
        or StatusEnum.REJECTED_GA_APPROVAL or StatusEnum.REJECTED_KPU;

    // Accepts any real phone number without guessing a regional format, but still catches
    // obviously-wrong values (empty, letters, a couple of stray digits).
    private static bool IsValidPhone(string phone) =>
        Regex.Replace(phone, "[^0-9]", "") is { Length: >= 8 and <= 15 };

    // Admin/Approval GA's own edit tool: the requester's contact details, Tujuan, and the item
    // list - Tanggal and Kategori stay the origin creator's own, same principle as Reschedule
    // leaving Nama Kegiatan untouched in Room Booking.
    [HttpPatch("{itemId:int}/updates")]
    public async Task<IActionResult> UpdateByGa(int itemId, [FromBody] AtkUpdateByGaRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaUpdatable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diperbarui pada tahap ini" });

        if (string.IsNullOrWhiteSpace(payload.NamaPemohon)) return BadRequest(new { detail = "Nama pemohon wajib diisi" });
        if (!IsValidPhone(payload.NoTeleponPemohon)) return BadRequest(new { detail = "No. telepon pemohon tidak valid" });
        if (string.IsNullOrWhiteSpace(payload.Keperluan)) return BadRequest(new { detail = "Tujuan wajib diisi" });
        if (payload.Items.Count == 0) return BadRequest(new { detail = "Minimal satu barang harus diisi" });
        if (payload.Items.Count > MaxItemRows) return BadRequest(new { detail = $"Maksimal {MaxItemRows} baris barang per permintaan" });
        foreach (var row in payload.Items)
        {
            if (string.IsNullOrWhiteSpace(row.NamaBarang)) return BadRequest(new { detail = "Nama barang wajib diisi pada setiap baris" });
            if (row.Jumlah <= 0) return BadRequest(new { detail = "Jumlah setiap barang harus lebih dari 0" });
            if (row.Jumlah > MaxJumlahPerItem) return BadRequest(new { detail = $"Jumlah setiap barang maksimal {MaxJumlahPerItem}" });
            if (string.IsNullOrWhiteSpace(row.Satuan)) return BadRequest(new { detail = "Satuan wajib diisi pada setiap baris" });
        }

        // Same "only fix what's already been picked" rule as Update() above.
        var sumberPembelianChanged = false;
        if (payload.SumberPembelian.HasValue)
        {
            if (!item.SumberPembelian.HasValue) return BadRequest(new { detail = "Sumber pembelian belum pernah dipilih" });
            if (!Enum.IsDefined(typeof(SumberPembelianEnum), payload.SumberPembelian.Value))
                return BadRequest(new { detail = "Sumber pembelian tidak valid" });
            sumberPembelianChanged = item.SumberPembelian != payload.SumberPembelian.Value;
            item.SumberPembelian = payload.SumberPembelian.Value;
        }

        item.NamaPemohon = payload.NamaPemohon.Trim();
        item.NoTeleponPemohon = payload.NoTeleponPemohon.Trim();
        item.Keperluan = payload.Keperluan.Trim();
        item.Items.Clear();
        foreach (var row in payload.Items)
        {
            item.Items.Add(new PermintaanAtkItem
            {
                NamaBarang = row.NamaBarang.Trim(),
                Jumlah = row.Jumlah,
                Satuan = row.Satuan.Trim(),
            });
        }
        var updateDetail = $"Data pemohon, tujuan, dan daftar barang diperbarui oleh {user!.Nama}";
        if (sumberPembelianChanged) updateDetail += $"; sumber pembelian diubah menjadi {item.SumberPembelian}";
        AddLog(item, "UPDATED_BY_GA", user!, updateDetail);

        await _db.SaveChangesAsync();
        return Ok(PermintaanAtkOut.From(item));
    }

    [HttpDelete("{itemId:int}")]
    public async Task<IActionResult> Delete(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat dihapus pada tahap ini" });

        _db.PermintaanAtks.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{itemId:int}/super-admin")]
    public async Task<IActionResult> SuperAdminDelete(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });

        LogDeletion(_db, "permintaan-atk", item.Id, item.NomorPermintaan, user!);
        _db.PermintaanAtks.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // "Hapus Semua" on the Super Admin page - see PengirimanController.SuperAdminBulkDelete for
    // why this mirrors List's filters and deletes in one statement.
    [HttpDelete("super-admin/bulk")]
    public async Task<IActionResult> SuperAdminBulkDelete(
        [FromQuery(Name = "status")] string? status = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery] string? direktorat = null,
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null,
        [FromQuery] DateOnly? tanggal = null,
        [FromQuery] string? sumberPembelian = null)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (roleError != null) return roleError;

        StatusEnum? statusFilter = null;
        var onlyRejected = false;
        var onlyOnApproval = false;
        if (!string.IsNullOrEmpty(status))
        {
            if (status == "REJECTED") onlyRejected = true;
            else if (status == "ON_APPROVAL") onlyOnApproval = true;
            else if (Enum.TryParse<StatusEnum>(status, out var parsedStatus)) statusFilter = parsedStatus;
            else return BadRequest(new { detail = "Status tidak valid" });
        }

        SumberPembelianEnum? sumberPembelianFilter = null;
        if (!string.IsNullOrEmpty(sumberPembelian))
        {
            if (!Enum.TryParse<SumberPembelianEnum>(sumberPembelian, out var parsedSumber))
                return BadRequest(new { detail = "Sumber pembelian tidak valid" });
            sumberPembelianFilter = parsedSumber;
        }

        IQueryable<PermintaanAtk> query;
        try
        {
            query = ApplyListFilters(_db, _db.PermintaanAtks.AsQueryable(), user!, statusFilter, divisi, departemen, direktorat, bulan, search, onlyRejected, tanggal, sumberPembelianFilter, onlyOnApproval);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var filterSummary = BuildFilterSummary(
            ("status", status), ("divisi", divisi), ("departemen", departemen), ("direktorat", direktorat),
            ("bulan", bulan), ("search", search), ("tanggal", tanggal?.ToString()), ("sumberPembelian", sumberPembelian));
        var toDelete = await query.Select(p => new { p.Id, p.NomorPermintaan }).ToListAsync();
        foreach (var row in toDelete)
            LogDeletion(_db, "permintaan-atk", row.Id, row.NomorPermintaan, user!, filterSummary);
        await _db.SaveChangesAsync();

        var deleted = await query.ExecuteDeleteAsync();
        return Ok(new { deleted });
    }

    [HttpPatch("{itemId:int}/submit")]
    public async Task<IActionResult> Submit(int itemId, [FromBody] SubmitAtkRequest? payload)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (item.Status != StatusEnum.DRAFT || !IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data hanya bisa dikirim dari status Draft" });

        // Whichever tier the submitter's own role would normally sit at gets skipped, same
        // convention as the booking modules/Pengiriman.
        var nextStatus = user!.Role switch
        {
            RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.APPROVAL_DIVISI => StatusEnum.APPROVED_L1,
            RoleEnum.ADMIN_GA => StatusEnum.APPROVED_GA,
            RoleEnum.APPROVAL_GA => StatusEnum.APPROVED_GA_APPROVAL,
            _ => StatusEnum.SUBMITTED,
        };

        // Whenever the self-skip above lands past the Admin GA tier, ApproveGa's own endpoint
        // (where SumberPembelian is normally required, see ApproveGa below) never runs for this
        // item - this is the only remaining place to capture it for that path.
        if (nextStatus is StatusEnum.APPROVED_GA or StatusEnum.APPROVED_GA_APPROVAL)
        {
            if (payload?.SumberPembelian == null)
                return BadRequest(new { detail = "Sumber pembelian wajib dipilih" });
            item.SumberPembelian = payload.SumberPembelian;
        }

        if (nextStatus == StatusEnum.APPROVED_GA_APPROVAL)
        {
            item.ApprovedByApprovalGa = user.Id;
            item.ApprovedApprovalGaAt = DateTime.UtcNow;
        }

        item.Status = nextStatus;
        item.RejectReason = null;
        AddLog(item, "SUBMITTED", user);
        await _db.SaveChangesAsync();
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user.Id), "created", "atk", item.Id, ItemLabel(item), user.Id, user.Nama, user.Role.ToString(), "Mengajukan Pesanan Kebutuhan Kantor Baru");
        return Ok(PermintaanAtkOut.From(item));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery(Name = "status")] string? status = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery] string? direktorat = null,
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null,
        [FromQuery] DateOnly? tanggal = null,
        [FromQuery] string? sumberPembelian = null)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50,1000" });
        if (page < 1)
            return BadRequest(new { detail = "Halaman harus dimulai dari 1" });

        StatusEnum? statusFilter = null;
        var onlyRejected = false;
        var onlyOnApproval = false;
        if (!string.IsNullOrEmpty(status))
        {
            if (status == "REJECTED") onlyRejected = true;
            else if (status == "ON_APPROVAL") onlyOnApproval = true;
            else if (Enum.TryParse<StatusEnum>(status, out var parsedStatus)) statusFilter = parsedStatus;
            else return BadRequest(new { detail = "Status tidak valid" });
        }

        SumberPembelianEnum? sumberPembelianFilter = null;
        if (!string.IsNullOrEmpty(sumberPembelian))
        {
            if (!Enum.TryParse<SumberPembelianEnum>(sumberPembelian, out var parsedSumber))
                return BadRequest(new { detail = "Sumber pembelian tidak valid" });
            sumberPembelianFilter = parsedSumber;
        }

        IQueryable<PermintaanAtk> query;
        try
        {
            query = ApplyListFilters(_db, _db.PermintaanAtks.AsQueryable(), user!, statusFilter, divisi, departemen, direktorat, bulan, search, onlyRejected, tanggal, sumberPembelianFilter, onlyOnApproval);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        // Count and cost-sum share the same filtered query, so pull both from one grouped
        // aggregate query instead of two separate round trips - mirrors PengirimanController.List.
        var agg = await query
            .GroupBy(p => 1)
            .Select(g => new { Total = g.Count(), Sum = g.Sum(p => (decimal?)(p.TotalHargaBarang ?? 0)) })
            .FirstOrDefaultAsync();
        var total = agg?.Total ?? 0;
        decimal? totalBulanIni = TotalVisibleRoles.Contains(user!.Role) ? (agg?.Sum ?? 0) : null;

        var items = await query
            .Include(p => p.Items)
            .OrderByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        var outItems = items.Select(PermintaanAtkOut.From).ToList();
        var itemIds = items.Select(i => i.Id).ToList();
        if (itemIds.Count > 0)
        {
            var messageTimes = await _db.PermintaanAtkChatMessages
                .Where(m => itemIds.Contains(m.PermintaanAtkId) && m.SenderId != user!.Id)
                .Select(m => new { m.PermintaanAtkId, m.CreatedAt })
                .ToListAsync();
            var lastReadAt = await _db.PermintaanAtkChatReads
                .Where(r => r.UserId == user!.Id && itemIds.Contains(r.PermintaanAtkId))
                .ToDictionaryAsync(r => r.PermintaanAtkId, r => r.LastReadAt);
            var outById = outItems.ToDictionary(o => o.Id);
            foreach (var group in messageTimes.GroupBy(m => m.PermintaanAtkId))
            {
                if (!outById.TryGetValue(group.Key, out var outItem)) continue;
                var hasRead = lastReadAt.TryGetValue(group.Key, out var readAt);
                outItem.UnreadChatCount = group.Count(m => !hasRead || m.CreatedAt > readAt);
            }

            var mentionLabel = MentionLabelForRole(user!.Role);
            var unreadItemIds = outItems.Where(i => i.UnreadChatCount > 0).Select(i => i.Id).ToList();
            if (mentionLabel != null && unreadItemIds.Count > 0)
            {
                var mentionTag = "@" + mentionLabel;
                var reads = _db.PermintaanAtkChatReads.Where(r => r.UserId == user!.Id && unreadItemIds.Contains(r.PermintaanAtkId));
                var candidateMessages = await (
                    from m in _db.PermintaanAtkChatMessages
                    where unreadItemIds.Contains(m.PermintaanAtkId) && m.SenderId != user!.Id
                    join r in reads on m.PermintaanAtkId equals r.PermintaanAtkId into rj
                    from r in rj.DefaultIfEmpty()
                    where r == null || m.CreatedAt > r.LastReadAt
                    select new { m.PermintaanAtkId, m.Message }
                ).ToListAsync();
                var mentionedIds = candidateMessages
                    .Where(m => m.Message.Contains(mentionTag, StringComparison.OrdinalIgnoreCase))
                    .Select(m => m.PermintaanAtkId)
                    .ToHashSet();
                foreach (var outItem in outItems)
                    if (mentionedIds.Contains(outItem.Id)) outItem.HasUnreadMention = true;
            }
        }

        return Ok(new PermintaanAtkListResponse
        {
            Items = outItems,
            Total = total,
            Page = page,
            Limit = limit,
            TotalBulanIni = totalBulanIni,
        });
    }

    // Single-item fetch, independent of List's pagination/filters - lets a notification banner's
    // click deep-link straight into an item's chat (or its detail) even when that item isn't on
    // whatever page/filter the Transaksi table happens to be showing right now.
    [HttpGet("{itemId:int}")]
    public async Task<IActionResult> GetOne(int itemId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPermintaanAtk(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        return Ok(PermintaanAtkOut.From(item));
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] string? bulan = null)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        IQueryable<PermintaanAtk> query = _db.PermintaanAtks.AsQueryable();
        try
        {
            query = ApplyBulanFilter(query, bulan);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        if (!string.IsNullOrEmpty(user!.Divisi) && user.Role is RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN
            or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            query = query.Where(p => p.Divisi == user.Divisi && (p.Status != StatusEnum.DRAFT || p.CreatedBy == user.Id));
        }
        else
        {
            query = query.Where(p => p.Status != StatusEnum.DRAFT || p.CreatedBy == user.Id);
        }

        var counts = await query
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        return Ok(new PermintaanAtkStatsResponse
        {
            CountsByStatus = counts.ToDictionary(c => c.Status.ToString(), c => c.Count),
        });
    }

    private async Task<(User? user, PermintaanAtk? item, IActionResult? error)> RequireL1ActorAsync(int itemId)
    {
        var user = await CurrentUser.GetCurrentUserAsync();
        if (user == null) return (null, null, StatusCode(401, new { detail = "Belum login" }));
        if (user.Role != RoleEnum.SUPER_ADMIN && user.Role != RoleEnum.APPROVAL_DEPARTEMEN && user.Role != RoleEnum.APPROVAL_DIVISI)
            return (null, null, StatusCode(403, new { detail = "Tidak memiliki akses" }));

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return (null, null, NotFound(new { detail = "Data tidak ditemukan" }));

        if (user.Role == RoleEnum.SUPER_ADMIN) return (user, item, null);

        var ok = item.Departemen != null
            ? user.Role == RoleEnum.APPROVAL_DEPARTEMEN && user.Departemen == item.Departemen
            : user.Role == RoleEnum.APPROVAL_DIVISI && user.Divisi == item.Divisi;
        if (!ok) return (null, null, StatusCode(403, new { detail = "Tidak memiliki akses" }));
        return (user, item, null);
    }

    [HttpPatch("{itemId:int}/approve-l1")]
    public async Task<IActionResult> ApproveL1(int itemId)
    {
        var (user, item, error) = await RequireL1ActorAsync(itemId);
        if (error != null) return error;
        if (!IsL1Actionable(item!))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        item!.Status = StatusEnum.APPROVED_L1;
        item.ApprovedByL1 = user!.Id;
        item.ApprovedL1At = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_L1", user);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "atk", item.Id, ItemLabel(item), user.Id, user.Nama, user.Role.ToString(), "Disetujui (Approval Departemen/Divisi)");
        return Ok(PermintaanAtkOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-l1")]
    public async Task<IActionResult> RejectL1(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, item, error) = await RequireL1ActorAsync(itemId);
        if (error != null) return error;
        if (!IsL1Actionable(item!))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item!.Status = StatusEnum.REJECTED_L1;
        item.RejectReason = payload.Reason;
        item.ApprovedByL1 = null;
        item.ApprovedL1At = null;
        AddLog(item, "REJECTED_L1", user!, payload.Reason);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "rejected", "atk", item.Id, ItemLabel(item), user.Id, user.Nama, user.Role.ToString(), "Ditolak (Approval Departemen/Divisi)");
        return Ok(PermintaanAtkOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-ga")]
    public async Task<IActionResult> ApproveGa(int itemId, [FromBody] ApproveGaAtkRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });
        if (payload.SumberPembelian == null)
            return BadRequest(new { detail = "Sumber pembelian wajib dipilih" });

        item.Status = StatusEnum.APPROVED_GA;
        item.SumberPembelian = payload.SumberPembelian;
        item.ApprovedByGa = user!.Id;
        item.ApprovedGaAt = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_GA", user);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "atk", item.Id, ItemLabel(item), user.Id, user.Nama, user.Role.ToString(), "Disetujui (Admin GA)");
        return Ok(PermintaanAtkOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga")]
    public async Task<IActionResult> RejectGa(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item.Status = StatusEnum.REJECTED_GA;
        item.RejectReason = payload.Reason;
        item.ApprovedByGa = null;
        item.ApprovedGaAt = null;
        AddLog(item, "REJECTED_GA", user!, payload.Reason);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "rejected", "atk", item.Id, ItemLabel(item), user.Id, user.Nama, user.Role.ToString(), "Ditolak (Admin GA)");
        return Ok(PermintaanAtkOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-ga-approval")]
    public async Task<IActionResult> ApproveGaApproval(int itemId, [FromBody] ApproveGaAtkRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });
        if (payload.SumberPembelian == null)
            return BadRequest(new { detail = "Sumber pembelian wajib dipilih" });

        item.Status = StatusEnum.APPROVED_GA_APPROVAL;
        item.SumberPembelian = payload.SumberPembelian;
        item.ApprovedByApprovalGa = user!.Id;
        item.ApprovedApprovalGaAt = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_GA_APPROVAL", user);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "atk", item.Id, ItemLabel(item), user.Id, user.Nama, user.Role.ToString(), "Disetujui (Approval GA)");
        return Ok(PermintaanAtkOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga-approval")]
    public async Task<IActionResult> RejectGaApproval(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item.Status = StatusEnum.REJECTED_GA_APPROVAL;
        item.RejectReason = payload.Reason;
        item.ApprovedByApprovalGa = null;
        item.ApprovedApprovalGaAt = null;
        AddLog(item, "REJECTED_GA_APPROVAL", user!, payload.Reason);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "rejected", "atk", item.Id, ItemLabel(item), user.Id, user.Nama, user.Role.ToString(), "Ditolak (Approval GA)");
        return Ok(PermintaanAtkOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-kpu")]
    public async Task<IActionResult> ApproveKpu(int itemId, [FromBody] ApproveKpuAtkRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.KPU);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsKpuActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });
        if (payload.TotalHargaBarang == null || payload.TotalHargaBarang <= 0)
            return BadRequest(new { detail = "Total harga barang wajib diisi" });

        item.Status = StatusEnum.COMPLETED;
        item.TotalHargaBarang = payload.TotalHargaBarang;
        item.ApprovedByKpu = user!.Id;
        item.ApprovedKpuAt = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_KPU", user);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approved", "atk", item.Id, ItemLabel(item), user.Id, user.Nama, user.Role.ToString(), "Disetujui (Mitra)");
        return Ok(PermintaanAtkOut.From(item));
    }

    // Lets Mitra fix their own typo in the Total Harga Barang they entered at ApproveKpu -
    // reachable any time after COMPLETED (no deadline), since a mispriced request can otherwise
    // never be corrected once it's the final, already-Approved state. Mirrors
    // PengirimanController.KoreksiHarga.
    [HttpPatch("{itemId:int}/koreksi-harga")]
    public async Task<IActionResult> KoreksiHarga(int itemId, [FromBody] ApproveKpuAtkRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.KPU);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (item.Status != StatusEnum.COMPLETED)
            return StatusCode(403, new { detail = "Harga hanya dapat dikoreksi untuk permintaan yang sudah Approved" });
        if (payload.TotalHargaBarang == null || payload.TotalHargaBarang <= 0)
            return BadRequest(new { detail = "Total harga barang wajib diisi" });

        var before = item.TotalHargaBarang;
        item.TotalHargaBarang = payload.TotalHargaBarang;
        AddLog(item, "KOREKSI_HARGA", user!, $"Total harga barang dikoreksi oleh {user!.Nama} dari Rp{before:N0} menjadi Rp{item.TotalHargaBarang:N0}");
        await _db.SaveChangesAsync();
        return Ok(PermintaanAtkOut.From(item));
    }

    // Terminal, same as every other reject in this controller - unlike Pengiriman's own
    // reject-kpu, there is no RejectTarget/revision routing here.
    [HttpPatch("{itemId:int}/reject-kpu")]
    public async Task<IActionResult> RejectKpu(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.KPU);
        if (roleError != null) return roleError;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsKpuActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item.Status = StatusEnum.REJECTED_KPU;
        item.RejectReason = payload.Reason;
        AddLog(item, "REJECTED_KPU", user!, payload.Reason);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "rejected", "atk", item.Id, ItemLabel(item), user!.Id, user!.Nama, user!.Role.ToString(), "Ditolak (Mitra)");
        return Ok(PermintaanAtkOut.From(item));
    }

    private static string? MentionLabelForRole(RoleEnum role) => role switch
    {
        RoleEnum.ADMIN_DEPARTEMEN => "Admin Departemen",
        RoleEnum.APPROVAL_DEPARTEMEN => "Approval Departemen",
        RoleEnum.ADMIN_DIVISI => "Admin Divisi",
        RoleEnum.APPROVAL_DIVISI => "Approval Divisi",
        RoleEnum.ADMIN_GA => "Admin GA",
        RoleEnum.APPROVAL_GA => "Approval GA",
        RoleEnum.KPU => "KPU",
        _ => null,
    };

    [HttpGet("{itemId:int}/logs")]
    public async Task<IActionResult> GetLogs(int itemId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.PermintaanAtks.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPermintaanAtk(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var logs = await _db.PermintaanAtkLogs
            .Include(l => l.Aktor)
            .Where(l => l.PermintaanAtkId == itemId)
            .OrderBy(l => l.CreatedAt)
            .Select(l => new PermintaanAtkLogOut(l.Id, l.Action, l.Aktor != null ? l.Aktor.Nama : null, l.Aktor != null ? l.Aktor.Role : null, l.Reason, l.CreatedAt))
            .ToListAsync();

        return Ok(logs);
    }

    // Proof-of-request certificate, only ever available once a request has actually won its final
    // Mitra sign-off - mirrors PerbaikanSaranaController.DownloadBuktiPdf.
    [HttpGet("{itemId:int}/pdf")]
    public async Task<IActionResult> DownloadBuktiPdf(int itemId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.PermintaanAtks.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPermintaanAtk(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });
        if (item.Status != StatusEnum.COMPLETED)
            return StatusCode(403, new { detail = "Bukti permintaan hanya tersedia untuk permintaan yang sudah Approved" });

        var actorNames = item.ApprovedByKpu.HasValue
            ? await _db.Users.Where(u => u.Id == item.ApprovedByKpu.Value).ToDictionaryAsync(u => u.Id, u => u.Nama)
            : new Dictionary<int, string>();
        var bytes = AtkPdfService.Generate(item, actorNames);
        return File(bytes, "application/pdf", $"Bukti-Pesanan-Kebutuhan-Kantor-{item.NomorPermintaan}.pdf");
    }
}
