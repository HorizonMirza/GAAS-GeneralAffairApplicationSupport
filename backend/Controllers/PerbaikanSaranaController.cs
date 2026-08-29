using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Maintenance (Perbaikan Sarana): laporan kerusakan yang mengikuti alur approval yang sama dengan
// Room/Vehicle Booking dan Permintaan ATK (Departemen/Divisi -> Admin GA -> Approval GA, tanpa
// tahap KPU). Satu laporan = satu kerusakan, jadi tidak ada tabel item seperti ATK.
[Route("api/perbaikan-sarana")]
public class PerbaikanSaranaController : ApiControllerBase
{
    // 1000 is the sentinel "unbounded" value for Overview's recent-reports list (see
    // PengirimanController for the full rationale) - 5/10/20/50 stay for the paginated
    // Transaksi table's page-size dropdown.
    private static readonly HashSet<int> AllowedLimits = new() { 5, 10, 20, 50, 1000 };
    private const int MaxDeskripsiLength = 2000;

    private static readonly RoleEnum[] OriginRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
        RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA,
    };

    // Same mixing as the other modules - Admin/Approval GA accounts have no Divisi/Departemen of
    // their own, so reports they input are stamped with the real GA unit.
    private const string GaDivisiLabel = "Procurement and General Affair";
    private const string GaDepartemenLabel = "Asset Management and General Affair";

    private static readonly BookingStatusEnum[] RejectedStatuses =
    {
        BookingStatusEnum.REJECTED_L1, BookingStatusEnum.REJECTED_GA, BookingStatusEnum.REJECTED_GA_APPROVAL,
    };

    // "Masih berjalan": sudah dikirim tapi belum selesai final dan belum ditolak - dipakai untuk
    // hitungan Urgensi Tinggi di GetStats.
    private static readonly BookingStatusEnum[] InFlightStatuses =
    {
        BookingStatusEnum.SUBMITTED, BookingStatusEnum.APPROVED_L1, BookingStatusEnum.APPROVED_GA,
    };

    private readonly AppDbContext _db;

    public PerbaikanSaranaController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    private static string EffectiveDivisi(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDivisiLabel : user.Divisi!;

    private static string? EffectiveDepartemen(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDepartemenLabel : user.Departemen;

    // A rejected report is a dead end (no revision-and-resubmit path, same as the other modules) -
    // the only thing editable by its creator is a never-submitted DRAFT.
    private static bool IsEditableByOrigin(PerbaikanSarana item, User currentUser) =>
        item.Status == BookingStatusEnum.DRAFT && item.CreatedBy == currentUser.Id;

    private static bool IsDeletableByOrigin(PerbaikanSarana item, User currentUser)
    {
        if (IsEditableByOrigin(item, currentUser)) return true;
        if (!RejectedStatuses.Contains(item.Status)) return false;
        return item.CreatedBy == currentUser.Id || currentUser.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA;
    }

    private static bool IsL1Actionable(PerbaikanSarana item) => item.Status == BookingStatusEnum.SUBMITTED;
    private static bool IsGaActionable(PerbaikanSarana item) => item.Status == BookingStatusEnum.APPROVED_L1;
    private static bool IsGaApprovalActionable(PerbaikanSarana item) => item.Status == BookingStatusEnum.APPROVED_GA;

    private void AddLog(PerbaikanSarana item, string action, User actor, string? reason = null)
    {
        _db.PerbaikanSaranaLogs.Add(new PerbaikanSaranaLog
        {
            PerbaikanSaranaId = item.Id,
            Action = action,
            ActorId = actor.Id,
            Reason = reason,
        });
    }

    private static IQueryable<PerbaikanSarana> ApplyBulanFilter(IQueryable<PerbaikanSarana> query, string? bulan)
    {
        if (string.IsNullOrEmpty(bulan)) return query;
        var parts = bulan.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var year) || !int.TryParse(parts[1], out var month))
            throw new ArgumentException("Format bulan harus YYYY-MM");
        return query.Where(p => p.Tanggal.Year == year && p.Tanggal.Month == month);
    }

    public static IQueryable<PerbaikanSarana> ApplyListFilters(
        AppDbContext db,
        IQueryable<PerbaikanSarana> query,
        User currentUser,
        BookingStatusEnum? statusFilter,
        string? divisi,
        string? departemen,
        KategoriKerusakanEnum? kategori = null,
        UrgensiEnum? urgensi = null,
        string? direktorat = null,
        string? bulan = null,
        string? search = null,
        bool onlyRejected = false)
    {
        if (currentUser.Role is RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN)
        {
            query = query.Where(p => p.Departemen == currentUser.Departemen
                && (p.Status != BookingStatusEnum.DRAFT || p.CreatedBy == currentUser.Id));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            // Own Divisi-level items keep exactly the same visibility as before (own drafts
            // included). Every child Departemen's items under this Divisi are visible too now,
            // read-only, for oversight - once they're out of DRAFT (that Departemen's own team
            // still owns its drafts-in-progress, and only that Departemen's own Approval account
            // can actually approve/reject it - this only widens visibility, not approval
            // authority).
            query = query.Where(p => p.Divisi == currentUser.Divisi && (
                (p.Departemen == null && (p.Status != BookingStatusEnum.DRAFT || p.CreatedBy == currentUser.Id))
                || (p.Departemen != null && p.Status != BookingStatusEnum.DRAFT)));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA)
        {
            query = query.Where(p => p.Status != BookingStatusEnum.DRAFT || p.CreatedBy == currentUser.Id);
        }
        else
        {
            query = query.Where(p => p.Status != BookingStatusEnum.DRAFT);
        }

        if (statusFilter.HasValue) query = query.Where(p => p.Status == statusFilter.Value);
        else if (onlyRejected) query = query.Where(p => RejectedStatuses.Contains(p.Status));
        if (kategori.HasValue) query = query.Where(p => p.Kategori == kategori.Value);
        if (urgensi.HasValue) query = query.Where(p => p.Urgensi == urgensi.Value);
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
        // Pencarian menjangkau nomor DAN lokasi - saat melaporkan kerusakan, orang lebih sering
        // ingat tempatnya ("Ruang Bromo") daripada nomor dokumennya.
        if (!string.IsNullOrEmpty(search))
            query = query.Where(p => (p.NomorPerbaikan != null && p.NomorPerbaikan.Contains(search)) || p.Lokasi.Contains(search));

        return ApplyBulanFilter(query, bulan);
    }

    private static string? ValidatePayload(PerbaikanSaranaCreate payload)
    {
        if (string.IsNullOrWhiteSpace(payload.Lokasi))
            return "Lokasi wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.DeskripsiKerusakan))
            return "Deskripsi kerusakan wajib diisi";
        if (payload.DeskripsiKerusakan.Length > MaxDeskripsiLength)
            return $"Deskripsi kerusakan maksimal {MaxDeskripsiLength} karakter";
        if (!Enum.IsDefined(typeof(KategoriKerusakanEnum), payload.Kategori))
            return "Kategori kerusakan tidak valid";
        if (!Enum.IsDefined(typeof(UrgensiEnum), payload.Urgensi))
            return "Tingkat urgensi tidak valid";
        return null;
    }

    private static void ApplyCreatePayload(PerbaikanSarana item, PerbaikanSaranaCreate payload)
    {
        item.Tanggal = payload.Tanggal;
        item.Lokasi = payload.Lokasi.Trim();
        item.Kategori = payload.Kategori;
        item.Urgensi = payload.Urgensi;
        item.DeskripsiKerusakan = payload.DeskripsiKerusakan.Trim();
        item.Catatan = payload.Catatan;
    }

    private async Task<int> PeekNextNomorSequenceAsync(string divisi, int year, int month)
    {
        var counter = await _db.SaranaCounters.FindAsync(divisi, year, month);
        return (counter?.LastSequence ?? 0) + 1;
    }

    private async Task<int> IncrementNomorSequenceAsync(string divisi, int year, int month)
    {
        var results = await _db.Database.SqlQueryRaw<int>(
            """
            INSERT INTO sarana_counters (divisi, year, month, last_sequence)
            VALUES ({0}, {1}, {2}, 1)
            ON CONFLICT (divisi, year, month)
            DO UPDATE SET last_sequence = sarana_counters.last_sequence + 1
            RETURNING last_sequence AS "Value"
            """,
            divisi, year, month
        ).ToListAsync();
        return results[0];
    }

    private static string BuildNomorPerbaikan(string divisi, int seq, DateOnly tanggal) =>
        $"{seq:D4}.{OrgTree.GetKodeSatuanKerja(divisi)}.{tanggal:MM}.{tanggal:yyyy}";

    [HttpGet("next-nomor")]
    public async Task<IActionResult> NextNomor([FromQuery] DateOnly? tanggal)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;
        var divisi = EffectiveDivisi(user!);
        if (string.IsNullOrEmpty(divisi))
            return Ok(new { nomorPerbaikan = "" });

        var effectiveTanggal = tanggal ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var seq = await PeekNextNomorSequenceAsync(divisi, effectiveTanggal.Year, effectiveTanggal.Month);
        return Ok(new { nomorPerbaikan = BuildNomorPerbaikan(divisi, seq, effectiveTanggal) });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PerbaikanSaranaCreate payload)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;

        var validationError = ValidatePayload(payload);
        if (validationError != null) return BadRequest(new { detail = validationError });

        var divisi = EffectiveDivisi(user!);
        if (string.IsNullOrEmpty(divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var item = new PerbaikanSarana
        {
            CreatedBy = user!.Id,
            CreatedByRole = user.Role,
            Status = BookingStatusEnum.DRAFT,
            Divisi = divisi,
            Departemen = EffectiveDepartemen(user),
        };
        ApplyCreatePayload(item, payload);

        var seq = await IncrementNomorSequenceAsync(divisi, payload.Tanggal.Year, payload.Tanggal.Month);
        item.NomorPerbaikan = BuildNomorPerbaikan(divisi, seq, payload.Tanggal);
        _db.PerbaikanSaranas.Add(item);
        await _db.SaveChangesAsync();

        AddLog(item, "CREATED", user);
        await _db.SaveChangesAsync();

        return StatusCode(201, PerbaikanSaranaOut.From(item));
    }

    [HttpPut("{itemId:int}")]
    public async Task<IActionResult> Update(int itemId, [FromBody] PerbaikanSaranaCreate payload)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat diubah pada tahap ini" });

        var validationError = ValidatePayload(payload);
        if (validationError != null) return BadRequest(new { detail = validationError });

        if (item.Tanggal.Year != payload.Tanggal.Year || item.Tanggal.Month != payload.Tanggal.Month)
        {
            var seq = await IncrementNomorSequenceAsync(item.Divisi, payload.Tanggal.Year, payload.Tanggal.Month);
            item.NomorPerbaikan = BuildNomorPerbaikan(item.Divisi, seq, payload.Tanggal);
        }

        ApplyCreatePayload(item, payload);
        await _db.SaveChangesAsync();
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpDelete("{itemId:int}")]
    public async Task<IActionResult> Delete(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsDeletableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat dihapus pada tahap ini" });

        _db.PerbaikanSaranas.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{itemId:int}/super-admin")]
    public async Task<IActionResult> SuperAdminDelete(int itemId)
    {
        var (_, roleError) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });

        _db.PerbaikanSaranas.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{itemId:int}/submit")]
    public async Task<IActionResult> Submit(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (item.Status != BookingStatusEnum.DRAFT || !IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data hanya bisa dikirim dari status Draft" });

        // Whichever tier the submitter's own role would normally sit at gets skipped, same
        // convention as the other modules.
        var nextStatus = user!.Role switch
        {
            RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.APPROVAL_DIVISI => BookingStatusEnum.APPROVED_L1,
            RoleEnum.ADMIN_GA => BookingStatusEnum.APPROVED_GA,
            RoleEnum.APPROVAL_GA => BookingStatusEnum.APPROVED_GA_APPROVAL,
            _ => BookingStatusEnum.SUBMITTED,
        };

        if (nextStatus == BookingStatusEnum.APPROVED_GA_APPROVAL)
        {
            item.ApprovedByApprovalGa = user.Id;
            item.ApprovedApprovalGaAt = DateTime.UtcNow;
        }

        item.Status = nextStatus;
        item.RejectReason = null;
        AddLog(item, "SUBMITTED", user);
        await _db.SaveChangesAsync();
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery(Name = "status")] string? status = null,
        [FromQuery] string? kategori = null,
        [FromQuery] string? urgensi = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery] string? direktorat = null,
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50" });

        BookingStatusEnum? statusFilter = null;
        var onlyRejected = false;
        if (!string.IsNullOrEmpty(status))
        {
            if (status == "REJECTED") onlyRejected = true;
            else if (Enum.TryParse<BookingStatusEnum>(status, out var parsedStatus)) statusFilter = parsedStatus;
            else return BadRequest(new { detail = "Status tidak valid" });
        }

        KategoriKerusakanEnum? kategoriFilter = null;
        if (!string.IsNullOrEmpty(kategori))
        {
            if (Enum.TryParse<KategoriKerusakanEnum>(kategori, out var parsedKategori)) kategoriFilter = parsedKategori;
            else return BadRequest(new { detail = "Kategori tidak valid" });
        }

        UrgensiEnum? urgensiFilter = null;
        if (!string.IsNullOrEmpty(urgensi))
        {
            if (Enum.TryParse<UrgensiEnum>(urgensi, out var parsedUrgensi)) urgensiFilter = parsedUrgensi;
            else return BadRequest(new { detail = "Urgensi tidak valid" });
        }

        IQueryable<PerbaikanSarana> query;
        try
        {
            query = ApplyListFilters(_db, _db.PerbaikanSaranas.AsQueryable(), user!, statusFilter, divisi, departemen, kategoriFilter, urgensiFilter, direktorat, bulan, search, onlyRejected);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var total = await query.CountAsync();
        var items = await query
            // Urgensi TINGGI naik ke atas dulu, baru urut terbaru - laporan darurat tidak boleh
            // tenggelam di halaman kedua hanya karena dilaporkan lebih dahulu.
            .OrderByDescending(p => p.Urgensi == UrgensiEnum.TINGGI)
            .ThenByDescending(p => p.CreatedAt)
            .ThenByDescending(p => p.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        var outItems = items.Select(PerbaikanSaranaOut.From).ToList();
        var itemIds = items.Select(i => i.Id).ToList();
        if (itemIds.Count > 0)
        {
            var messageTimes = await _db.PerbaikanSaranaChatMessages
                .Where(m => itemIds.Contains(m.PerbaikanSaranaId) && m.SenderId != user!.Id)
                .Select(m => new { m.PerbaikanSaranaId, m.CreatedAt })
                .ToListAsync();
            var lastReadAt = await _db.PerbaikanSaranaChatReads
                .Where(r => r.UserId == user!.Id && itemIds.Contains(r.PerbaikanSaranaId))
                .ToDictionaryAsync(r => r.PerbaikanSaranaId, r => r.LastReadAt);
            var outById = outItems.ToDictionary(o => o.Id);
            foreach (var group in messageTimes.GroupBy(m => m.PerbaikanSaranaId))
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
                var reads = _db.PerbaikanSaranaChatReads.Where(r => r.UserId == user!.Id && unreadItemIds.Contains(r.PerbaikanSaranaId));
                var candidateMessages = await (
                    from m in _db.PerbaikanSaranaChatMessages
                    where unreadItemIds.Contains(m.PerbaikanSaranaId) && m.SenderId != user!.Id
                    join r in reads on m.PerbaikanSaranaId equals r.PerbaikanSaranaId into rj
                    from r in rj.DefaultIfEmpty()
                    where r == null || m.CreatedAt > r.LastReadAt
                    select new { m.PerbaikanSaranaId, m.Message }
                ).ToListAsync();
                var mentionedIds = candidateMessages
                    .Where(m => m.Message.Contains(mentionTag, StringComparison.OrdinalIgnoreCase))
                    .Select(m => m.PerbaikanSaranaId)
                    .ToHashSet();
                foreach (var outItem in outItems)
                    if (mentionedIds.Contains(outItem.Id)) outItem.HasUnreadMention = true;
            }
        }

        return Ok(new PerbaikanSaranaListResponse
        {
            Items = outItems,
            Total = total,
            Page = page,
            Limit = limit,
        });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] string? bulan = null)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        IQueryable<PerbaikanSarana> query;
        try
        {
            query = ApplyListFilters(_db, _db.PerbaikanSaranas.AsQueryable(), user!, null, null, null, null, null, null, bulan);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var counts = await query
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var urgensiTinggiAktif = await query
            .CountAsync(p => p.Urgensi == UrgensiEnum.TINGGI && InFlightStatuses.Contains(p.Status));

        return Ok(new PerbaikanSaranaStatsResponse
        {
            CountsByStatus = counts.ToDictionary(c => c.Status.ToString(), c => c.Count),
            UrgensiTinggiAktif = urgensiTinggiAktif,
        });
    }

    private async Task<(User? user, PerbaikanSarana? item, IActionResult? error)> RequireL1ActorAsync(int itemId)
    {
        var user = await CurrentUser.GetCurrentUserAsync();
        if (user == null) return (null, null, StatusCode(401, new { detail = "Belum login" }));
        if (user.Role != RoleEnum.APPROVAL_DEPARTEMEN && user.Role != RoleEnum.APPROVAL_DIVISI)
            return (null, null, StatusCode(403, new { detail = "Tidak memiliki akses" }));

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return (null, null, NotFound(new { detail = "Data tidak ditemukan" }));

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

        item!.Status = BookingStatusEnum.APPROVED_L1;
        item.ApprovedByL1 = user!.Id;
        item.ApprovedL1At = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_L1", user);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-l1")]
    public async Task<IActionResult> RejectL1(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, item, error) = await RequireL1ActorAsync(itemId);
        if (error != null) return error;
        if (!IsL1Actionable(item!))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item!.Status = BookingStatusEnum.REJECTED_L1;
        item.RejectReason = payload.Reason;
        item.ApprovedByL1 = null;
        item.ApprovedL1At = null;
        AddLog(item, "REJECTED_L1", user!, payload.Reason);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-ga")]
    public async Task<IActionResult> ApproveGa(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        item.Status = BookingStatusEnum.APPROVED_GA;
        item.ApprovedByGa = user!.Id;
        item.ApprovedGaAt = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_GA", user);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga")]
    public async Task<IActionResult> RejectGa(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item.Status = BookingStatusEnum.REJECTED_GA;
        item.RejectReason = payload.Reason;
        item.ApprovedByGa = null;
        item.ApprovedGaAt = null;
        AddLog(item, "REJECTED_GA", user!, payload.Reason);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-ga-approval")]
    public async Task<IActionResult> ApproveGaApproval(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        item.Status = BookingStatusEnum.APPROVED_GA_APPROVAL;
        item.ApprovedByApprovalGa = user!.Id;
        item.ApprovedApprovalGaAt = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_GA_APPROVAL", user);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga-approval")]
    public async Task<IActionResult> RejectGaApproval(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item.Status = BookingStatusEnum.REJECTED_GA_APPROVAL;
        item.RejectReason = payload.Reason;
        item.ApprovedByApprovalGa = null;
        item.ApprovedApprovalGaAt = null;
        AddLog(item, "REJECTED_GA_APPROVAL", user!, payload.Reason);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        return Ok(PerbaikanSaranaOut.From(item));
    }

    private static string? MentionLabelForRole(RoleEnum role) => role switch
    {
        RoleEnum.ADMIN_DEPARTEMEN => "Admin Departemen",
        RoleEnum.APPROVAL_DEPARTEMEN => "Approval Departemen",
        RoleEnum.ADMIN_DIVISI => "Admin Divisi",
        RoleEnum.APPROVAL_DIVISI => "Approval Divisi",
        RoleEnum.ADMIN_GA => "Admin General Affair",
        RoleEnum.APPROVAL_GA => "Approval GA",
        _ => null,
    };

    [HttpGet("{itemId:int}/logs")]
    public async Task<IActionResult> GetLogs(int itemId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PerbaikanSaranas.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPerbaikanSarana(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var logs = await _db.PerbaikanSaranaLogs
            .Include(l => l.Aktor)
            .Where(l => l.PerbaikanSaranaId == itemId)
            .OrderBy(l => l.CreatedAt)
            .Select(l => new PerbaikanSaranaLogOut(l.Id, l.Action, l.Aktor != null ? l.Aktor.Nama : null, l.Aktor != null ? l.Aktor.Role : null, l.Reason, l.CreatedAt))
            .ToListAsync();

        return Ok(logs);
    }
}
