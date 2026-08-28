using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Same 3-stage approval workflow as Room Booking (Departemen/Divisi -> Admin GA -> Approval GA),
// scaled down: one vehicle per booking, no recurring series, no waitlist, no ICS feed. A booking
// only actually blocks its vehicle+slot once it reaches the final APPROVED_GA_APPROVAL status -
// see FindConflictAsync - so, unlike a naive "block on any pending request", two requests for the
// same vehicle+time are both allowed to go through approval and whichever is confirmed first wins.
[Route("api/booking-kendaraan")]
public class BookingKendaraanController : ApiControllerBase
{
    // 1000 is the sentinel "unbounded" value for Overview's recent-bookings list (see
    // PengirimanController for the full rationale) - 5/10/20/50 stay for the paginated
    // Transaksi table's page-size dropdown.
    private static readonly HashSet<int> AllowedLimits = new() { 5, 10, 20, 50, 1000 };
    private const int MaxJumlahPenumpang = 30;

    private static readonly RoleEnum[] OriginRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
        RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA,
    };

    // Same mixing as Room Booking/Pengiriman - Admin/Approval GA accounts have no Divisi/
    // Departemen of their own, so bookings they input on their own behalf are stamped with the
    // real Asset Management and General Affair / Procurement and General Affair unit.
    private const string GaDivisiLabel = "Procurement and General Affair";
    private const string GaDepartemenLabel = "Asset Management and General Affair";

    private static readonly BookingStatusEnum[] ActiveStatuses =
    {
        BookingStatusEnum.SUBMITTED, BookingStatusEnum.APPROVED_L1,
        BookingStatusEnum.APPROVED_GA, BookingStatusEnum.APPROVED_GA_APPROVAL,
    };

    private static readonly BookingStatusEnum[] RejectedStatuses =
    {
        BookingStatusEnum.REJECTED_L1, BookingStatusEnum.REJECTED_GA, BookingStatusEnum.REJECTED_GA_APPROVAL,
    };

    private readonly AppDbContext _db;

    public BookingKendaraanController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    private static string EffectiveDivisi(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDivisiLabel : user.Divisi!;

    private static string? EffectiveDepartemen(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDepartemenLabel : user.Departemen;

    private static bool IsGaActor(User user) => user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA;

    private static (string divisi, string? departemen) EffectiveOwner(User user, BookingKendaraanCreate payload) =>
        IsGaActor(user) && !string.IsNullOrEmpty(payload.Divisi)
            ? (payload.Divisi, payload.Departemen)
            : (EffectiveDivisi(user), EffectiveDepartemen(user));

    // A rejected booking is a dead end for everyone - there is no revision-and-resubmit path
    // here (same as Room Booking). The only thing editable by its creator is a never-submitted
    // DRAFT.
    private static bool IsEditableByOrigin(BookingKendaraan item, User currentUser) =>
        item.Status == BookingStatusEnum.DRAFT && item.CreatedBy == currentUser.Id;

    private static bool IsDeletableByOrigin(BookingKendaraan item, User currentUser)
    {
        if (IsEditableByOrigin(item, currentUser)) return true;
        if (!RejectedStatuses.Contains(item.Status)) return false;
        return item.CreatedBy == currentUser.Id || currentUser.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA;
    }

    private static bool IsGaReschedulable(BookingKendaraan item) =>
        item.Status is BookingStatusEnum.DRAFT or BookingStatusEnum.SUBMITTED
            or BookingStatusEnum.APPROVED_L1 or BookingStatusEnum.APPROVED_GA;

    private static bool IsL1Actionable(BookingKendaraan item) => item.Status == BookingStatusEnum.SUBMITTED;
    private static bool IsGaActionable(BookingKendaraan item) => item.Status == BookingStatusEnum.APPROVED_L1;
    private static bool IsGaApprovalActionable(BookingKendaraan item) => item.Status == BookingStatusEnum.APPROVED_GA;

    private void AddLog(BookingKendaraan item, string action, User actor, string? reason = null)
    {
        _db.BookingKendaraanLogs.Add(new BookingKendaraanLog
        {
            BookingKendaraanId = item.Id,
            Action = action,
            ActorId = actor.Id,
            Reason = reason,
        });
    }

    private static IQueryable<BookingKendaraan> ApplyBulanFilter(IQueryable<BookingKendaraan> query, string? bulan)
    {
        if (string.IsNullOrEmpty(bulan)) return query;
        var parts = bulan.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var year) || !int.TryParse(parts[1], out var month))
            throw new ArgumentException("Format bulan harus YYYY-MM");
        return query.Where(b => b.Tanggal.Year == year && b.Tanggal.Month == month);
    }

    private static IQueryable<BookingKendaraan> ApplySejakBulanFilter(IQueryable<BookingKendaraan> query, string? sejakBulan)
    {
        if (string.IsNullOrEmpty(sejakBulan)) return query;
        var parts = sejakBulan.Split('-');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var year) || !int.TryParse(parts[1], out var month))
            throw new ArgumentException("Format sejakBulan harus YYYY-MM");
        var from = new DateOnly(year, month, 1);
        return query.Where(b => b.Tanggal >= from);
    }

    public static IQueryable<BookingKendaraan> ApplyListFilters(
        AppDbContext db,
        IQueryable<BookingKendaraan> query,
        User currentUser,
        BookingStatusEnum? statusFilter,
        string? divisi,
        string? departemen,
        string? namaKendaraan,
        DateOnly? tanggal,
        string? direktorat = null,
        string? bulan = null,
        string? search = null,
        string? sejakBulan = null,
        bool onlyRejected = false)
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
            query = query.Where(b => b.Status != BookingStatusEnum.DRAFT || b.CreatedBy == currentUser.Id);
        }
        else
        {
            query = query.Where(b => b.Status != BookingStatusEnum.DRAFT);
        }

        if (statusFilter.HasValue) query = query.Where(b => b.Status == statusFilter.Value);
        else if (onlyRejected) query = query.Where(b => RejectedStatuses.Contains(b.Status));
        if (!string.IsNullOrEmpty(divisi)) query = query.Where(b => b.Divisi == divisi);
        if (!string.IsNullOrEmpty(departemen)) query = query.Where(b => b.Departemen == departemen);
        if (!string.IsNullOrEmpty(direktorat))
            query = query.Where(b => db.Users.Any(u => u.Id == b.CreatedBy && u.Direktorat == direktorat));
        if (!string.IsNullOrEmpty(namaKendaraan)) query = query.Where(b => b.NamaKendaraan == namaKendaraan);
        if (tanggal.HasValue) query = query.Where(b => b.Tanggal == tanggal.Value);
        if (!string.IsNullOrEmpty(search))
            query = query.Where(b => b.NomorPemesanan != null && b.NomorPemesanan.Contains(search));

        return ApplySejakBulanFilter(ApplyBulanFilter(query, bulan), sejakBulan);
    }

    private static readonly TimeOnly OperatingStart = new(7, 0);
    private static readonly TimeOnly OperatingEnd = new(18, 0);

    private static string? ValidatePayload(BookingKendaraanCreate payload, bool isGaActor)
    {
        if (string.IsNullOrWhiteSpace(payload.Keperluan))
            return "Keperluan wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.Pic))
            return "PIC wajib diisi";
        if (payload.JumlahPenumpang <= 0)
            return "Jumlah penumpang harus lebih dari 0";
        if (payload.JumlahPenumpang > MaxJumlahPenumpang)
            return $"Jumlah penumpang maksimal {MaxJumlahPenumpang} orang";
        if (!Vehicles.IsValidVehicle(payload.NamaKendaraan))
            return "Kendaraan tidak ditemukan";
        var kapasitas = Vehicles.GetKapasitas(payload.NamaKendaraan) ?? 0;
        if (payload.JumlahPenumpang > kapasitas)
            return $"Jumlah penumpang melebihi kapasitas kendaraan ({kapasitas} orang)";
        if (isGaActor && !string.IsNullOrEmpty(payload.Divisi))
        {
            if (!OrgTree.AllDivisi.Contains(payload.Divisi))
                return "Divisi tidak ditemukan";
            if (!string.IsNullOrEmpty(payload.Departemen) && !OrgTree.GetDepartemenOptions(payload.Divisi).Contains(payload.Departemen))
                return "Departemen tidak ditemukan pada divisi tersebut";
        }
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

    private static void ApplyCreatePayload(BookingKendaraan item, BookingKendaraanCreate payload)
    {
        item.Keperluan = payload.Keperluan;
        item.Pic = payload.Pic;
        item.NamaKendaraan = payload.NamaKendaraan;
        item.PlatNomor = Vehicles.GetPlatNomor(payload.NamaKendaraan);
        item.KapasitasKendaraan = Vehicles.GetKapasitas(payload.NamaKendaraan) ?? 0;
        item.Supir = Vehicles.GetSupir(payload.NamaKendaraan);
        item.JumlahPenumpang = payload.JumlahPenumpang;
        item.Tanggal = payload.Tanggal;
        item.IsWholeDay = payload.IsWholeDay;
        item.JamMulai = payload.IsWholeDay ? null : payload.JamMulai;
        item.JamSelesai = payload.IsWholeDay ? null : payload.JamSelesai;
        item.Catatan = payload.Catatan;
    }

    // Only a booking that has already won final Approval GA sign-off actually blocks the slot -
    // same racing-then-final-wins model as Room Booking's FindConflictAsync, minus the multi-
    // room/series handling this module doesn't have.
    private async Task<BookingKendaraan?> FindConflictAsync(
        string namaKendaraan, DateOnly tanggal, bool isWholeDay, TimeOnly? jamMulai, TimeOnly? jamSelesai, int? excludeId = null)
    {
        var query = _db.BookingKendaraans.Where(b =>
            b.Tanggal == tanggal && b.NamaKendaraan == namaKendaraan && b.Status == BookingStatusEnum.APPROVED_GA_APPROVAL);
        if (excludeId.HasValue) query = query.Where(b => b.Id != excludeId.Value);

        var candidates = await query.ToListAsync();
        return candidates.FirstOrDefault(existing =>
            isWholeDay || existing.IsWholeDay || (existing.JamMulai < jamSelesai && existing.JamSelesai > jamMulai));
    }

    private static string ConflictMessage(BookingKendaraan conflict) =>
        conflict.IsWholeDay
            ? $"{conflict.NamaKendaraan} sudah dipesan sehari penuh pada tanggal tersebut"
            : $"{conflict.NamaKendaraan} sudah dipesan jam {conflict.JamMulai:HH:mm}-{conflict.JamSelesai:HH:mm} pada tanggal tersebut";

    private async Task<int> PeekNextNomorSequenceAsync(string divisi, int year, int month)
    {
        var counter = await _db.KendaraanBookingCounters.FindAsync(divisi, year, month);
        return (counter?.LastSequence ?? 0) + 1;
    }

    private async Task<int> IncrementNomorSequenceAsync(string divisi, int year, int month)
    {
        var results = await _db.Database.SqlQueryRaw<int>(
            """
            INSERT INTO kendaraan_booking_counters (divisi, year, month, last_sequence)
            VALUES ({0}, {1}, {2}, 1)
            ON CONFLICT (divisi, year, month)
            DO UPDATE SET last_sequence = kendaraan_booking_counters.last_sequence + 1
            RETURNING last_sequence AS "Value"
            """,
            divisi, year, month
        ).ToListAsync();
        return results[0];
    }

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

    [HttpGet("vehicles")]
    public async Task<IActionResult> ListVehicles()
    {
        var (_, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;
        return Ok(Vehicles.Fleet);
    }

    // Deliberately global (no unit scoping, unlike List): vehicle availability is a shared
    // resource, so the grid has to show the same picture to everyone.
    [HttpGet("schedule")]
    public async Task<IActionResult> GetSchedule([FromQuery] DateOnly tanggal)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var items = await _db.BookingKendaraans
            .Where(b => b.Tanggal == tanggal
                && (ActiveStatuses.Contains(b.Status) || (b.Status == BookingStatusEnum.DRAFT && b.CreatedBy == user!.Id)))
            .ToListAsync();

        return Ok(items.Select(BookingKendaraanOut.From).ToList());
    }

    [HttpGet("schedule-range")]
    public async Task<IActionResult> GetScheduleRange(
        [FromQuery] DateOnly tanggalMulai,
        [FromQuery] DateOnly tanggalSelesai,
        [FromQuery(Name = "nama_kendaraan")] string? namaKendaraan = null)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;
        if (tanggalMulai > tanggalSelesai)
            return BadRequest(new { detail = "Tanggal mulai harus sebelum atau sama dengan tanggal selesai" });

        var query = _db.BookingKendaraans.Where(b =>
            b.Tanggal >= tanggalMulai && b.Tanggal <= tanggalSelesai
            && (ActiveStatuses.Contains(b.Status) || (b.Status == BookingStatusEnum.DRAFT && b.CreatedBy == user!.Id)));
        if (!string.IsNullOrEmpty(namaKendaraan))
            query = query.Where(b => b.NamaKendaraan == namaKendaraan);

        var items = await query.ToListAsync();
        return Ok(items.Select(BookingKendaraanOut.From).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BookingKendaraanCreate payload)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;

        var validationError = ValidatePayload(payload, IsGaActor(user!));
        if (validationError != null) return BadRequest(new { detail = validationError });

        var (divisi, departemen) = EffectiveOwner(user!, payload);
        if (string.IsNullOrEmpty(divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var conflict = await FindConflictAsync(payload.NamaKendaraan, payload.Tanggal, payload.IsWholeDay, payload.JamMulai, payload.JamSelesai);
        if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });

        var item = new BookingKendaraan
        {
            CreatedBy = user!.Id,
            CreatedByRole = user.Role,
            Status = BookingStatusEnum.DRAFT,
            Divisi = divisi,
            Departemen = departemen,
        };
        ApplyCreatePayload(item, payload);

        var seq = await IncrementNomorSequenceAsync(divisi, payload.Tanggal.Year, payload.Tanggal.Month);
        item.NomorPemesanan = BuildNomorPemesanan(divisi, seq, payload.Tanggal);
        _db.BookingKendaraans.Add(item);
        await _db.SaveChangesAsync();

        AddLog(item, "CREATED", user);
        await _db.SaveChangesAsync();

        return StatusCode(201, BookingKendaraanOut.From(item));
    }

    [HttpPut("{itemId:int}")]
    public async Task<IActionResult> Update(int itemId, [FromBody] BookingKendaraanCreate payload)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.BookingKendaraans.FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat diubah pada tahap ini" });

        // The on-behalf Divisi/Departemen (see EffectiveOwner) stay locked once the draft is
        // created - the owning unit never changes after creation.
        payload.Divisi = item.Divisi;
        payload.Departemen = item.Departemen;

        var validationError = ValidatePayload(payload, IsGaActor(user!));
        if (validationError != null) return BadRequest(new { detail = validationError });

        var conflict = await FindConflictAsync(payload.NamaKendaraan, payload.Tanggal, payload.IsWholeDay, payload.JamMulai, payload.JamSelesai, itemId);
        if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });

        if (item.Tanggal.Year != payload.Tanggal.Year || item.Tanggal.Month != payload.Tanggal.Month)
        {
            var seq = await IncrementNomorSequenceAsync(item.Divisi, payload.Tanggal.Year, payload.Tanggal.Month);
            item.NomorPemesanan = BuildNomorPemesanan(item.Divisi, seq, payload.Tanggal);
        }

        ApplyCreatePayload(item, payload);
        await _db.SaveChangesAsync();
        return Ok(BookingKendaraanOut.From(item));
    }

    private static string? ValidateReschedule(BookingKendaraanReschedule payload)
    {
        if (!Vehicles.IsValidVehicle(payload.NamaKendaraan))
            return "Kendaraan tidak ditemukan";
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
    // vehicle/date/time without touching anything else about it. Not gated behind
    // IsEditableByOrigin at all.
    [HttpPatch("{itemId:int}/reschedule")]
    public async Task<IActionResult> Reschedule(int itemId, [FromBody] BookingKendaraanReschedule payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingKendaraans.FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaReschedulable(item))
            return StatusCode(403, new { detail = "Jadwal tidak dapat dipindahkan pada status ini" });

        var validationError = ValidateReschedule(payload);
        if (validationError != null) return BadRequest(new { detail = validationError });

        var conflict = await FindConflictAsync(payload.NamaKendaraan, payload.Tanggal, payload.IsWholeDay, payload.JamMulai, payload.JamSelesai, itemId);
        if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });

        if (item.Tanggal.Year != payload.Tanggal.Year || item.Tanggal.Month != payload.Tanggal.Month)
        {
            var seq = await IncrementNomorSequenceAsync(item.Divisi, payload.Tanggal.Year, payload.Tanggal.Month);
            item.NomorPemesanan = BuildNomorPemesanan(item.Divisi, seq, payload.Tanggal);
        }

        item.NamaKendaraan = payload.NamaKendaraan;
        item.PlatNomor = Vehicles.GetPlatNomor(payload.NamaKendaraan);
        item.KapasitasKendaraan = Vehicles.GetKapasitas(payload.NamaKendaraan) ?? 0;
        item.Supir = Vehicles.GetSupir(payload.NamaKendaraan);
        item.Tanggal = payload.Tanggal;
        item.IsWholeDay = payload.IsWholeDay;
        item.JamMulai = payload.IsWholeDay ? null : payload.JamMulai;
        item.JamSelesai = payload.IsWholeDay ? null : payload.JamSelesai;

        var jadwalText = item.IsWholeDay
            ? $"{item.Tanggal:dd/MM/yyyy} (Sepanjang Hari)"
            : $"{item.Tanggal:dd/MM/yyyy} {item.JamMulai:HH:mm}-{item.JamSelesai:HH:mm}";
        AddLog(item, "RESCHEDULED", user!, $"Dipindahkan ke {item.NamaKendaraan}, {jadwalText}");

        await _db.SaveChangesAsync();
        return Ok(BookingKendaraanOut.From(item));
    }

    [HttpDelete("{itemId:int}")]
    public async Task<IActionResult> Delete(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.BookingKendaraans.FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsDeletableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat dihapus pada tahap ini" });

        _db.BookingKendaraans.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{itemId:int}/super-admin")]
    public async Task<IActionResult> SuperAdminDelete(int itemId)
    {
        var (_, roleError) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (roleError != null) return roleError;

        var item = await _db.BookingKendaraans.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });

        _db.BookingKendaraans.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{itemId:int}/submit")]
    public async Task<IActionResult> Submit(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.BookingKendaraans.FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (item.Status != BookingStatusEnum.DRAFT || !IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data hanya bisa dikirim dari status Draft" });

        // Whichever tier the submitter's own role would normally sit at gets skipped, same
        // convention as Room Booking/Pengiriman.
        var nextStatus = user!.Role switch
        {
            RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.APPROVAL_DIVISI => BookingStatusEnum.APPROVED_L1,
            RoleEnum.ADMIN_GA => BookingStatusEnum.APPROVED_GA,
            RoleEnum.APPROVAL_GA => BookingStatusEnum.APPROVED_GA_APPROVAL,
            _ => BookingStatusEnum.SUBMITTED,
        };

        if (nextStatus == BookingStatusEnum.APPROVED_GA_APPROVAL)
        {
            var conflict = await FindConflictAsync(item.NamaKendaraan, item.Tanggal, item.IsWholeDay, item.JamMulai, item.JamSelesai, item.Id);
            if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });
            item.ApprovedByApprovalGa = user.Id;
            item.ApprovedApprovalGaAt = DateTime.UtcNow;
        }

        item.Status = nextStatus;
        item.RejectReason = null;
        AddLog(item, "SUBMITTED", user);
        await _db.SaveChangesAsync();
        return Ok(BookingKendaraanOut.From(item));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery(Name = "status")] string? status = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery(Name = "nama_kendaraan")] string? namaKendaraan = null,
        [FromQuery] DateOnly? tanggal = null,
        [FromQuery] string? direktorat = null,
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null,
        [FromQuery] string? sejakBulan = null)
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

        IQueryable<BookingKendaraan> query;
        try
        {
            query = ApplyListFilters(_db, _db.BookingKendaraans.AsQueryable(), user!, statusFilter, divisi, departemen, namaKendaraan, tanggal, direktorat, bulan, search, sejakBulan, onlyRejected);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(b => b.CreatedAt)
            .ThenByDescending(b => b.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        var outItems = items.Select(BookingKendaraanOut.From).ToList();
        var itemIds = items.Select(i => i.Id).ToList();
        if (itemIds.Count > 0)
        {
            var messageTimes = await _db.BookingKendaraanChatMessages
                .Where(m => itemIds.Contains(m.BookingKendaraanId) && m.SenderId != user!.Id)
                .Select(m => new { m.BookingKendaraanId, m.CreatedAt })
                .ToListAsync();
            var lastReadAt = await _db.BookingKendaraanChatReads
                .Where(r => r.UserId == user!.Id && itemIds.Contains(r.BookingKendaraanId))
                .ToDictionaryAsync(r => r.BookingKendaraanId, r => r.LastReadAt);
            var outById = outItems.ToDictionary(o => o.Id);
            foreach (var group in messageTimes.GroupBy(m => m.BookingKendaraanId))
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
                var reads = _db.BookingKendaraanChatReads.Where(r => r.UserId == user!.Id && unreadItemIds.Contains(r.BookingKendaraanId));
                var candidateMessages = await (
                    from m in _db.BookingKendaraanChatMessages
                    where unreadItemIds.Contains(m.BookingKendaraanId) && m.SenderId != user!.Id
                    join r in reads on m.BookingKendaraanId equals r.BookingKendaraanId into rj
                    from r in rj.DefaultIfEmpty()
                    where r == null || m.CreatedAt > r.LastReadAt
                    select new { m.BookingKendaraanId, m.Message }
                ).ToListAsync();
                var mentionedIds = candidateMessages
                    .Where(m => m.Message.Contains(mentionTag, StringComparison.OrdinalIgnoreCase))
                    .Select(m => m.BookingKendaraanId)
                    .ToHashSet();
                foreach (var outItem in outItems)
                    if (mentionedIds.Contains(outItem.Id)) outItem.HasUnreadMention = true;
            }
        }

        return Ok(new BookingKendaraanListResponse
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

        IQueryable<BookingKendaraan> query;
        try
        {
            query = ApplyListFilters(_db, _db.BookingKendaraans.AsQueryable(), user!, null, null, null, null, null, null, bulan);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var counts = await query
            .GroupBy(b => b.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        return Ok(new BookingKendaraanStatsResponse
        {
            CountsByStatus = counts.ToDictionary(c => c.Status.ToString(), c => c.Count),
        });
    }

    private async Task<(User? user, BookingKendaraan? item, IActionResult? error)> RequireL1ActorAsync(int itemId)
    {
        var user = await CurrentUser.GetCurrentUserAsync();
        if (user == null) return (null, null, StatusCode(401, new { detail = "Belum login" }));
        if (user.Role != RoleEnum.APPROVAL_DEPARTEMEN && user.Role != RoleEnum.APPROVAL_DIVISI)
            return (null, null, StatusCode(403, new { detail = "Tidak memiliki akses" }));

        var item = await _db.BookingKendaraans.FirstOrDefaultAsync(b => b.Id == itemId);
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
        return Ok(BookingKendaraanOut.From(item));
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
        return Ok(BookingKendaraanOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-ga")]
    public async Task<IActionResult> ApproveGa(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingKendaraans.FirstOrDefaultAsync(b => b.Id == itemId);
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
        return Ok(BookingKendaraanOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga")]
    public async Task<IActionResult> RejectGa(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.ADMIN_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingKendaraans.FirstOrDefaultAsync(b => b.Id == itemId);
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
        return Ok(BookingKendaraanOut.From(item));
    }

    [HttpPatch("{itemId:int}/approve-ga-approval")]
    public async Task<IActionResult> ApproveGaApproval(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingKendaraans.FirstOrDefaultAsync(b => b.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        var conflict = await FindConflictAsync(item.NamaKendaraan, item.Tanggal, item.IsWholeDay, item.JamMulai, item.JamSelesai, item.Id);
        if (conflict != null) return BadRequest(new { detail = ConflictMessage(conflict) });

        item.Status = BookingStatusEnum.APPROVED_GA_APPROVAL;
        item.ApprovedByApprovalGa = user!.Id;
        item.ApprovedApprovalGaAt = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_GA_APPROVAL", user);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        return Ok(BookingKendaraanOut.From(item));
    }

    [HttpPatch("{itemId:int}/reject-ga-approval")]
    public async Task<IActionResult> RejectGaApproval(int itemId, [FromBody] RejectRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingKendaraans.FirstOrDefaultAsync(b => b.Id == itemId);
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
        return Ok(BookingKendaraanOut.From(item));
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

        var item = await _db.BookingKendaraans.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessBookingKendaraan(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var logs = await _db.BookingKendaraanLogs
            .Include(l => l.Aktor)
            .Where(l => l.BookingKendaraanId == itemId)
            .OrderBy(l => l.CreatedAt)
            .Select(l => new BookingKendaraanLogOut(l.Id, l.Action, l.Aktor != null ? l.Aktor.Nama : null, l.Aktor != null ? l.Aktor.Role : null, l.Reason, l.CreatedAt))
            .ToListAsync();

        return Ok(logs);
    }
}
