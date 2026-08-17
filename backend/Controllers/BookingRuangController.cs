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

    // Bookings in any of these statuses hold their room+time slot; DRAFT (not yet submitted,
    // private to its creator) and REJECTED_* (no longer a live request) don't block anything.
    private static readonly BookingStatusEnum[] ActiveStatuses =
    {
        BookingStatusEnum.SUBMITTED, BookingStatusEnum.APPROVED_L1,
        BookingStatusEnum.APPROVED_GA, BookingStatusEnum.APPROVED_GA_APPROVAL,
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

    public static IQueryable<BookingRuang> ApplyListFilters(
        IQueryable<BookingRuang> query,
        User currentUser,
        BookingStatusEnum? statusFilter,
        string? divisi,
        string? departemen,
        string? namaRuang,
        DateOnly? tanggal)
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

        return query;
    }

    private static string? ValidatePayload(BookingRuangCreate payload)
    {
        if (!MeetingRooms.IsValidRoom(payload.NamaRuang))
            return "Ruang tidak ditemukan";
        if (!payload.IsWholeDay)
        {
            if (payload.JamMulai == null || payload.JamSelesai == null)
                return "Jam mulai dan jam selesai wajib diisi kalau bukan sehari penuh";
            if (payload.JamMulai >= payload.JamSelesai)
                return "Jam mulai harus lebih awal dari jam selesai";
        }
        return null;
    }

    private static void ApplyCreatePayload(BookingRuang item, BookingRuangCreate payload)
    {
        item.NamaKegiatan = payload.NamaKegiatan;
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
        var query = _db.BookingRuangs.Where(b =>
            b.NamaRuang == namaRuang && b.Tanggal == tanggal && ActiveStatuses.Contains(b.Status));
        if (excludeId.HasValue) query = query.Where(b => b.Id != excludeId.Value);

        var candidates = await query.ToListAsync();
        return candidates.FirstOrDefault(existing =>
            isWholeDay || existing.IsWholeDay || (existing.JamMulai < jamSelesai && existing.JamSelesai > jamMulai));
    }

    private static string ConflictMessage(BookingRuang conflict) =>
        conflict.IsWholeDay
            ? $"{conflict.NamaRuang} sudah dipesan sehari penuh pada tanggal tersebut"
            : $"{conflict.NamaRuang} sudah dipesan jam {conflict.JamMulai:HH:mm}-{conflict.JamSelesai:HH:mm} pada tanggal tersebut";

    [HttpGet("rooms")]
    public async Task<IActionResult> ListRooms()
    {
        var (_, error) = await RequireRoleAsync();
        if (error != null) return error;
        return Ok(MeetingRooms.Rooms);
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
        [FromQuery] DateOnly? tanggal = null)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50" });

        var query = ApplyListFilters(_db.BookingRuangs.AsQueryable(), user!, statusFilter, divisi, departemen, namaRuang, tanggal);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(b => b.Tanggal)
            .ThenByDescending(b => b.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        return Ok(new BookingRuangListResponse
        {
            Items = items.Select(BookingRuangOut.From).ToList(),
            Total = total,
            Page = page,
            Limit = limit,
        });
    }

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

    [HttpPatch("{itemId:int}/approve-ga-approval")]
    public async Task<IActionResult> ApproveGaApproval(int itemId)
    {
        var (user, roleError) = await RequireRoleAsync(RoleEnum.APPROVAL_GA);
        if (roleError != null) return roleError;

        var item = await _db.BookingRuangs.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsGaApprovalActionable(item))
            return StatusCode(403, new { detail = "Data tidak dapat diapprove pada status ini" });

        item.Status = BookingStatusEnum.APPROVED_GA_APPROVAL;
        item.ApprovedByApprovalGa = user!.Id;
        item.ApprovedApprovalGaAt = DateTime.UtcNow;
        item.RejectReason = null;
        AddLog(item, "APPROVED_GA_APPROVAL", user);
        await _db.SaveChangesAsync();
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
