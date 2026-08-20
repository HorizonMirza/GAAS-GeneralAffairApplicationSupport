using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[Route("api/booking-ruang")]
public class BookingRuangController : ApiControllerBase
{
    private static readonly HashSet<int> AllowedLimits = new() { 5, 10, 20, 50 };

    private static readonly RoleEnum[] OriginRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
    };

    // Bookings in any of these statuses are visible on everyone's calendar/list; DRAFT (not yet
    // submitted, private to its creator) and REJECTED_* (no longer a live request) are not.
    // Note this does NOT mean they block a room+slot - see PendingStatuses/ConflictBlocking
    // below, since several of these are allowed to race for the same slot simultaneously.
    private static readonly BookingStatusEnum[] ActiveStatuses =
    {
        BookingStatusEnum.SUBMITTED, BookingStatusEnum.APPROVED_L1,
        BookingStatusEnum.APPROVED_GA, BookingStatusEnum.APPROVED_GA_APPROVAL,
    };

    // Still going through approval, not yet won or lost. Multiple bookings in these statuses
    // are allowed to overlap the same room+slot at once - whichever one reaches the final
    // Approval GA sign-off first wins, and ApproveGaApproval auto-rejects the rest below.
    private static readonly BookingStatusEnum[] PendingStatuses =
    {
        BookingStatusEnum.SUBMITTED, BookingStatusEnum.APPROVED_L1, BookingStatusEnum.APPROVED_GA,
    };

    private readonly AppDbContext _db;

    public BookingRuangController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    private static bool IsEditableByOrigin(BookingRuang item, User currentUser)
    {
        if (item.CreatedBy != currentUser.Id) return false;
        if (item.Status is BookingStatusEnum.DRAFT or BookingStatusEnum.REJECTED_L1 or BookingStatusEnum.REJECTED_GA) return true;
        if (item.Status == BookingStatusEnum.REJECTED_GA_APPROVAL)
            return item.RejectTarget == RejectTargetEnum.ORIGIN;
        return false;
    }

    private static bool IsL1Actionable(BookingRuang item) => item.Status == BookingStatusEnum.SUBMITTED;

    private static bool IsGaActionable(BookingRuang item) =>
        item.Status == BookingStatusEnum.APPROVED_L1
        || (item.Status == BookingStatusEnum.REJECTED_GA_APPROVAL && item.RejectTarget == RejectTargetEnum.GA);

    private static bool IsGaApprovalActionable(BookingRuang item) => item.Status == BookingStatusEnum.APPROVED_GA;

    private void AddLog(BookingRuang item, string action, User actor, string? reason = null)
    {
        _db.BookingRuangLogs.Add(new BookingRuangLog
        {
            BookingRuangId = item.Id,
            Action = action,
            ActorId = actor.Id,
            Reason = reason,
        });
    }

    // Format "YYYY-MM", same convention as Pengiriman's bulan filter.
    private static IQueryable<BookingRuang> ApplyBulanFilter(IQueryable<BookingRuang> query, string? bulan)
    {
        if (string.IsNullOrEmpty(bulan)) return query;
        var parts = bulan.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var year) || !int.TryParse(parts[1], out var month))
            throw new ArgumentException("Format bulan harus YYYY-MM");
        return query.Where(b => b.Tanggal.Year == year && b.Tanggal.Month == month);
    }

    public static IQueryable<BookingRuang> ApplyListFilters(
        IQueryable<BookingRuang> query,
        User currentUser,
        BookingStatusEnum? statusFilter,
        string? divisi,
        string? departemen,
        string? namaRuang,
        DateOnly? tanggal,
        string? bulan = null)
    {
        if (currentUser.Role is RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN)
        {
            query = query.Where(b => b.Departemen == currentUser.Departemen
                && (b.Status != BookingStatusEnum.DRAFT || b.CreatedBy == currentUser.Id || b.RejectReason != null));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            query = query.Where(b => b.Divisi == currentUser.Divisi && b.Departemen == null
                && (b.Status != BookingStatusEnum.DRAFT || b.CreatedBy == currentUser.Id || b.RejectReason != null));
        }
        else
        {
            query = query.Where(b => b.Status != BookingStatusEnum.DRAFT);
        }

        if (statusFilter.HasValue) query = query.Where(b => b.Status == statusFilter.Value);
        if (!string.IsNullOrEmpty(divisi)) query = query.Where(b => b.Divisi == divisi);
        if (!string.IsNullOrEmpty(departemen)) query = query.Where(b => b.Departemen == departemen);
        if (!string.IsNullOrEmpty(namaRuang)) query = query.Where(b => b.NamaRuang == namaRuang);
        if (tanggal.HasValue) query = query.Where(b => b.Tanggal == tanggal.Value);

        return ApplyBulanFilter(query, bulan);
    }

    private static readonly TimeOnly OperatingStart = new(7, 0);
    private static readonly TimeOnly OperatingEnd = new(18, 0);

    private static string? ValidatePayload(BookingRuangCreate payload)
    {
        if (string.IsNullOrWhiteSpace(payload.NamaKegiatan))
            return "Nama kegiatan wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.Pic))
            return "PIC wajib diisi";
        if (payload.JumlahPeserta <= 0)
            return "Jumlah peserta harus lebih dari 0";
        if (!MeetingRooms.IsValidRoom(payload.NamaRuang))
            return "Ruang tidak ditemukan";
        if (payload.Tanggal.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            return "Ruang meeting hanya bisa dipesan pada hari Senin - Jumat";
        if (!payload.IsWholeDay)
        {
            if (payload.JamMulai == null || payload.JamSelesai == null)
                return "Jam mulai dan jam selesai wajib diisi kalau bukan sehari penuh";
            if (payload.JamMulai >= payload.JamSelesai)
                return "Jam mulai harus lebih awal dari jam selesai";
            if (payload.JamMulai < OperatingStart || payload.JamSelesai > OperatingEnd)
                return "Jam booking hanya tersedia antara 07:00 - 18:00";
        }
        return null;
    }

    private static void ApplyCreatePayload(BookingRuang item, BookingRuangCreate payload)
    {
        item.NamaKegiatan = payload.NamaKegiatan;
        item.Pic = payload.Pic;
        item.NamaRuang = payload.NamaRuang;
        item.KapasitasRuang = MeetingRooms.GetCapacity(payload.NamaRuang) ?? 0;
        item.JumlahPeserta = payload.JumlahPeserta;
        item.Tanggal = payload.Tanggal;
        item.IsWholeDay = payload.IsWholeDay;
        item.JamMulai = payload.IsWholeDay ? null : payload.JamMulai;
        item.JamSelesai = payload.IsWholeDay ? null : payload.JamSelesai;
        item.Catatan = payload.Catatan;
    }

    // Overlap is checked in memory (not pushed into the SQL predicate) since the per-room,
    // per-date candidate set is always small, and nullable TimeOnly comparisons mixed with the
    // whole-day short-circuit are simpler to get right here than in a translated LINQ expression.
    private async Task<BookingRuang?> FindConflictAsync(
        string namaRuang, DateOnly tanggal, bool isWholeDay, TimeOnly? jamMulai, TimeOnly? jamSelesai, int? excludeId = null)
    {
        // Only a booking that has already won final Approval GA sign-off actually blocks the
        // slot - two requests still going through approval are allowed to race for it, and
        // whichever one gets confirmed first auto-rejects the others (see ApproveGaApproval).
        var query = _db.BookingRuangs.Where(b =>
            b.NamaRuang == namaRuang && b.Tanggal == tanggal && b.Status == BookingStatusEnum.APPROVED_GA_APPROVAL);
        if (excludeId.HasValue) query = query.Where(b => b.Id != excludeId.Value);

        var candidates = await query.ToListAsync();
        return candidates.FirstOrDefault(existing =>
            isWholeDay || existing.IsWholeDay || (existing.JamMulai < jamSelesai && existing.JamSelesai > jamMulai));
    }

    private static string ConflictMessage(BookingRuang conflict) =>
        conflict.IsWholeDay
            ? $"{conflict.NamaRuang} sudah dipesan sehari penuh pada tanggal tersebut"
            : $"{conflict.NamaRuang} sudah dipesan jam {conflict.JamMulai:HH:mm}-{conflict.JamSelesai:HH:mm} pada tanggal tersebut";

    // Scoped per divisi + bulan + tahun, same convention as Ekspedisi's NomorTransmittal (see
    // PengirimanController.PeekNextTransmittalSequenceAsync) - the sequence resets every month
    // and stays unique per divisi. Keyed off the booking's own Tanggal, not wall-clock "now", so
    // the number always matches the MM.YYYY printed in it. Backed by a standalone counter row
    // (not derived from existing BookingRuang rows) so a number is never reused after its row is
    // deleted.
    private async Task<int> PeekNextNomorSequenceAsync(string divisi, int year, int month)
    {
        var counter = await _db.RoomBookingCounters.FindAsync(divisi, year, month);
        return (counter?.LastSequence ?? 0) + 1;
    }

    // Single atomic upsert instead of read-then-write: two concurrent Create calls for the same
    // divisi+month would otherwise both read the same LastSequence and produce duplicate
    // NomorPemesanan values. Postgres serializes concurrent INSERT ... ON CONFLICT statements on
    // the same row, so each caller is guaranteed a distinct, gap-free sequence number.
    private async Task<int> IncrementNomorSequenceAsync(string divisi, int year, int month)
    {
        var results = await _db.Database.SqlQueryRaw<int>(
            """
            INSERT INTO room_booking_counters (divisi, year, month, last_sequence)
            VALUES ({0}, {1}, {2}, 1)
            ON CONFLICT (divisi, year, month)
            DO UPDATE SET last_sequence = room_booking_counters.last_sequence + 1
            RETURNING last_sequence AS "Value"
            """,
            divisi, year, month
        ).ToListAsync();
        return results[0];
    }

    // Same format as Ekspedisi's NomorTransmittal, e.g. "0001.Corsec.08.2026" - the code names
    // the requester's divisi (OrgTree.GetKodeSatuanKerja), not the room, so editing which room a
    // draft books never invalidates the number.
    private static string BuildNomorPemesanan(string divisi, int seq, DateOnly tanggal) =>
        $"{seq:D4}.{OrgTree.GetKodeSatuanKerja(divisi)}.{tanggal:MM}.{tanggal:yyyy}";

    [HttpGet("next-nomor")]
    public async Task<IActionResult> NextNomor([FromQuery] DateOnly? tanggal)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;
        if (string.IsNullOrEmpty(user!.Divisi))
            return Ok(new { nomorPemesanan = "" });

        var effectiveTanggal = tanggal ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var seq = await PeekNextNomorSequenceAsync(user.Divisi, effectiveTanggal.Year, effectiveTanggal.Month);
        return Ok(new { nomorPemesanan = BuildNomorPemesanan(user.Divisi, seq, effectiveTanggal) });
    }

    [HttpGet("rooms")]
    public async Task<IActionResult> ListRooms()
    {
        var (_, error) = await RequireRoleAsync();
        if (error != null) return error;
        return Ok(MeetingRooms.Rooms);
    }

    // Deliberately global (no unit scoping, unlike List): room availability is a shared
    // resource, so the grid has to show the same picture to everyone or it lies to whoever
    // isn't in the booking's own unit. Approve/reject/edit still enforce role+unit as normal
    // elsewhere - this endpoint is read-only.
    [HttpGet("schedule")]
    public async Task<IActionResult> GetSchedule([FromQuery] DateOnly tanggal)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        // Draft bookings are private, but a user's own draft should still show up (in grey) on
        // their calendar as a placeholder for what they haven't submitted yet.
        var items = await _db.BookingRuangs
            .Where(b => b.Tanggal == tanggal
                && (ActiveStatuses.Contains(b.Status) || (b.Status == BookingStatusEnum.DRAFT && b.CreatedBy == user!.Id)))
            .ToListAsync();

        return Ok(items.Select(BookingRuangOut.From).ToList());
    }

    // Same visibility rules as GetSchedule (global, read-only), but spans a date range so the
    // Week/Month calendar views can load everything they need in one call instead of one
    // request per rendered day.
    [HttpGet("schedule-range")]
    public async Task<IActionResult> GetScheduleRange(
        [FromQuery] DateOnly tanggalMulai,
        [FromQuery] DateOnly tanggalSelesai,
        [FromQuery(Name = "nama_ruang")] string? namaRuang = null)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;
        if (tanggalMulai > tanggalSelesai)
            return BadRequest(new { detail = "Tanggal mulai harus sebelum atau sama dengan tanggal selesai" });

        // Draft bookings are private, but a user's own draft should still show up (in grey) on
        // their calendar as a placeholder for what they haven't submitted yet.
        var query = _db.BookingRuangs.Where(b =>
            b.Tanggal >= tanggalMulai && b.Tanggal <= tanggalSelesai
            && (ActiveStatuses.Contains(b.Status) || (b.Status == BookingStatusEnum.DRAFT && b.CreatedBy == user!.Id)));
        if (!string.IsNullOrEmpty(namaRuang)) query = query.Where(b => b.NamaRuang == namaRuang);

        var items = await query.ToListAsync();
        return Ok(items.Select(BookingRuangOut.From).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BookingRuangCreate payload)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;
        if (string.IsNullOrEmpty(user!.Divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var validationError = ValidatePayload(payload);
        if (validationError != null) return BadRequest(new { detail = validationError });

        var conflict = await FindConflictAsync(payload.NamaRuang, payload.Tanggal, payload.IsWholeDay, payload.JamMulai, payload.JamSelesai);
        if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });

        var item = new BookingRuang { CreatedBy = user.Id, CreatedByRole = user.Role, Status = BookingStatusEnum.DRAFT, Divisi = user.Divisi, Departemen = user.Departemen };
        ApplyCreatePayload(item, payload);
        var seq = await IncrementNomorSequenceAsync(item.Divisi, item.Tanggal.Year, item.Tanggal.Month);
        item.NomorPemesanan = BuildNomorPemesanan(item.Divisi, seq, item.Tanggal);
        _db.BookingRuangs.Add(item);
        await _db.SaveChangesAsync();

        AddLog(item, "CREATED", user);
        await _db.SaveChangesAsync();

        return StatusCode(201, BookingRuangOut.From(item));
    }

    [HttpPut("{itemId:int}")]
    public async Task<IActionResult> Update(int itemId, [FromBody] BookingRuangCreate payload)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat diubah pada tahap ini" });

        // Tanggal is locked once the draft is created, same as Ekspedisi - overwrite whatever
        // the payload sent with the original value up front so validation, conflict-checking,
        // and the eventual save are all consistently against the date that will actually apply.
        // NomorPemesanan's MM.YYYY (and the room+date slot this booking occupies) never goes
        // stale as a result, so no regeneration is needed here anymore.
        payload.Tanggal = item.Tanggal;

        var validationError = ValidatePayload(payload);
        if (validationError != null) return BadRequest(new { detail = validationError });

        var conflict = await FindConflictAsync(payload.NamaRuang, payload.Tanggal, payload.IsWholeDay, payload.JamMulai, payload.JamSelesai, itemId);
        if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });

        var wasRejected = item.Status is BookingStatusEnum.REJECTED_L1 or BookingStatusEnum.REJECTED_GA or BookingStatusEnum.REJECTED_GA_APPROVAL;
        ApplyCreatePayload(item, payload);
        if (wasRejected)
        {
            item.Status = BookingStatusEnum.DRAFT;
            item.RejectTarget = null;
            AddLog(item, "REVISED", user!);
        }
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item));
    }

    [HttpDelete("{itemId:int}")]
    public async Task<IActionResult> Delete(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat dihapus pada tahap ini" });

        _db.BookingRuangs.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{itemId:int}/super-admin")]
    public async Task<IActionResult> SuperAdminDelete(int itemId)
    {
        var (_, roleError) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });

        _db.BookingRuangs.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{itemId:int}/submit")]
    public async Task<IActionResult> Submit(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (item.Status != BookingStatusEnum.DRAFT || !IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data hanya bisa dikirim dari status Draft" });

        // Authoritative conflict check: this is the moment the booking becomes visible/binding
        // to everyone else, so re-verify even though Create already checked once.
        var conflict = await FindConflictAsync(item.NamaRuang, item.Tanggal, item.IsWholeDay, item.JamMulai, item.JamSelesai, itemId);
        if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });

        var skipL1 = user!.Role is RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.APPROVAL_DIVISI;
        item.Status = skipL1 ? BookingStatusEnum.APPROVED_L1 : BookingStatusEnum.SUBMITTED;
        item.RejectReason = null;
        item.RejectTarget = null;
        AddLog(item, "SUBMITTED", user);
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery(Name = "status")] BookingStatusEnum? statusFilter = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery(Name = "nama_ruang")] string? namaRuang = null,
        [FromQuery] DateOnly? tanggal = null,
        [FromQuery] string? bulan = null)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50" });

        IQueryable<BookingRuang> query;
        try
        {
            query = ApplyListFilters(_db.BookingRuangs.AsQueryable(), user!, statusFilter, divisi, departemen, namaRuang, tanggal, bulan);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(b => b.Tanggal)
            .ThenByDescending(b => b.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        var outItems = items.Select(BookingRuangOut.From).ToList();
        var itemIds = items.Select(i => i.Id).ToList();
        if (itemIds.Count > 0)
        {
            var messageTimes = await _db.BookingChatMessages
                .Where(m => itemIds.Contains(m.BookingRuangId))
                .Select(m => new { m.BookingRuangId, m.CreatedAt })
                .ToListAsync();
            var lastReadAt = await _db.BookingChatReads
                .Where(r => r.UserId == user!.Id && itemIds.Contains(r.BookingRuangId))
                .ToDictionaryAsync(r => r.BookingRuangId, r => r.LastReadAt);
            var outById = outItems.ToDictionary(o => o.Id);
            foreach (var group in messageTimes.GroupBy(m => m.BookingRuangId))
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
                var candidateMessages = await _db.BookingChatMessages
                    .Where(m => unreadItemIds.Contains(m.BookingRuangId))
                    .Select(m => new { m.BookingRuangId, m.Message, m.CreatedAt })
                    .ToListAsync();
                var mentionedIds = candidateMessages
                    .Where(m =>
                        (!lastReadAt.TryGetValue(m.BookingRuangId, out var readAt) || m.CreatedAt > readAt)
                        && m.Message.Contains(mentionTag, StringComparison.OrdinalIgnoreCase))
                    .Select(m => m.BookingRuangId)
                    .ToHashSet();
                foreach (var outItem in outItems)
                    if (mentionedIds.Contains(outItem.Id)) outItem.HasUnreadMention = true;
            }
        }

        return Ok(new BookingRuangListResponse
        {
            Items = outItems,
            Total = total,
            Page = page,
            Limit = limit,
        });
    }

    private static string? MentionLabelForRole(RoleEnum role) => role switch
    {
        RoleEnum.ADMIN_DEPARTEMEN => "Admin Departemen",
        RoleEnum.APPROVAL_DEPARTEMEN => "Approval Departemen",
        RoleEnum.ADMIN_DIVISI => "Admin Divisi",
        RoleEnum.APPROVAL_DIVISI => "Approval Divisi",
        RoleEnum.ADMIN_GA => "Admin GA",
        RoleEnum.APPROVAL_GA => "Approval GA",
        _ => null,
    };

    private async Task<(User? user, BookingRuang? item, IActionResult? error)> RequireL1ActorAsync(int itemId)
    {
        var user = await CurrentUser.GetCurrentUserAsync();
        if (user == null) return (null, null, StatusCode(401, new { detail = "Belum login" }));
        if (user.Role != RoleEnum.APPROVAL_DEPARTEMEN && user.Role != RoleEnum.APPROVAL_DIVISI)
            return (null, null, StatusCode(403, new { detail = "Tidak memiliki akses" }));

        var item = await _db.BookingRuangs.FindAsync(itemId);
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
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item));
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
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-ga")]
    public async Task<IActionResult> ApproveGa(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        item.Status = BookingStatusEnum.APPROVED_GA;
        item.ApprovedByGa = user!.Id;
        item.ApprovedGaAt = DateTime.UtcNow;
        item.RejectReason = null;
        item.RejectTarget = null;
        AddLog(item, "APPROVED_GA", user);
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga")]
    public async Task<IActionResult> RejectGa(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item.Status = BookingStatusEnum.REJECTED_GA;
        item.RejectReason = payload.Reason;
        item.RejectTarget = null;
        item.ApprovedByGa = null;
        item.ApprovedGaAt = null;
        AddLog(item, "REJECTED_GA", user!, payload.Reason);
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item));
    }

    // Multiple requests were allowed to race for the same room+slot while still pending (see
    // FindConflictAsync). Now that one of them has won final Approval GA sign-off, every other
    // still-pending request for the same overlapping slot is moot - auto-reject them back to
    // their creator instead of leaving them stuck waiting on an approval that can't happen.
    //
    // Each loser is updated via a guarded raw UPDATE (WHERE id + the exact status just read),
    // not a plain EF SaveChanges, because two Approval GA actions can run this concurrently for
    // two different winners that both name the same loser as a competitor. A plain EF update
    // would blindly overwrite whatever the other transaction already committed for that row; the
    // status guard makes the write a no-op (0 rows affected, log skipped) if the row already
    // moved on since it was read here.
    private async Task AutoRejectLosingCompetitorsAsync(BookingRuang winner, User actor)
    {
        var candidates = await _db.BookingRuangs.Where(b =>
            b.NamaRuang == winner.NamaRuang && b.Tanggal == winner.Tanggal
            && b.Id != winner.Id && PendingStatuses.Contains(b.Status)).ToListAsync();

        var losers = candidates.Where(b =>
            winner.IsWholeDay || b.IsWholeDay || (b.JamMulai < winner.JamSelesai && b.JamSelesai > winner.JamMulai));

        const string reason = "Ruang sudah dipesan oleh pengajuan lain yang lebih dulu disetujui & dikonfirmasi untuk jam yang sama.";
        foreach (var loser in losers)
        {
            var affected = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                UPDATE booking_ruang SET
                    status = 'REJECTED_GA_APPROVAL',
                    reject_reason = {reason},
                    reject_target = 'ORIGIN',
                    approved_by_l1 = NULL, approved_l1_at = NULL,
                    approved_by_ga = NULL, approved_ga_at = NULL,
                    approved_by_approval_ga = NULL, approved_approval_ga_at = NULL,
                    updated_at = {DateTime.UtcNow}
                WHERE id = {loser.Id} AND status = {loser.Status.ToString()}");
            if (affected > 0)
                AddLog(loser, "REJECTED_GA_APPROVAL", actor, reason);
        }
    }

    [HttpPatch("{itemId:int}/approve-ga-approval")]
    public async Task<IActionResult> ApproveGaApproval(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        await using var transaction = await _db.Database.BeginTransactionAsync();

        // Atomic claim: the WHERE status guard means only one of two concurrent Approval GA
        // actions on this same item can actually win it, instead of both reading APPROVED_GA in
        // memory and blindly overwriting each other's SaveChanges.
        var claimed = await _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE booking_ruang SET
                status = 'APPROVED_GA_APPROVAL',
                approved_by_approval_ga = {user!.Id},
                approved_approval_ga_at = {DateTime.UtcNow},
                reject_reason = NULL,
                updated_at = {DateTime.UtcNow}
            WHERE id = {itemId} AND status = 'APPROVED_GA'");
        if (claimed == 0)
            return StatusCode(409, new { detail = "Data sudah diproses oleh aksi lain, silakan refresh" });

        await _db.Entry(item).ReloadAsync();
        AddLog(item, "APPROVED_GA_APPROVAL", user);
        await AutoRejectLosingCompetitorsAsync(item, user);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(BookingRuangOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga-approval")]
    public async Task<IActionResult> RejectGaApproval(int itemId, [FromBody] RejectWithTargetRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        item.Status = BookingStatusEnum.REJECTED_GA_APPROVAL;
        item.RejectReason = payload.Reason;
        item.RejectTarget = payload.Target;
        item.ApprovedByApprovalGa = null;
        item.ApprovedApprovalGaAt = null;
        AddLog(item, "REJECTED_GA_APPROVAL", user!, payload.Reason);
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item));
    }

    [HttpGet("{itemId:int}/logs")]
    public async Task<IActionResult> GetLogs(int itemId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.BookingRuangs
            .Include(b => b.Logs).ThenInclude(l => l.Aktor)
            .FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessBookingRuang(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var result = item.Logs
            .OrderBy(l => l.CreatedAt)
            .Select(l => new BookingRuangLogOut(
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
