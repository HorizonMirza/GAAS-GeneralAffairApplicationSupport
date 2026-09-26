using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Super Admin's meeting room roster editor - the UI for the meeting_room table MeetingRooms.cs's
// in-memory cache is loaded from (see MeetingRooms.LoadFromDb). Every write here calls that at the
// end, inside the same request, so BookingRuangController's own read of MeetingRooms.Rooms already
// reflects the change on its very next call, including this same process's very next request.
[Route("api/meeting-room-admin")]
public class MeetingRoomAdminController : ApiControllerBase
{
    // A booking in one of these is a dead end (see BookingStatusEnum) - it will never be acted on
    // again for that room, so it doesn't count as "still using" the room for the in-use check
    // below. Everything else (including DRAFT/SUBMITTED and an already-fully-approved booking,
    // past or future) does count - see class comment on IsRoomInUseAsync.
    private static readonly BookingStatusEnum[] DeadEndStatuses =
    {
        BookingStatusEnum.REJECTED_L1, BookingStatusEnum.REJECTED_GA, BookingStatusEnum.REJECTED_GA_APPROVAL, BookingStatusEnum.CANCELLED,
    };

    private readonly AppDbContext _db;

    public MeetingRoomAdminController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var rooms = await _db.MeetingRooms.OrderBy(r => r.Id).ToListAsync();
        return Ok(new MeetingRoomListResponse(rooms.Select(MeetingRoomOut.From).ToList()));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMeetingRoomRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var nama = payload.Nama?.Trim() ?? "";
        var lantai = payload.Lantai?.Trim() ?? "";
        if (nama.Length == 0) return StatusCode(400, new { detail = "Nama ruang wajib diisi" });
        if (lantai.Length == 0) return StatusCode(400, new { detail = "Lantai wajib diisi" });
        if (payload.Kapasitas <= 0) return StatusCode(400, new { detail = "Kapasitas harus lebih dari 0" });
        if (await _db.MeetingRooms.AnyAsync(r => r.Nama == nama))
            return StatusCode(400, new { detail = "Nama ruang sudah dipakai" });

        var row = new MeetingRoom
        {
            Nama = nama,
            Kapasitas = payload.Kapasitas,
            Lantai = lantai,
            FasilitasCsv = string.Join(",", (payload.Fasilitas ?? new()).Select(f => f.Trim()).Where(f => f.Length > 0)),
        };
        _db.MeetingRooms.Add(row);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Closes the race the AnyAsync check above can't: two requests can both pass it before
            // either commits, so the table's own UNIQUE index is what actually catches the second
            // one - as this exception, not a clean result.
            return StatusCode(400, new { detail = "Nama ruang sudah dipakai" });
        }
        MeetingRooms.LoadFromDb(_db);

        return StatusCode(201, MeetingRoomOut.From(row));
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMeetingRoomRequest payload)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var row = await _db.MeetingRooms.FirstOrDefaultAsync(r => r.Id == id);
        if (row == null) return NotFound(new { detail = "Ruang tidak ditemukan" });

        var nama = payload.Nama?.Trim() ?? "";
        var lantai = payload.Lantai?.Trim() ?? "";
        if (nama.Length == 0) return StatusCode(400, new { detail = "Nama ruang wajib diisi" });
        if (lantai.Length == 0) return StatusCode(400, new { detail = "Lantai wajib diisi" });
        if (payload.Kapasitas <= 0) return StatusCode(400, new { detail = "Kapasitas harus lebih dari 0" });
        if (await _db.MeetingRooms.AnyAsync(r => r.Id != id && r.Nama == nama))
            return StatusCode(400, new { detail = "Nama ruang sudah dipakai" });

        // Same "does not touch history" rule as OrgAdminController's rename endpoints - an existing
        // BookingRuang/BookingRuangRoom row keeps whatever NamaRuang/KapasitasRuang string/number it
        // already has stored; only new bookings and this dropdown pick up the renamed value.
        row.Nama = nama;
        row.Kapasitas = payload.Kapasitas;
        row.Lantai = lantai;
        row.FasilitasCsv = string.Join(",", (payload.Fasilitas ?? new()).Select(f => f.Trim()).Where(f => f.Length > 0));
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            return StatusCode(400, new { detail = "Nama ruang sudah dipakai" });
        }
        MeetingRooms.LoadFromDb(_db);

        return Ok(MeetingRoomOut.From(row));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var row = await _db.MeetingRooms.FirstOrDefaultAsync(r => r.Id == id);
        if (row == null) return NotFound(new { detail = "Ruang tidak ditemukan" });

        if (await IsRoomInUse(_db, row.Nama))
            return StatusCode(409, new { detail = "Ruang masih digunakan oleh booking yang belum selesai dan tidak dapat dihapus." });

        _db.MeetingRooms.Remove(row);
        await _db.SaveChangesAsync();
        MeetingRooms.LoadFromDb(_db);

        return NoContent();
    }

    // Checked before a delete - any BookingRuang (primary room) or BookingRuangRoom (additional
    // room on a multi-room booking) referencing this room's name, in a status that isn't one of
    // the dead ends above. A booking already REJECTED_L1/REJECTED_GA/REJECTED_GA_APPROVAL/
    // CANCELLED for this room is pure history and never needs the room to exist again (same
    // "rename/delete doesn't rewrite history" principle as everywhere else in this feature) - it
    // keeps its own NamaRuang/KapasitasRuang string/int snapshot regardless of whether this row
    // still exists. Public static (db passed explicitly, like ChatHub's own Can...Chat helpers) so
    // backend.Tests can exercise it directly against an in-memory AppDbContext without also
    // standing up a real CurrentUserService/HttpContext.
    public static async Task<bool> IsRoomInUse(AppDbContext db, string nama) =>
        await db.BookingRuangs.AnyAsync(b => b.NamaRuang == nama && !DeadEndStatuses.Contains(b.Status)) ||
        await db.BookingRuangRooms.AnyAsync(r => r.NamaRuang == nama && !DeadEndStatuses.Contains(r.BookingRuang.Status));
}
