using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

[Route("api/pengiriman")]
public class PengirimanController : ApiControllerBase
{
    private static readonly HashSet<int> AllowedLimits = new() { 5, 10, 20, 50 };

    // The 4 roles that can input data barang: Admin/Approval Departemen and Admin/Approval Divisi.
    private static readonly RoleEnum[] OriginRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
    };

    private static readonly RoleEnum[] TotalVisibleRoles =
    {
        RoleEnum.ADMIN_DEPARTEMEN, RoleEnum.APPROVAL_DEPARTEMEN,
        RoleEnum.ADMIN_DIVISI, RoleEnum.APPROVAL_DIVISI,
        RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA, RoleEnum.KPU,
    };

    private readonly AppDbContext _db;

    public PengirimanController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    // "Origin" for revision/reject-back purposes is always whoever actually created the item -
    // Admin or Approval Departemen/Divisi, whichever it was. Both can input data barang, and
    // whichever of the two did it is the one who has to fix and resend it after any reject.
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
        RoleEnum.ADMIN_GA => "Admin GA",
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

    public static IQueryable<Pengiriman> ApplyListFilters(
        AppDbContext db,
        IQueryable<Pengiriman> query,
        User currentUser,
        StatusEnum? statusFilter,
        string? divisi,
        string? departemen,
        string? direktorat,
        string? nomorTransmittal,
        string? bulan)
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
        else
        {
            query = query.Where(p => p.Status != StatusEnum.DRAFT);
        }

        if (statusFilter.HasValue) query = query.Where(p => p.Status == statusFilter.Value);
        if (!string.IsNullOrEmpty(divisi)) query = query.Where(p => p.Divisi == divisi);
        if (!string.IsNullOrEmpty(departemen)) query = query.Where(p => p.Departemen == departemen);
        if (!string.IsNullOrEmpty(direktorat))
        {
            query = query.Where(p => db.Users.Any(u => u.Id == p.CreatedBy && u.Direktorat == direktorat));
        }
        if (!string.IsNullOrEmpty(nomorTransmittal)) query = query.Where(p => p.NomorTransmittal.Contains(nomorTransmittal));

        return ApplyBulanFilter(query, bulan);
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

    private async Task<int> IncrementTransmittalSequenceAsync(string divisi, int year, int month)
    {
        var counter = await _db.DivisiCounters.FindAsync(divisi, year, month);
        if (counter == null)
        {
            counter = new DivisiCounter { Divisi = divisi, Year = year, Month = month, LastSequence = 0 };
            _db.DivisiCounters.Add(counter);
        }
        counter.LastSequence += 1;
        return counter.LastSequence;
    }

    private string BuildNomorTransmittal(User user, int seq, DateOnly tanggal)
    {
        var kode = OrgTree.GetKodeSatuanKerja(user.Divisi!);
        return $"{seq:D4}.{kode}.{tanggal:MM}.{tanggal:yyyy}";
    }

    [HttpGet("next-transmittal")]
    public async Task<IActionResult> NextTransmittal([FromQuery] DateOnly? tanggal)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;
        if (string.IsNullOrEmpty(user!.Divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var effectiveTanggal = tanggal ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var seq = await PeekNextTransmittalSequenceAsync(user.Divisi, effectiveTanggal.Year, effectiveTanggal.Month);
        var nomor = BuildNomorTransmittal(user, seq, effectiveTanggal);
        return Ok(new { nomorTransmittal = nomor });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PengirimanCreate payload)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;

        if (string.IsNullOrEmpty(user!.Divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var item = new Pengiriman { CreatedBy = user.Id, CreatedByRole = user.Role, Status = StatusEnum.DRAFT, Divisi = user.Divisi, Departemen = user.Departemen };
        ApplyCreatePayload(item, payload);
        var seq = await IncrementTransmittalSequenceAsync(user.Divisi, item.Tanggal.Year, item.Tanggal.Month);
        item.NomorTransmittal = BuildNomorTransmittal(user, seq, item.Tanggal);
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

        // A rejected-to-origin item goes back to DRAFT after being revised - Admin Departemen/
        // Divisi still has to open it and submit again explicitly (mirrors the original create
        // flow). RejectReason is kept so the note stays visible while the revision is pending.
        var wasRejected = item.Status is StatusEnum.REJECTED_L1 or StatusEnum.REJECTED_GA
            or StatusEnum.REJECTED_GA_APPROVAL or StatusEnum.REJECTED_KPU;
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

        // Admin Departemen/Divisi submit -> needs Approval Departemen/Divisi (L1) sign-off.
        // Approval Departemen/Divisi submit -> mereka sendiri approver-nya, jadi langsung
        // masuk antrian Admin GA tanpa lewat L1.
        var skipL1 = user!.Role is RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.APPROVAL_DIVISI;
        item.Status = skipL1 ? StatusEnum.APPROVED_L1 : StatusEnum.SUBMITTED;
        item.RejectReason = null;
        item.RejectTarget = null;
        AddLog(item, "SUBMITTED", user);
        await _db.SaveChangesAsync();
        return Ok(PengirimanOut.From(item));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery] string? bulan = null,
        [FromQuery(Name = "status")] StatusEnum? statusFilter = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery] string? direktorat = null,
        [FromQuery(Name = "nomor_transmittal")] string? nomorTransmittal = null)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50" });

        IQueryable<Pengiriman> query;
        try
        {
            query = ApplyListFilters(_db, _db.Pengiriman.AsQueryable(), user!, statusFilter, divisi, departemen, direktorat, nomorTransmittal, bulan);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(p => p.Tanggal)
            .ThenByDescending(p => p.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        decimal? totalBulanIni = null;
        if (TotalVisibleRoles.Contains(user!.Role))
        {
            var sumQuery = _db.Pengiriman.AsQueryable();
            if (user.Role is RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN)
                sumQuery = sumQuery.Where(p => p.Departemen == user.Departemen);
            else if (user.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
                sumQuery = sumQuery.Where(p => p.Divisi == user.Divisi && p.Departemen == null);
            sumQuery = ApplyBulanFilter(sumQuery, bulan);
            totalBulanIni = await sumQuery.SumAsync(p => p.Total ?? 0);
        }

        var outItems = items.Select(PengirimanOut.From).ToList();
        var itemIds = items.Select(i => i.Id).ToList();
        if (itemIds.Count > 0)
        {
            var lastMessageAt = await _db.ChatMessages
                .Where(m => itemIds.Contains(m.PengirimanId))
                .GroupBy(m => m.PengirimanId)
                .Select(g => new { PengirimanId = g.Key, LastMessageAt = g.Max(m => m.CreatedAt) })
                .ToDictionaryAsync(g => g.PengirimanId, g => g.LastMessageAt);
            var lastReadAt = await _db.ChatReads
                .Where(r => r.UserId == user.Id && itemIds.Contains(r.PengirimanId))
                .ToDictionaryAsync(r => r.PengirimanId, r => r.LastReadAt);
            foreach (var outItem in outItems)
            {
                if (!lastMessageAt.TryGetValue(outItem.Id, out var lastMsg)) continue;
                var hasRead = lastReadAt.TryGetValue(outItem.Id, out var readAt);
                outItem.HasUnreadChat = !hasRead || lastMsg > readAt;
            }

            var mentionLabel = MentionLabelForRole(user.Role);
            var unreadItemIds = outItems.Where(i => i.HasUnreadChat).Select(i => i.Id).ToList();
            if (mentionLabel != null && unreadItemIds.Count > 0)
            {
                var mentionTag = "@" + mentionLabel;
                var candidateMessages = await _db.ChatMessages
                    .Where(m => unreadItemIds.Contains(m.PengirimanId))
                    .Select(m => new { m.PengirimanId, m.Message, m.CreatedAt })
                    .ToListAsync();
                var mentionedIds = candidateMessages
                    .Where(m =>
                        (!lastReadAt.TryGetValue(m.PengirimanId, out var readAt) || m.CreatedAt > readAt)
                        && m.Message.Contains(mentionTag, StringComparison.OrdinalIgnoreCase))
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
        await _db.SaveChangesAsync();
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
        await _db.SaveChangesAsync();
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
        await _db.SaveChangesAsync();
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
        await _db.SaveChangesAsync();
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
        await _db.SaveChangesAsync();
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
        item.RejectTarget = payload.Target;
        item.ApprovedByApprovalGa = null;
        item.ApprovedApprovalGaAt = null;
        AddLog(item, "REJECTED_GA_APPROVAL", user!, payload.Reason);
        await _db.SaveChangesAsync();
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

        item.NoResi = payload.NoResi;
        item.BeratBarangKg = payload.BeratBarangKg;
        item.AsuransiHarga = payload.AsuransiHarga;
        item.SubTotal = payload.SubTotal;
        item.Total = payload.Total;
        item.Status = StatusEnum.COMPLETED;
        item.ApprovedByKpu = user!.Id;
        item.ApprovedKpuAt = DateTime.UtcNow;
        item.RejectReason = null;
        item.RejectTarget = null;
        AddLog(item, "APPROVED_KPU", user);
        await _db.SaveChangesAsync();
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
        item.RejectTarget = payload.Target;
        AddLog(item, "REJECTED_KPU", user!, payload.Reason);
        await _db.SaveChangesAsync();
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

        if (user!.Role is RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN or RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            var sameUnit = item.Departemen != null
                ? user.Departemen == item.Departemen
                : user.Divisi == item.Divisi && user.Departemen == null;
            var visible = item.Status == StatusEnum.DRAFT
                ? item.CreatedBy == user.Id || (item.RejectReason != null && sameUnit)
                : sameUnit;
            if (!visible) return StatusCode(403, new { detail = "Bukan data milik Anda" });
        }

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
