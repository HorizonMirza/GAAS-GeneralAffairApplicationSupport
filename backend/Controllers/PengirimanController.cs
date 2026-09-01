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

[Route("api/pengiriman")]
public class PengirimanController : ApiControllerBase
{
    // 1000 is the sentinel "unbounded" value: Overview pages' recent-transactions list is no
    // longer capped at a small page size - it fetches everything for the current bulan (which
    // naturally resets the list every month), so it needs a limit far past what anyone would
    // realistically submit in a single month. 5/10/20/50 stay for the real paginated Transaksi
    // table's page-size dropdown.
    private static readonly HashSet<int> AllowedLimits = new() { 5, 10, 20, 50, 1000 };

    // Admin/Approval Departemen and Admin/Approval Divisi input on behalf of their own unit;
    // Admin/Approval GA input on behalf of Asset Management and General Affair (see
    // GaDivisiLabel/GaDepartemenLabel below) and skip straight past whichever approval tier is
    // theirs.
    private static readonly RoleEnum[] OriginRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
        RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA,
    };

    private static readonly RoleEnum[] TotalVisibleRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
        RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU, RoleEnum.SUPER_ADMIN,
    };

    // Admin/Approval GA accounts have no Divisi/Departemen of their own in the user record (see
    // DbSeeder) - when they input on their own behalf (no on-behalf Divisi chosen, see
    // EffectiveOwner below), items are stamped with the Asset Management and General Affair unit,
    // same as everyone else there, instead of a separate GA-only bucket. That means those items
    // are visible to and mixed in with that Divisi/Departemen's own Admin/Approval accounts, and
    // the NomorTransmittal picks up the real "PGA" kode for free.
    private const string GaDivisiLabel = "Procurement and General Affair";
    private const string GaDepartemenLabel = "Asset Management and General Affair";

    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;

    public PengirimanController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub) : base(currentUser)
    {
        _db = db;
        _hub = hub;
    }

    private static string ItemLabel(Pengiriman item) => $"Pengiriman {item.NomorTransmittal}";

    private async Task<List<int>> ActivityRecipientIdsAsync(Pengiriman item, int actorId)
    {
        var users = await _db.Users.Where(u => u.Id != actorId).ToListAsync();
        return users.Where(u => CanAccessPengiriman(u, item)).Select(u => u.Id).ToList();
    }

    private static string EffectiveDivisi(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDivisiLabel : user.Divisi!;

    private static string? EffectiveDepartemen(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDepartemenLabel : user.Departemen;

    private static bool IsGaActor(User user) => user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA;

    // Admin/Approval GA act like a superadmin for this module - they can input a shipment on
    // behalf of any divisi/departemen (payload.Divisi/Departemen), not just their own GA home
    // unit, to help other divisions move faster. Every other role always inputs as itself; GA
    // inputting with no Divisi chosen falls back to their own GA home unit, same as before this
    // feature existed. Departemen is optional even when Divisi is chosen - a Divisi head can ask
    // GA to send something on the Divisi's own behalf without naming a specific Departemen.
    private static (string divisi, string? departemen) EffectiveOwner(User user, PengirimanCreate payload) =>
        IsGaActor(user) && !string.IsNullOrEmpty(payload.Divisi)
            ? (payload.Divisi, payload.Departemen)
            : (EffectiveDivisi(user), EffectiveDepartemen(user));

    private static bool IsGaOriginCreator(Pengiriman item) =>
        item.CreatedByRole is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA;

    // "Origin" for revision/reject-back purposes is always whoever actually created the item -
    // any of the OriginRoles. Whichever of them did it is the one who has to fix and resend it
    // after any reject.
    private static bool IsEditableByOrigin(Pengiriman item, User currentUser)
    {
        if (item.CreatedBy != currentUser.Id) return false;
        if (item.Status is StatusEnum.DRAFT or StatusEnum.REJECTED_L1 or StatusEnum.REJECTED_GA) return true;
        if (item.Status is StatusEnum.REJECTED_GA_APPROVAL or StatusEnum.REJECTED_KPU)
            return item.RejectTarget == RejectTargetEnum.ORIGIN;
        return false;
    }

    // Chat @mentions are tagged by role label (matching ChatModal's participant list on the
    // frontend), not by individual user, since a role can be held by more than one account.
    private static string? MentionLabelForRole(RoleEnum role) => role switch
    {
        RoleEnum.ADMIN_DEPARTEMEN => "Admin Departemen",
        RoleEnum.APPROVAL_DEPARTEMEN => "Approval Departemen",
        RoleEnum.ADMIN_DIVISI => "Admin Divisi",
        RoleEnum.APPROVAL_DIVISI => "Approval Divisi",
        RoleEnum.ADMIN_GA => "Admin General Affair",
        RoleEnum.APPROVAL_GA => "Approval GA",
        RoleEnum.KPU => "KPU",
        _ => null,
    };

    private static bool IsL1Actionable(Pengiriman item) => item.Status == StatusEnum.SUBMITTED;

    private static bool IsGaActionable(Pengiriman item) =>
        item.Status == StatusEnum.APPROVED_L1
        || (item.Status is StatusEnum.REJECTED_GA_APPROVAL or StatusEnum.REJECTED_KPU && item.RejectTarget == RejectTargetEnum.GA);

    private static bool IsGaApprovalActionable(Pengiriman item) => item.Status == StatusEnum.APPROVED_GA;

    private void AddLog(Pengiriman item, string action, User actor, string? reason = null)
    {
        _db.PengirimanLogs.Add(new PengirimanLog
        {
            PengirimanId = item.Id,
            Action = action,
            ActorId = actor.Id,
            Reason = reason,
        });
    }

    private static IQueryable<Pengiriman> ApplyBulanFilter(IQueryable<Pengiriman> query, string? bulan)
    {
        if (string.IsNullOrEmpty(bulan)) return query;
        var parts = bulan.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var year) || !int.TryParse(parts[1], out var month))
            throw new ArgumentException("Format bulan harus YYYY-MM");
        return query.Where(p => p.Tanggal.Year == year && p.Tanggal.Month == month);
    }

    // Format "YYYY-MM" - unlike ApplyBulanFilter (exact month match, used by the explicit "Filter
    // Bulan" dropdown on the Transaksi page), this is an open-ended lower bound: everything from
    // the 1st of that month onward, including future months. Used by the Overview page's
    // "Transaksi Terbaru Saya" query so upcoming items stay visible instead of disappearing once
    // the calendar rolls into next month.
    private static IQueryable<Pengiriman> ApplySejakBulanFilter(IQueryable<Pengiriman> query, string? sejakBulan)
    {
        if (string.IsNullOrEmpty(sejakBulan)) return query;
        var parts = sejakBulan.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var year) || !int.TryParse(parts[1], out var month))
            throw new ArgumentException("Format sejakBulan harus YYYY-MM");
        var from = new DateOnly(year, month, 1);
        return query.Where(p => p.Tanggal >= from);
    }

    // The 4 distinct "rejected at some stage" statuses, collapsed into one "Rejected" option in
    // the Status filter dropdown - the individual reject-stage breakdown wasn't useful there since
    // rejectTarget/StatusBadge already show which stage rejected an item on each row.
    private static readonly StatusEnum[] RejectedStatuses =
    {
        StatusEnum.REJECTED_L1, StatusEnum.REJECTED_GA, StatusEnum.REJECTED_GA_APPROVAL, StatusEnum.REJECTED_KPU,
    };

    public static IQueryable<Pengiriman> ApplyListFilters(
        AppDbContext db,
        IQueryable<Pengiriman> query,
        User currentUser,
        StatusEnum? statusFilter,
        string? divisi,
        string? departemen,
        string? direktorat,
        string? nomorTransmittal,
        string? bulan,
        string? sejakBulan = null,
        bool onlyRejected = false)
    {
        // Admin dan Approval Departemen/Divisi berbagi satu tim: keduanya melihat seluruh data
        // barang unit mereka (siapapun yang membuatnya), kecuali draft orang lain yang belum
        // pernah di-submit (masih privat milik pembuatnya).
        if (currentUser.Role is RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN)
        {
            query = query.Where(p => p.Departemen == currentUser.Departemen
                && (p.Status != StatusEnum.DRAFT || p.CreatedBy == currentUser.Id || p.RejectReason != null));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            query = query.Where(p => p.Divisi == currentUser.Divisi && p.Departemen == null
                && (p.Status != StatusEnum.DRAFT || p.CreatedBy == currentUser.Id || p.RejectReason != null));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA)
        {
            // GA already sees every non-draft item org-wide (no unit to scope to) - on top of
            // that, let them see their own drafts too now that they can input data barang.
            query = query.Where(p => p.Status != StatusEnum.DRAFT || p.CreatedBy == currentUser.Id);
        }
        else
        {
            query = query.Where(p => p.Status != StatusEnum.DRAFT);
        }

        if (statusFilter.HasValue) query = query.Where(p => p.Status == statusFilter.Value);
        else if (onlyRejected) query = query.Where(p => RejectedStatuses.Contains(p.Status));
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
        if (!string.IsNullOrEmpty(nomorTransmittal)) query = query.Where(p => EF.Functions.ILike(p.NomorTransmittal, $"%{nomorTransmittal}%"));

        return ApplySejakBulanFilter(ApplyBulanFilter(query, bulan), sejakBulan);
    }

    // Digit count only (formatting like spaces/dashes/+ is stripped first) - permissive enough
    // to accept any real phone number without guessing a specific regional format, but still
    // catches obviously-wrong values (empty, letters, a couple of stray digits) that only ever
    // get past the client because required/format checks there are trivially bypassable by
    // calling the API directly.
    private static bool IsValidPhone(string phone) =>
        Regex.Replace(phone, "[^0-9]", "") is { Length: >= 8 and <= 15 };

    private static string? ValidatePayload(PengirimanCreate payload, bool isGaActor)
    {
        // Only Admin/Approval GA can input on behalf of another unit - the field is silently
        // ignored for every other role (see EffectiveOwner above), so it's only validated here
        // when it could actually take effect.
        if (isGaActor && !string.IsNullOrEmpty(payload.Divisi))
        {
            if (!OrgTree.AllDivisi.Contains(payload.Divisi))
                return "Divisi tidak ditemukan";
            if (!string.IsNullOrEmpty(payload.Departemen) && !OrgTree.GetDepartemenOptions(payload.Divisi).Contains(payload.Departemen))
                return "Departemen tidak ditemukan pada divisi tersebut";
        }
        if (payload.JumlahItem <= 0)
            return "Jumlah barang harus lebih dari 0";
        if (string.IsNullOrWhiteSpace(payload.TujuanPenerimaan))
            return "Tujuan wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.NamaPengirim))
            return "Nama pengirim wajib diisi";
        if (!IsValidPhone(payload.NoTeleponPengirim))
            return "Nomor telepon pengirim tidak valid";
        if (string.IsNullOrWhiteSpace(payload.AlamatPengirim))
            return "Alamat pengirim wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.KodeProgram))
            return "Kode program wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.NamaPenerima))
            return "Nama penerima wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.AlamatPenerima))
            return "Alamat penerima wajib diisi";
        if (!IsValidPhone(payload.NoTeleponPenerima))
            return "Nomor telepon penerima tidak valid";
        if (string.IsNullOrWhiteSpace(payload.RequestPacking))
            return "Request packing wajib diisi";
        return null;
    }

    private static void ApplyCreatePayload(Pengiriman item, PengirimanCreate payload)
    {
        item.Tanggal = payload.Tanggal;
        item.TujuanPenerimaan = payload.TujuanPenerimaan;
        item.JumlahItem = payload.JumlahItem;
        item.NamaPengirim = payload.NamaPengirim;
        item.NoTeleponPengirim = payload.NoTeleponPengirim;
        item.AlamatPengirim = payload.AlamatPengirim;
        item.KodeProgram = payload.KodeProgram;
        item.NamaPenerima = payload.NamaPenerima;
        item.AlamatPenerima = payload.AlamatPenerima;
        item.NoTeleponPenerima = payload.NoTeleponPenerima;
        item.AsuransiStatus = payload.AsuransiStatus;
        item.RequestPacking = payload.RequestPacking;
        item.Catatan = payload.Catatan;
    }

    // Scoped per Divisi + bulan + tahun (bukan per Departemen) so the sequence resets every
    // month and stays unique together with the Kode Satuan Kerja, which is shared by every
    // Departemen under the same Divisi. Keyed off the shipment's own Tanggal, not wall-clock
    // "now", so the number always matches the MM.YYYY printed in it. Backed by a standalone
    // counter row (not derived from existing Pengiriman rows) so a number is never reused
    // after its row is deleted, even if it was the most recent one that month.
    private async Task<int> PeekNextTransmittalSequenceAsync(string divisi, int year, int month)
    {
        var counter = await _db.DivisiCounters.FindAsync(divisi, year, month);
        return (counter?.LastSequence ?? 0) + 1;
    }

    // Single atomic upsert instead of read-then-write: two concurrent Create calls for the
    // same divisi+month would otherwise both read the same LastSequence and either produce
    // duplicate NomorTransmittal values or collide on the composite PK insert. Postgres
    // serializes concurrent INSERT ... ON CONFLICT statements on the same row, so each caller
    // is guaranteed a distinct, gap-free sequence number.
    private async Task<int> IncrementTransmittalSequenceAsync(string divisi, int year, int month)
    {
        var results = await _db.Database.SqlQueryRaw<int>(
            """
            INSERT INTO divisi_counters (divisi, year, month, last_sequence)
            VALUES ({0}, {1}, {2}, 1)
            ON CONFLICT (divisi, year, month)
            DO UPDATE SET last_sequence = divisi_counters.last_sequence + 1
            RETURNING last_sequence AS "Value"
            """,
            divisi, year, month
        ).ToListAsync();
        return results[0];
    }

    private static string BuildNomorTransmittal(string divisi, int seq, DateOnly tanggal)
    {
        var kode = OrgTree.GetKodeSatuanKerja(divisi);
        return $"{seq:D4}.{kode}.{tanggal:MM}.{tanggal:yyyy}";
    }

    [HttpGet("next-transmittal")]
    public async Task<IActionResult> NextTransmittal([FromQuery] DateOnly? tanggal, [FromQuery] string? divisi)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;
        var effectiveDivisi = IsGaActor(user!) && !string.IsNullOrEmpty(divisi) && OrgTree.AllDivisi.Contains(divisi)
            ? divisi
            : EffectiveDivisi(user!);
        if (string.IsNullOrEmpty(effectiveDivisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var effectiveTanggal = tanggal ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var seq = await PeekNextTransmittalSequenceAsync(effectiveDivisi, effectiveTanggal.Year, effectiveTanggal.Month);
        var nomor = BuildNomorTransmittal(effectiveDivisi, seq, effectiveTanggal);
        return Ok(new { nomorTransmittal = nomor });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PengirimanCreate payload)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;

        var validationError = ValidatePayload(payload, IsGaActor(user!));
        if (validationError != null) return BadRequest(new { detail = validationError });

        var (divisi, departemen) = EffectiveOwner(user!, payload);
        if (string.IsNullOrEmpty(divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var item = new Pengiriman { CreatedBy = user.Id, CreatedByRole = user.Role, Status = StatusEnum.DRAFT, Divisi = divisi, Departemen = departemen };
        ApplyCreatePayload(item, payload);
        var seq = await IncrementTransmittalSequenceAsync(divisi, item.Tanggal.Year, item.Tanggal.Month);
        item.NomorTransmittal = BuildNomorTransmittal(divisi, seq, item.Tanggal);
        _db.Pengiriman.Add(item);
        await _db.SaveChangesAsync();

        AddLog(item, "CREATED", user);
        await _db.SaveChangesAsync();

        return StatusCode(201, PengirimanOut.From(item));
    }

    [HttpPut("{itemId:int}")]
    public async Task<IActionResult> Update(int itemId, [FromBody] PengirimanCreate payload)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat diubah pada tahap ini" });

        var validationError = ValidatePayload(payload, IsGaActor(user!));
        if (validationError != null) return BadRequest(new { detail = validationError });

        // A rejected-to-origin item goes back to DRAFT after being revised - Admin Departemen/
        // Divisi still has to open it and submit again explicitly (mirrors the original create
        // flow). RejectReason is kept so the note stays visible while the revision is pending.
        var wasRejected = item.Status is StatusEnum.REJECTED_L1 or StatusEnum.REJECTED_GA
            or StatusEnum.REJECTED_GA_APPROVAL or StatusEnum.REJECTED_KPU;

        // Tanggal is editable here (Divisi stays locked, unlike Tanggal) - NomorTransmittal
        // embeds its MM.YYYY, so reissue it (new sequence, same divisi) when the edit moves the
        // item into a different month/year, same pattern as Room Booking's equivalent change.
        var originalTanggal = item.Tanggal;
        if (originalTanggal.Year != payload.Tanggal.Year || originalTanggal.Month != payload.Tanggal.Month)
        {
            var seq = await IncrementTransmittalSequenceAsync(item.Divisi, payload.Tanggal.Year, payload.Tanggal.Month);
            item.NomorTransmittal = BuildNomorTransmittal(item.Divisi, seq, payload.Tanggal);
        }
        ApplyCreatePayload(item, payload);
        if (wasRejected)
        {
            item.Status = StatusEnum.DRAFT;
            item.RejectTarget = null;
            AddLog(item, "REVISED", user!);
        }
        await _db.SaveChangesAsync();
        return Ok(PengirimanOut.From(item));
    }

    [HttpDelete("{itemId:int}")]
    public async Task<IActionResult> Delete(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat dihapus pada tahap ini" });

        _db.Pengiriman.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{itemId:int}/super-admin")]
    public async Task<IActionResult> SuperAdminDelete(int itemId)
    {
        var (_, roleError) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });

        _db.Pengiriman.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{itemId:int}/submit")]
    public async Task<IActionResult> Submit(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (item.Status != StatusEnum.DRAFT || !IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data hanya bisa dikirim dari status Draft" });

        // Whichever approval tier the submitter's own role would normally sit at gets skipped -
        // approving your own submission doesn't make sense. Admin Departemen/Divisi has no tier
        // of its own to skip, so it's the only role that still goes through L1. Admin GA and
        // Approval GA skip L1 too (that tier belongs to Departemen/Divisi, not GA) on top of
        // their own.
        item.Status = user!.Role switch
        {
            RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.APPROVAL_DIVISI => StatusEnum.APPROVED_L1,
            RoleEnum.ADMIN_GA => StatusEnum.APPROVED_GA,
            RoleEnum.APPROVAL_GA => StatusEnum.APPROVED_GA_APPROVAL,
            _ => StatusEnum.SUBMITTED,
        };
        item.RejectReason = null;
        item.RejectTarget = null;
        AddLog(item, "SUBMITTED", user);
        await _db.SaveChangesAsync();
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "created", "pengiriman", item.Id, ItemLabel(item), user.Nama, "mengajukan pengiriman baru");
        return Ok(PengirimanOut.From(item));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery] string? bulan = null,
        [FromQuery(Name = "status")] string? status = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery] string? direktorat = null,
        [FromQuery(Name = "nomor_transmittal")] string? nomorTransmittal = null,
        [FromQuery] string? sejakBulan = null)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50,1000" });
        if (page < 1)
            return BadRequest(new { detail = "Halaman harus dimulai dari 1" });

        // "REJECTED" is a synthetic value the Status filter dropdown sends for its single
        // "Rejected" option - it isn't a real StatusEnum member, so it's parsed here instead of
        // via [FromQuery] enum binding (which would 400 on it).
        StatusEnum? statusFilter = null;
        var onlyRejected = false;
        if (!string.IsNullOrEmpty(status))
        {
            if (status == "REJECTED") onlyRejected = true;
            else if (Enum.TryParse<StatusEnum>(status, out var parsedStatus)) statusFilter = parsedStatus;
            else return BadRequest(new { detail = "Status tidak valid" });
        }

        IQueryable<Pengiriman> query;
        try
        {
            query = ApplyListFilters(_db, _db.Pengiriman.AsQueryable(), user!, statusFilter, divisi, departemen, direktorat, nomorTransmittal, bulan, sejakBulan, onlyRejected);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        // Count and cost-sum share the same filtered query, so pull both from one grouped
        // aggregate query instead of two separate round trips.
        var agg = await query
            .GroupBy(p => 1)
            .Select(g => new { Total = g.Count(), Sum = g.Sum(p => (decimal?)(p.Total ?? 0)) })
            .FirstOrDefaultAsync();
        var total = agg?.Total ?? 0;
        decimal? totalBulanIni = TotalVisibleRoles.Contains(user!.Role) ? (agg?.Sum ?? 0) : null;

        var items = await query
            .OrderByDescending(p => p.Tanggal)
            .ThenByDescending(p => p.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        var outItems = items.Select(PengirimanOut.From).ToList();
        var itemIds = items.Select(i => i.Id).ToList();
        if (itemIds.Count > 0)
        {
            var messageTimes = await _db.ChatMessages
                .Where(m => itemIds.Contains(m.PengirimanId))
                .Select(m => new { m.PengirimanId, m.CreatedAt })
                .ToListAsync();
            var lastReadAt = await _db.ChatReads
                .Where(r => r.UserId == user.Id && itemIds.Contains(r.PengirimanId))
                .ToDictionaryAsync(r => r.PengirimanId, r => r.LastReadAt);
            var outById = outItems.ToDictionary(o => o.Id);
            foreach (var group in messageTimes.GroupBy(m => m.PengirimanId))
            {
                if (!outById.TryGetValue(group.Key, out var outItem)) continue;
                var hasRead = lastReadAt.TryGetValue(group.Key, out var readAt);
                outItem.UnreadChatCount = group.Count(m => !hasRead || m.CreatedAt > readAt);
            }

            var mentionLabel = MentionLabelForRole(user.Role);
            var unreadItemIds = outItems.Where(i => i.UnreadChatCount > 0).Select(i => i.Id).ToList();
            if (mentionLabel != null && unreadItemIds.Count > 0)
            {
                var mentionTag = "@" + mentionLabel;
                // Unread bound applied in SQL (left join against this user's read cursor) instead
                // of fetching every candidate message's full text and filtering by CreatedAt in
                // C# afterward - only the rows that are actually unread come back from the DB.
                var reads = _db.ChatReads.Where(r => r.UserId == user.Id && unreadItemIds.Contains(r.PengirimanId));
                var candidateMessages = await (
                    from m in _db.ChatMessages
                    where unreadItemIds.Contains(m.PengirimanId)
                    join r in reads on m.PengirimanId equals r.PengirimanId into rj
                    from r in rj.DefaultIfEmpty()
                    where r == null || m.CreatedAt > r.LastReadAt
                    select new { m.PengirimanId, m.Message }
                ).ToListAsync();
                var mentionedIds = candidateMessages
                    .Where(m => m.Message.Contains(mentionTag, StringComparison.OrdinalIgnoreCase))
                    .Select(m => m.PengirimanId)
                    .ToHashSet();
                foreach (var outItem in outItems)
                    if (mentionedIds.Contains(outItem.Id)) outItem.HasUnreadMention = true;
            }
        }

        return Ok(new PengirimanListResponse
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

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPengiriman(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        return Ok(PengirimanOut.From(item));
    }

    // Status breakdown for a scope (e.g. Overview's stat cards) in one query instead of one
    // List() call per status - List() itself still does the extra chat/mention work per item,
    // which none of these counts need.
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] string? bulan = null)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        IQueryable<Pengiriman> query;
        try
        {
            query = ApplyListFilters(_db, _db.Pengiriman.AsQueryable(), user!, null, null, null, null, null, bulan);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var counts = await query
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        // Mirrors IsL1Actionable/IsGaActionable/IsGaApprovalActionable/ApproveKpu's status guard
        // exactly, instead of leaving the frontend to reconstruct "which statuses count as
        // actionable for this stage" from CountsByStatus alone - that reconstruction is exactly
        // what drifted out of sync with RejectTarget-gated statuses (REJECTED_GA_APPROVAL,
        // REJECTED_KPU) across the two places that used to do it (Ekspedisi Overview and
        // DashboardStats).
        var waitingL1 = await query.CountAsync(p => p.Status == StatusEnum.SUBMITTED);
        var waitingGa = await query.CountAsync(p =>
            p.Status == StatusEnum.APPROVED_L1
            || ((p.Status == StatusEnum.REJECTED_GA_APPROVAL || p.Status == StatusEnum.REJECTED_KPU) && p.RejectTarget == RejectTargetEnum.GA));
        var waitingGaApproval = await query.CountAsync(p => p.Status == StatusEnum.APPROVED_GA);
        var waitingKpu = await query.CountAsync(p => p.Status == StatusEnum.APPROVED_GA_APPROVAL);

        decimal? totalBulanIni = null;
        if (TotalVisibleRoles.Contains(user!.Role))
            totalBulanIni = await query.SumAsync(p => p.Total ?? 0);

        return Ok(new PengirimanStatsResponse
        {
            CountsByStatus = counts.ToDictionary(c => c.Status.ToString(), c => c.Count),
            WaitingL1 = waitingL1,
            WaitingGa = waitingGa,
            WaitingGaApproval = waitingGaApproval,
            WaitingKpu = waitingKpu,
            TotalBulanIni = totalBulanIni,
        });
    }

    private async Task<(User? user, Pengiriman? item, IActionResult? error)> RequireL1ActorAsync(int itemId)
    {
        var user = await CurrentUser.GetCurrentUserAsync();
        if (user == null) return (null, null, StatusCode(401, new { detail = "Belum login" }));
        if (user.Role != RoleEnum.APPROVAL_DEPARTEMEN && user.Role != RoleEnum.APPROVAL_DIVISI)
            return (null, null, StatusCode(403, new { detail = "Tidak memiliki akses" }));

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return (null, null, NotFound(new { detail = "Data tidak ditemukan" }));

        // Routed by the item's own unit (not by who created it), so it works the same whether
        // the item was originally created by Admin (normal path) or is an Admin's revision of
        // something an Approval account created and later got kicked back.
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
        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "pengiriman", item.Id, ItemLabel(item), user.Nama, "menyetujui (Approval Departemen/Divisi)");
        return Ok(PengirimanOut.From(item));
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
        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "pengiriman", item.Id, ItemLabel(item), user.Nama, "menolak (Approval Departemen/Divisi)");
        return Ok(PengirimanOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-ga")]
    public async Task<IActionResult> ApproveGa(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        item.Status = StatusEnum.APPROVED_GA;
        item.ApprovedByGa = user!.Id;
        item.ApprovedGaAt = DateTime.UtcNow;
        item.RejectReason = null;
        item.RejectTarget = null;
        AddLog(item, "APPROVED_GA", user);
        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "pengiriman", item.Id, ItemLabel(item), user.Nama, "menyetujui (Admin GA)");
        return Ok(PengirimanOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga")]
    public async Task<IActionResult> RejectGa(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        // Admin GA reject always goes back to whoever created it (origin) - IsEditableByOrigin
        // resolves that to the actual creator, Admin or Approval Departemen/Divisi.
        item.Status = StatusEnum.REJECTED_GA;
        item.RejectReason = payload.Reason;
        item.RejectTarget = null;
        item.ApprovedByGa = null;
        item.ApprovedGaAt = null;
        AddLog(item, "REJECTED_GA", user!, payload.Reason);
        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "pengiriman", item.Id, ItemLabel(item), user!.Nama, "menolak (Admin GA)");
        return Ok(PengirimanOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-ga-approval")]
    public async Task<IActionResult> ApproveGaApproval(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        item.Status = StatusEnum.APPROVED_GA_APPROVAL;
        item.ApprovedByApprovalGa = user!.Id;
        item.ApprovedApprovalGaAt = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_GA_APPROVAL", user);
        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "pengiriman", item.Id, ItemLabel(item), user.Nama, "menyetujui (Approval GA)");
        return Ok(PengirimanOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga-approval")]
    public async Task<IActionResult> RejectGaApproval(int itemId, [FromBody] RejectWithTargetRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item.Status = StatusEnum.REJECTED_GA_APPROVAL;
        item.RejectReason = payload.Reason;
        // When Admin/Approval GA input their own data, "send to GA" and "send to origin" are
        // the same destination (they are the origin) - always resolve to ORIGIN instead of
        // making the rejecter pick between two labels for the same person.
        item.RejectTarget = IsGaOriginCreator(item) ? RejectTargetEnum.ORIGIN : payload.Target;
        item.ApprovedByApprovalGa = null;
        item.ApprovedApprovalGaAt = null;
        AddLog(item, "REJECTED_GA_APPROVAL", user!, payload.Reason);
        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "pengiriman", item.Id, ItemLabel(item), user!.Nama, "menolak (Approval GA)");
        return Ok(PengirimanOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-kpu")]
    public async Task<IActionResult> ApproveKpu(int itemId, [FromBody] ApproveKpuRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.KPU);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (item.Status != StatusEnum.APPROVED_GA_APPROVAL)
            return StatusCode(403, new { detail = "Data harus disetujui Approval General Affair terlebih dahulu" });

        if (string.IsNullOrWhiteSpace(payload.NoResi))
            return StatusCode(400, new { detail = "No Resi wajib diisi" });
        if (payload.BeratBarangKg <= 0)
            return StatusCode(400, new { detail = "Berat barang harus lebih dari 0" });
        if (payload.AsuransiHarga < 0)
            return StatusCode(400, new { detail = "Asuransi tidak boleh negatif" });
        if (payload.SubTotal <= 0)
            return StatusCode(400, new { detail = "Ongkos kirim harus lebih dari 0" });

        item.NoResi = payload.NoResi;
        item.BeratBarangKg = payload.BeratBarangKg;
        item.AsuransiHarga = payload.AsuransiHarga;
        item.SubTotal = payload.SubTotal;
        // Total is always derived here from SubTotal + AsuransiHarga - never trust the client's
        // number directly, so a stale/buggy/tampered client can't write an inconsistent Total
        // into the permanent monthly cost recap.
        item.Total = payload.SubTotal + payload.AsuransiHarga;
        item.Status = StatusEnum.COMPLETED;
        item.ApprovedByKpu = user!.Id;
        item.ApprovedKpuAt = DateTime.UtcNow;
        item.RejectReason = null;
        item.RejectTarget = null;
        AddLog(item, "APPROVED_KPU", user);
        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "pengiriman", item.Id, ItemLabel(item), user.Nama, "menyetujui (KPU)");
        return Ok(PengirimanOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-kpu")]
    public async Task<IActionResult> RejectKpu(int itemId, [FromBody] RejectWithTargetRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.KPU);
        if (roleError != null) return roleError;

        var item = await _db.Pengiriman.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (item.Status != StatusEnum.APPROVED_GA_APPROVAL)
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item.Status = StatusEnum.REJECTED_KPU;
        item.RejectReason = payload.Reason;
        // Same collapse as RejectGaApproval: Admin/Approval GA's own items always bounce back
        // to them specifically, whichever GA role they are, never to a different GA role.
        item.RejectTarget = IsGaOriginCreator(item) ? RejectTargetEnum.ORIGIN : payload.Target;
        AddLog(item, "REJECTED_KPU", user!, payload.Reason);
        var conflict = await TrySaveChangesAsync(_db);
        if (conflict != null) return conflict;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "pengiriman", item.Id, ItemLabel(item), user!.Nama, "menolak (KPU)");
        return Ok(PengirimanOut.From(item));
    }

    [HttpGet("{itemId:int}/logs")]
    public async Task<IActionResult> GetLogs(int itemId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.Pengiriman
            .Include(p => p.Logs).ThenInclude(l => l.Aktor)
            .FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPengiriman(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var result = item.Logs
            .OrderBy(l => l.CreatedAt)
            .Select(l => new PengirimanLogOut(
                l.Id,
                l.Action,
                l.Aktor?.Nama,
                l.Aktor?.Role,
                l.Reason,
                l.CreatedAt
            ))
            .ToList();

        return Ok(result);
    }
}
