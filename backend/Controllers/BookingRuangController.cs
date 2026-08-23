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
    private const int MaxOccurrencesPerSeries = 52;
    // Flat cap across every room, not per-room capacity - matches how the business actually
    // wants this enforced (business rule, not a per-room physical limit).
    private const int MaxJumlahPeserta = 64;

    // Admin/Approval Departemen and Admin/Approval Divisi input on behalf of their own unit;
    // Admin/Approval GA input on behalf of Asset Management and General Affair (see
    // GaDivisiLabel/GaDepartemenLabel below) and skip straight past whichever approval tier is
    // theirs, same convention as Pengiriman.
    private static readonly RoleEnum[] OriginRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
        RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA,
    };

    // Admin/Approval GA accounts have no Divisi/Departemen of their own in the user record - the
    // people holding those roles actually sit in Asset Management and General Affair, under the
    // Procurement and General Affair Divisi, same mixing as Pengiriman - so bookings they input
    // are stamped with that real unit and pick up the real "PGA" kode for free.
    private const string GaDivisiLabel = "Procurement and General Affair";
    private const string GaDepartemenLabel = "Asset Management and General Affair";

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

    private static string EffectiveDivisi(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDivisiLabel : user.Divisi!;

    private static string? EffectiveDepartemen(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDepartemenLabel : user.Departemen;

    private static bool IsGaActor(User user) => user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA;

    // Admin/Approval GA act like a superadmin for this module - they can book on behalf of any
    // divisi/departemen (payload.Divisi/Departemen), not just their own GA home unit, to help
    // other divisions reserve a room. Every other role always books as itself; GA booking with no
    // Divisi chosen falls back to their own GA home unit, same as before this feature existed.
    private static (string divisi, string? departemen) EffectiveOwner(User user, BookingRuangCreate payload) =>
        IsGaActor(user) && !string.IsNullOrEmpty(payload.Divisi)
            ? (payload.Divisi, payload.Departemen)
            : (EffectiveDivisi(user), EffectiveDepartemen(user));

    // A rejected booking is a dead end for everyone, including Admin/Approval GA - there is no
    // revision-and-resubmit path in Room Booking at all (unlike Pengiriman). The only thing
    // editable by its creator is a never-submitted DRAFT.
    private static bool IsEditableByOrigin(BookingRuang item, User currentUser) =>
        item.Status == BookingStatusEnum.DRAFT && item.CreatedBy == currentUser.Id;

    // Admin/Approval GA get a separate, narrower editing right instead: while a booking is still
    // live (not yet finally approved, not rejected), they can move its room/date/time to resolve
    // a scheduling conflict - see Reschedule() below. This is deliberately independent of
    // IsEditableByOrigin above (which only ever concerns the original creator's own DRAFT).
    private static bool IsGaReschedulable(BookingRuang item) =>
        item.Status is BookingStatusEnum.DRAFT or BookingStatusEnum.SUBMITTED
            or BookingStatusEnum.APPROVED_L1 or BookingStatusEnum.APPROVED_GA;

    private static bool IsL1Actionable(BookingRuang item) => item.Status == BookingStatusEnum.SUBMITTED;

    private static bool IsGaActionable(BookingRuang item) => item.Status == BookingStatusEnum.APPROVED_L1;

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

    // Every room a booking occupies - its own primary NamaRuang plus whatever is in
    // AdditionalRooms - deduplicated. The one place both are combined for conflict-checking.
    private static List<string> RoomList(BookingRuang item) =>
        new[] { item.NamaRuang }.Concat(item.AdditionalRooms.Select(r => r.NamaRuang)).Distinct().ToList();

    private static List<string> RoomList(string primary, IEnumerable<string>? additional) =>
        new[] { primary }.Concat(additional ?? Enumerable.Empty<string>()).Distinct().ToList();

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
        string? bulan = null,
        string? search = null)
    {
        if (currentUser.Role is RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN)
        {
            query = query.Where(b => b.Departemen == currentUser.Departemen
                && (b.Status != BookingStatusEnum.DRAFT || b.CreatedBy == currentUser.Id));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            query = query.Where(b => b.Divisi == currentUser.Divisi && b.Departemen == null
                && (b.Status != BookingStatusEnum.DRAFT || b.CreatedBy == currentUser.Id));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA)
        {
            // GA already sees every non-draft item org-wide (no unit to scope to) - on top of
            // that, let them see their own drafts too now that they can input bookings.
            query = query.Where(b => b.Status != BookingStatusEnum.DRAFT || b.CreatedBy == currentUser.Id);
        }
        else
        {
            query = query.Where(b => b.Status != BookingStatusEnum.DRAFT);
        }

        if (statusFilter.HasValue) query = query.Where(b => b.Status == statusFilter.Value);
        if (!string.IsNullOrEmpty(divisi)) query = query.Where(b => b.Divisi == divisi);
        if (!string.IsNullOrEmpty(departemen)) query = query.Where(b => b.Departemen == departemen);
        if (!string.IsNullOrEmpty(namaRuang))
            query = query.Where(b => b.NamaRuang == namaRuang || b.AdditionalRooms.Any(r => r.NamaRuang == namaRuang));
        if (tanggal.HasValue) query = query.Where(b => b.Tanggal == tanggal.Value);
        if (!string.IsNullOrEmpty(search))
            query = query.Where(b => b.NomorPemesanan != null && b.NomorPemesanan.Contains(search));

        return ApplyBulanFilter(query, bulan);
    }

    private static readonly TimeOnly OperatingStart = new(7, 0);
    private static readonly TimeOnly OperatingEnd = new(18, 0);

    private static string? ValidatePayload(BookingRuangCreate payload, bool isGaActor)
    {
        if (string.IsNullOrWhiteSpace(payload.NamaKegiatan))
            return "Nama kegiatan wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.Pic))
            return "PIC wajib diisi";
        if (payload.JumlahPeserta <= 0)
            return "Jumlah peserta harus lebih dari 0";
        if (payload.JumlahPeserta > MaxJumlahPeserta)
            return $"Jumlah peserta maksimal {MaxJumlahPeserta} orang";
        if (!MeetingRooms.IsValidRoom(payload.NamaRuang))
            return "Ruang tidak ditemukan";
        // Only Admin/Approval GA can book on behalf of another unit - the field is silently
        // ignored for every other role (see EffectiveOwner below), so it's only validated
        // here when it could actually take effect.
        if (isGaActor && !string.IsNullOrEmpty(payload.Divisi))
        {
            if (!OrgTree.AllDivisi.Contains(payload.Divisi))
                return "Divisi tidak ditemukan";
            if (!string.IsNullOrEmpty(payload.Departemen) && !OrgTree.GetDepartemenOptions(payload.Divisi).Contains(payload.Departemen))
                return "Departemen tidak ditemukan pada divisi tersebut";
        }
        foreach (var room in payload.AdditionalRooms ?? new List<string>())
        {
            if (!MeetingRooms.IsValidRoom(room)) return "Ruang tambahan tidak ditemukan";
            if (room == payload.NamaRuang) return "Ruang tambahan tidak boleh sama dengan ruang utama";
        }
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
        if (payload.IsRecurring)
        {
            if (payload.RecurrenceFrequency == null)
                return "Frekuensi pengulangan wajib dipilih";
            if (payload.RecurrenceEndDate == null)
                return "Tanggal akhir pengulangan wajib diisi";
            if (payload.RecurrenceEndDate.Value < payload.Tanggal)
                return "Tanggal akhir pengulangan harus setelah tanggal mulai";
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
        item.Tipe = payload.Tipe;

        item.AdditionalRooms.Clear();
        foreach (var room in (payload.AdditionalRooms ?? new List<string>()).Distinct())
            item.AdditionalRooms.Add(new BookingRuangRoom { NamaRuang = room });
    }

    // One date per occurrence, Monday-Friday only (a computed later date can land on a weekend
    // even though the start date itself never does - ValidatePayload already rejects that).
    // Non-recurring payloads produce exactly the one date they were given. Capped so a badly
    // chosen end date (e.g. years of daily recurrence) can't create an unbounded series.
    private static List<DateOnly> BuildOccurrenceDates(BookingRuangCreate payload)
    {
        if (!payload.IsRecurring || payload.RecurrenceFrequency == null || payload.RecurrenceEndDate == null)
            return new List<DateOnly> { payload.Tanggal };

        var dates = new List<DateOnly>();
        var current = payload.Tanggal;
        var frequency = payload.RecurrenceFrequency.Value;
        while (current <= payload.RecurrenceEndDate.Value && dates.Count < MaxOccurrencesPerSeries)
        {
            if (current.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday))
                dates.Add(current);
            current = frequency switch
            {
                RecurrenceFrequencyEnum.DAILY => current.AddDays(1),
                RecurrenceFrequencyEnum.WEEKLY => current.AddDays(7),
                RecurrenceFrequencyEnum.MONTHLY => current.AddMonths(1),
                _ => current.AddDays(1),
            };
        }
        return dates;
    }

    // Overlap is checked in memory (not pushed into the SQL predicate) since the per-room,
    // per-date candidate set is always small, and nullable TimeOnly comparisons mixed with the
    // whole-day short-circuit are simpler to get right here than in a translated LINQ expression.
    private async Task<BookingRuang?> FindConflictAsync(
        List<string> rooms, DateOnly tanggal, bool isWholeDay, TimeOnly? jamMulai, TimeOnly? jamSelesai, int? excludeId = null)
    {
        // Only a booking that has already won final Approval GA sign-off actually blocks the
        // slot - two requests still going through approval are allowed to race for it, and
        // whichever one gets confirmed first auto-rejects the others (see ApproveGaApproval).
        // A room can be occupied either as a booking's primary NamaRuang or one of its
        // AdditionalRooms, so both are checked.
        var additionalMatchIds = await _db.BookingRuangRooms
            .Where(r => rooms.Contains(r.NamaRuang))
            .Select(r => r.BookingRuangId)
            .ToListAsync();

        var query = _db.BookingRuangs.Where(b =>
            b.Tanggal == tanggal && b.Status == BookingStatusEnum.APPROVED_GA_APPROVAL
            && (rooms.Contains(b.NamaRuang) || additionalMatchIds.Contains(b.Id)));
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
    public async Task<IActionResult> NextNomor([FromQuery] DateOnly? tanggal, [FromQuery] string? divisi)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;
        var effectiveDivisi = IsGaActor(user!) && !string.IsNullOrEmpty(divisi) && OrgTree.AllDivisi.Contains(divisi)
            ? divisi
            : EffectiveDivisi(user!);
        if (string.IsNullOrEmpty(effectiveDivisi))
            return Ok(new { nomorPemesanan = "" });

        var effectiveTanggal = tanggal ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var seq = await PeekNextNomorSequenceAsync(effectiveDivisi, effectiveTanggal.Year, effectiveTanggal.Month);
        return Ok(new { nomorPemesanan = BuildNomorPemesanan(effectiveDivisi, seq, effectiveTanggal) });
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
            .Include(b => b.AdditionalRooms)
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
        var query = _db.BookingRuangs.Include(b => b.AdditionalRooms).Where(b =>
            b.Tanggal >= tanggalMulai && b.Tanggal <= tanggalSelesai
            && (ActiveStatuses.Contains(b.Status) || (b.Status == BookingStatusEnum.DRAFT && b.CreatedBy == user!.Id)));
        if (!string.IsNullOrEmpty(namaRuang))
            query = query.Where(b => b.NamaRuang == namaRuang || b.AdditionalRooms.Any(r => r.NamaRuang == namaRuang));

        var items = await query.ToListAsync();
        return Ok(items.Select(BookingRuangOut.From).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BookingRuangCreate payload)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;

        var validationError = ValidatePayload(payload, IsGaActor(user!));
        if (validationError != null) return BadRequest(new { detail = validationError });

        var (divisi, departemen) = EffectiveOwner(user!, payload);
        if (string.IsNullOrEmpty(divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var occurrenceDates = BuildOccurrenceDates(payload);
        var isSeries = occurrenceDates.Count > 1;

        // A plain (non-recurring) booking keeps the original behaviour exactly: block creation
        // outright if the slot is already taken. A recurring series is more lenient per design -
        // it's still created in full, and any occurrence that collides is just flagged
        // (HasConflict) for Admin/Approval GA to fix later with the Reschedule tool, rather than
        // failing the whole series over one bad date.
        if (!isSeries)
        {
            var roomList = RoomList(payload.NamaRuang, payload.AdditionalRooms);
            var conflict = await FindConflictAsync(roomList, payload.Tanggal, payload.IsWholeDay, payload.JamMulai, payload.JamSelesai);
            if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });
        }

        var seriesId = isSeries ? Guid.NewGuid() : (Guid?)null;
        var created = new List<BookingRuang>();
        foreach (var tanggal in occurrenceDates)
        {
            var item = new BookingRuang
            {
                CreatedBy = user!.Id,
                CreatedByRole = user.Role,
                Status = BookingStatusEnum.DRAFT,
                Divisi = divisi,
                Departemen = departemen,
                SeriesId = seriesId,
                RecurrenceFrequency = isSeries ? payload.RecurrenceFrequency : null,
                RecurrenceEndDate = isSeries ? payload.RecurrenceEndDate : null,
            };
            ApplyCreatePayload(item, payload);
            item.Tanggal = tanggal;

            if (isSeries)
            {
                var roomList = RoomList(item);
                var conflict = await FindConflictAsync(roomList, tanggal, item.IsWholeDay, item.JamMulai, item.JamSelesai);
                item.HasConflict = conflict != null;
            }

            var seq = await IncrementNomorSequenceAsync(divisi, tanggal.Year, tanggal.Month);
            item.NomorPemesanan = BuildNomorPemesanan(divisi, seq, tanggal);
            _db.BookingRuangs.Add(item);
            created.Add(item);
        }
        await _db.SaveChangesAsync();

        foreach (var item in created) AddLog(item, "CREATED", user!);
        await _db.SaveChangesAsync();

        return StatusCode(201, created.Select(BookingRuangOut.From).ToList());
    }

    [HttpPut("{itemId:int}")]
    public async Task<IActionResult> Update(int itemId, [FromBody] BookingRuangCreate payload)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat diubah pada tahap ini" });

        // Tanggal and the on-behalf Divisi/Departemen (see EffectiveOwner) are both locked once
        // the draft is created, same as Ekspedisi - overwrite whatever the payload sent with the
        // original value up front so validation, conflict-checking, and the eventual save are
        // all consistently against what will actually apply. NomorPemesanan's MM.YYYY/kode (and
        // the room+date slot this booking occupies) never goes stale as a result, so no
        // regeneration is needed here anymore.
        payload.Tanggal = item.Tanggal;
        payload.Divisi = item.Divisi;
        payload.Departemen = item.Departemen;
        payload.IsRecurring = false;

        var validationError = ValidatePayload(payload, IsGaActor(user!));
        if (validationError != null) return BadRequest(new { detail = validationError });

        var roomList = RoomList(payload.NamaRuang, payload.AdditionalRooms);
        var conflict = await FindConflictAsync(roomList, payload.Tanggal, payload.IsWholeDay, payload.JamMulai, payload.JamSelesai, itemId);
        if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });

        // IsEditableByOrigin above only ever allows this for a still-DRAFT item, so there is no
        // rejected-status-to-revive branch here (unlike Pengiriman) - a rejected booking is a
        // dead end for everyone, see IsEditableByOrigin's comment.
        ApplyCreatePayload(item, payload);

        // A DRAFT series member shares its room/kegiatan/jam definition with every sibling
        // occurrence (only Tanggal differs between them) - propagate the same edit to keep them
        // consistent, same "package" convention as the approval endpoints below.
        if (item.SeriesId != null)
        {
            var siblings = await _db.BookingRuangs
                .Include(b => b.AdditionalRooms)
                .Where(b => b.SeriesId == item.SeriesId && b.Id != item.Id && b.Status == BookingStatusEnum.DRAFT)
                .ToListAsync();
            foreach (var sibling in siblings)
            {
                var siblingTanggal = sibling.Tanggal;
                ApplyCreatePayload(sibling, payload);
                sibling.Tanggal = siblingTanggal;
                var siblingRooms = RoomList(sibling);
                var siblingConflict = await FindConflictAsync(siblingRooms, siblingTanggal, sibling.IsWholeDay, sibling.JamMulai, sibling.JamSelesai, sibling.Id);
                sibling.HasConflict = siblingConflict != null;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item));
    }

    private static string? ValidateReschedule(BookingRuangReschedule payload)
    {
        if (!MeetingRooms.IsValidRoom(payload.NamaRuang))
            return "Ruang tidak ditemukan";
        foreach (var room in payload.AdditionalRooms ?? new List<string>())
        {
            if (!MeetingRooms.IsValidRoom(room)) return "Ruang tambahan tidak ditemukan";
            if (room == payload.NamaRuang) return "Ruang tambahan tidak boleh sama dengan ruang utama";
        }
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

    // Admin/Approval GA's dedicated conflict-resolution tool: move an in-flight booking's
    // room/date/time without touching anything else about it (see IsGaReschedulable and
    // BookingRuangReschedule) - deliberately separate from Update(), which stays creator-only and
    // DRAFT-only. Not gated behind IsEditableByOrigin at all. Also the one way to clear
    // HasConflict on a series occurrence that got flagged at creation/final-approval time.
    [HttpPatch("{itemId:int}/reschedule")]
    public async Task<IActionResult> Reschedule(int itemId, [FromBody] BookingRuangReschedule payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaReschedulable(item))
            return StatusCode(403, new { detail = "Jadwal tidak dapat dipindahkan pada status ini" });

        var validationError = ValidateReschedule(payload);
        if (validationError != null) return BadRequest(new { detail = validationError });

        var roomList = RoomList(payload.NamaRuang, payload.AdditionalRooms);
        var conflict = await FindConflictAsync(roomList, payload.Tanggal, payload.IsWholeDay, payload.JamMulai, payload.JamSelesai, itemId);
        if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });

        // NomorPemesanan embeds the MM.YYYY it was issued for - if the reschedule moves the
        // booking into a different month/year, reissue it (new sequence, same divisi) so it
        // doesn't go stale. Update()/normal edits never hit this because Tanggal is locked there;
        // this is the one place Tanggal can actually change.
        if (item.Tanggal.Year != payload.Tanggal.Year || item.Tanggal.Month != payload.Tanggal.Month)
        {
            var seq = await IncrementNomorSequenceAsync(item.Divisi, payload.Tanggal.Year, payload.Tanggal.Month);
            item.NomorPemesanan = BuildNomorPemesanan(item.Divisi, seq, payload.Tanggal);
        }

        item.NamaRuang = payload.NamaRuang;
        item.KapasitasRuang = MeetingRooms.GetCapacity(payload.NamaRuang) ?? 0;
        item.Tanggal = payload.Tanggal;
        item.IsWholeDay = payload.IsWholeDay;
        item.JamMulai = payload.IsWholeDay ? null : payload.JamMulai;
        item.JamSelesai = payload.IsWholeDay ? null : payload.JamSelesai;
        item.HasConflict = false;
        item.AdditionalRooms.Clear();
        foreach (var room in (payload.AdditionalRooms ?? new List<string>()).Distinct())
            item.AdditionalRooms.Add(new BookingRuangRoom { NamaRuang = room });

        var jadwalText = item.IsWholeDay
            ? $"{item.Tanggal:dd/MM/yyyy} (Sepanjang Hari)"
            : $"{item.Tanggal:dd/MM/yyyy} {item.JamMulai:HH:mm}-{item.JamSelesai:HH:mm}";
        AddLog(item, "RESCHEDULED", user!, $"Dipindahkan ke {item.NamaRuang}, {jadwalText}");

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

        // A partial series (some occurrences deleted, others not) doesn't make sense - deleting
        // one still-DRAFT occurrence removes the whole series with it.
        if (item.SeriesId != null)
        {
            var siblings = await _db.BookingRuangs
                .Where(b => b.SeriesId == item.SeriesId && b.Id != item.Id && b.Status == BookingStatusEnum.DRAFT)
                .ToListAsync();
            _db.BookingRuangs.RemoveRange(siblings);
        }

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

    // Applies the same status transition (plus whatever else `mutate` sets) to every member of
    // item's recurring series at once - "approve sekaligus 1 paket" - or, for a normal
    // non-recurring booking (SeriesId null), to just item itself. This is what a plain
    // Submit/ApproveL1/RejectL1/ApproveGa/RejectGa click resolves to; ApproveGaApproval/its
    // Submit-self-skip counterpart handle the final stage separately below since a conflict there
    // must not block the rest of the series (see FinalizeSeriesAsync).
    private async Task<List<BookingRuang>> SeriesMembersAsync(BookingRuang item) =>
        item.SeriesId == null
            ? new List<BookingRuang> { item }
            : await _db.BookingRuangs.Include(b => b.AdditionalRooms).Where(b => b.SeriesId == item.SeriesId).ToListAsync();

    private async Task ApplyToSeriesAsync(BookingRuang item, User actor, string logAction, string? reason, Action<BookingRuang> mutate)
    {
        var members = await SeriesMembersAsync(item);
        foreach (var member in members)
        {
            mutate(member);
            AddLog(member, logAction, actor, reason);
        }
    }

    [HttpPatch("{itemId:int}/submit")]
    public async Task<IActionResult> Submit(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (item.Status != BookingStatusEnum.DRAFT || !IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data hanya bisa dikirim dari status Draft" });

        // Whichever tier the submitter's own role would normally sit at gets skipped, same
        // convention as Pengiriman - this applies just the same when an Admin/Approval GA
        // account is resubmitting someone else's revised (previously rejected) booking, not just
        // their own new one, which is exactly the extra privilege they were given.
        var nextStatus = user!.Role switch
        {
            RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.APPROVAL_DIVISI => BookingStatusEnum.APPROVED_L1,
            RoleEnum.ADMIN_GA => BookingStatusEnum.APPROVED_GA,
            RoleEnum.APPROVAL_GA => BookingStatusEnum.APPROVED_GA_APPROVAL,
            _ => BookingStatusEnum.SUBMITTED,
        };

        if (nextStatus == BookingStatusEnum.APPROVED_GA_APPROVAL)
        {
            // Approval GA's self-skip lands straight on the terminal status, same as reaching it
            // via ApproveGaApproval - so it needs the same per-member conflict handling (see
            // FinalizeSeriesAsync): a conflicted occurrence doesn't block its siblings, it's just
            // left behind (still DRAFT here, since it never got the chance to become SUBMITTED)
            // flagged for a manual Reschedule instead.
            var members = await SeriesMembersAsync(item);
            foreach (var member in members) AddLog(member, "SUBMITTED", user);
            var (confirmed, conflicted) = await FinalizeSeriesAsync(members, user, fromStatus: BookingStatusEnum.DRAFT);
            await _db.SaveChangesAsync();
            await _db.Entry(item).ReloadAsync();
            return Ok(new
            {
                item = BookingRuangOut.From(item),
                detail = members.Count > 1 ? SeriesSummary(confirmed, conflicted, members.Count) : null,
            });
        }

        await ApplyToSeriesAsync(item, user, "SUBMITTED", null, member =>
        {
            member.Status = nextStatus;
            member.RejectReason = null;
            member.RejectTarget = null;
        });
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
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50" });

        IQueryable<BookingRuang> query;
        try
        {
            query = ApplyListFilters(_db.BookingRuangs.AsQueryable(), user!, statusFilter, divisi, departemen, namaRuang, tanggal, bulan, search);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var total = await query.CountAsync();
        var items = await query
            .Include(b => b.AdditionalRooms)
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

        var item = await _db.BookingRuangs.Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
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

        await ApplyToSeriesAsync(item!, user!, "APPROVED_L1", null, member =>
        {
            member.Status = BookingStatusEnum.APPROVED_L1;
            member.ApprovedByL1 = user!.Id;
            member.ApprovedL1At = DateTime.UtcNow;
            member.RejectReason = null;
        });
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item!));
    }

    [HttpPatch("{itemId:int}/reject-l1")]
    public async Task<IActionResult> RejectL1(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, item, error) = await RequireL1ActorAsync(itemId);
        if (error != null) return error;
        if (!IsL1Actionable(item!))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        await ApplyToSeriesAsync(item!, user!, "REJECTED_L1", payload.Reason, member =>
        {
            member.Status = BookingStatusEnum.REJECTED_L1;
            member.RejectReason = payload.Reason;
            member.ApprovedByL1 = null;
            member.ApprovedL1At = null;
        });
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item!));
    }

    [HttpPatch("{itemId:int}/approve-ga")]
    public async Task<IActionResult> ApproveGa(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        await ApplyToSeriesAsync(item, user!, "APPROVED_GA", null, member =>
        {
            member.Status = BookingStatusEnum.APPROVED_GA;
            member.ApprovedByGa = user!.Id;
            member.ApprovedGaAt = DateTime.UtcNow;
            member.RejectReason = null;
            member.RejectTarget = null;
        });
        await _db.SaveChangesAsync();
        return Ok(BookingRuangOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga")]
    public async Task<IActionResult> RejectGa(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        await ApplyToSeriesAsync(item, user!, "REJECTED_GA", payload.Reason, member =>
        {
            member.Status = BookingStatusEnum.REJECTED_GA;
            member.RejectReason = payload.Reason;
            member.RejectTarget = null;
            member.ApprovedByGa = null;
            member.ApprovedGaAt = null;
        });
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
        var winnerRooms = RoomList(winner);
        var additionalMatchIds = await _db.BookingRuangRooms
            .Where(r => winnerRooms.Contains(r.NamaRuang))
            .Select(r => r.BookingRuangId)
            .ToListAsync();

        var candidates = await _db.BookingRuangs.Where(b =>
            b.Tanggal == winner.Tanggal && b.Id != winner.Id && PendingStatuses.Contains(b.Status)
            && (winnerRooms.Contains(b.NamaRuang) || additionalMatchIds.Contains(b.Id))).ToListAsync();

        var losers = candidates.Where(b =>
            winner.IsWholeDay || b.IsWholeDay || (b.JamMulai < winner.JamSelesai && b.JamSelesai > winner.JamMulai));

        const string reason = "Ruang sudah dipesan oleh pengajuan lain yang lebih dulu disetujui & dikonfirmasi untuk jam yang sama.";
        foreach (var loser in losers)
        {
            var affected = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                UPDATE booking_ruang SET
                    status = 'REJECTED_GA_APPROVAL',
                    reject_reason = {reason},
                    approved_by_l1 = NULL, approved_l1_at = NULL,
                    approved_by_ga = NULL, approved_ga_at = NULL,
                    approved_by_approval_ga = NULL, approved_approval_ga_at = NULL,
                    updated_at = {DateTime.UtcNow}
                WHERE id = {loser.Id} AND status = {loser.Status.ToString()}");
            if (affected > 0)
                AddLog(loser, "REJECTED_GA_APPROVAL", actor, reason);
        }
    }

    private static string SeriesSummary(int confirmed, int conflicted, int total) =>
        conflicted > 0
            ? $"{confirmed} dari {total} jadwal berhasil dikonfirmasi, {conflicted} bentrok dan perlu dipindahkan"
            : $"Seluruh {total} jadwal berhasil dikonfirmasi";

    // The final-approval stage for a whole series: each member is claimed and re-checked for a
    // room conflict individually - one still-conflicted occurrence never blocks its siblings
    // from being confirmed (per design), it's just left at `fromStatus` with HasConflict set so
    // Admin/Approval GA can fix it later via Reschedule. Used by both ApproveGaApproval and
    // Submit()'s Approval-GA self-skip branch (fromStatus differs: APPROVED_GA vs DRAFT).
    private async Task<(int confirmed, int conflicted)> FinalizeSeriesAsync(List<BookingRuang> members, User actor, BookingStatusEnum fromStatus)
    {
        var confirmed = 0;
        var conflicted = 0;
        foreach (var member in members)
        {
            var roomList = RoomList(member);
            var conflict = await FindConflictAsync(roomList, member.Tanggal, member.IsWholeDay, member.JamMulai, member.JamSelesai, member.Id);
            if (conflict != null)
            {
                member.HasConflict = true;
                conflicted++;
                continue;
            }

            var claimed = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                UPDATE booking_ruang SET
                    status = 'APPROVED_GA_APPROVAL',
                    approved_by_approval_ga = {actor.Id},
                    approved_approval_ga_at = {DateTime.UtcNow},
                    reject_reason = NULL,
                    has_conflict = FALSE,
                    updated_at = {DateTime.UtcNow}
                WHERE id = {member.Id} AND status = {fromStatus.ToString()}");
            if (claimed == 0) continue;

            await _db.Entry(member).ReloadAsync();
            await AutoRejectLosingCompetitorsAsync(member, actor);
            confirmed++;
        }
        return (confirmed, conflicted);
    }

    [HttpPatch("{itemId:int}/approve-ga-approval")]
    public async Task<IActionResult> ApproveGaApproval(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        await using var transaction = await _db.Database.BeginTransactionAsync();

        var members = await SeriesMembersAsync(item);
        var (confirmedCount, conflictedCount) = await FinalizeSeriesAsync(members, user!, fromStatus: BookingStatusEnum.APPROVED_GA);
        if (confirmedCount == 0 && conflictedCount == 0)
            return StatusCode(409, new { detail = "Data sudah diproses oleh aksi lain, silakan refresh" });

        foreach (var member in members.Where(m => m.HasConflict)) AddLog(member, "APPROVED_GA_APPROVAL", user!, "Bentrok, perlu dipindahkan manual");
        foreach (var member in members.Where(m => m.Status == BookingStatusEnum.APPROVED_GA_APPROVAL)) AddLog(member, "APPROVED_GA_APPROVAL", user!);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();
        await _db.Entry(item).ReloadAsync();

        return Ok(new
        {
            item = BookingRuangOut.From(item),
            detail = members.Count > 1 ? SeriesSummary(confirmedCount, conflictedCount, members.Count) : null,
        });
    }

    // Plain reason-only reject, unlike Pengiriman's reject-ga-approval - there is no GA-vs-origin
    // target choice here since a rejected booking is never revised or resubmitted by anyone (see
    // IsEditableByOrigin), so there is nowhere meaningful for the reject to be "routed" to.
    [HttpPatch("{itemId:int}/reject-ga-approval")]
    public async Task<IActionResult> RejectGaApproval(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat ditolak pada status ini" });

        await using var transaction = await _db.Database.BeginTransactionAsync();

        var members = item.SeriesId == null
            ? new List<BookingRuang> { item }
            : await _db.BookingRuangs.Where(b => b.SeriesId == item.SeriesId && b.Status == BookingStatusEnum.APPROVED_GA).ToListAsync();

        var rejectedAny = false;
        foreach (var member in members)
        {
            // Atomic claim, same reasoning as ApproveGaApproval above: a competing booking's
            // ApproveGaApproval can run AutoRejectLosingCompetitorsAsync against this exact row
            // at the same instant a human rejects it here - the status guard makes only one of
            // the two writes actually take effect instead of one blindly overwriting the other.
            var claimed = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                UPDATE booking_ruang SET
                    status = 'REJECTED_GA_APPROVAL',
                    reject_reason = {payload.Reason},
                    approved_by_approval_ga = NULL, approved_approval_ga_at = NULL,
                    updated_at = {DateTime.UtcNow}
                WHERE id = {member.Id} AND status = 'APPROVED_GA'");
            if (claimed == 0) continue;

            await _db.Entry(member).ReloadAsync();
            AddLog(member, "REJECTED_GA_APPROVAL", user!, payload.Reason);
            rejectedAny = true;
        }
        if (!rejectedAny)
            return StatusCode(409, new { detail = "Data sudah diproses oleh aksi lain, silakan refresh" });

        await _db.SaveChangesAsync();
        await transaction.CommitAsync();
        await _db.Entry(item).ReloadAsync();
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

    // Proof-of-booking, only ever available once a booking has actually won its room+slot for
    // real (see IsGaApprovalActionable/ApproveGaApproval) - a still-pending booking could still
    // lose the room to a competitor, so there is nothing to hand out as "proof" before that.
    [HttpGet("{itemId:int}/pdf")]
    public async Task<IActionResult> DownloadBuktiPdf(int itemId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.BookingRuangs.Include(b => b.Pembuat).Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessBookingRuang(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });
        if (item.Status != BookingStatusEnum.APPROVED_GA_APPROVAL)
            return StatusCode(403, new { detail = "Bukti booking hanya tersedia untuk booking yang sudah Approved" });

        var bytes = BookingPdfService.Generate(item);
        return File(bytes, "application/pdf", $"Bukti-Booking-{item.NomorPemesanan}.pdf");
    }

    // Personal calendar reminder (.ics), available at any status - unlike the PDF above this is
    // not proof of anything, just a convenience so the booking (pending or confirmed) shows up in
    // the viewer's own Outlook/Google Calendar. See IcsService for the generated file itself.
    [HttpGet("{itemId:int}/ics")]
    public async Task<IActionResult> DownloadIcs(int itemId)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var item = await _db.BookingRuangs.Include(b => b.AdditionalRooms).FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessBookingRuang(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var bytes = IcsService.Generate(item);
        return File(bytes, "text/calendar", $"Booking-{item.NomorPemesanan ?? item.Id.ToString()}.ics");
    }
}
