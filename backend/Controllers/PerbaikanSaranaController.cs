using System.Net.Mime;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Hubs;
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

    // Only real image formats - this is specifically a photo of the repair plan/site, not a
    // general-purpose document upload like Archive's.
    private static readonly Dictionary<string, string> AllowedGambarExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".png"] = "image/png",
    };
    private const long MaxGambarFileSizeBytes = 10 * 1024 * 1024; // 10 MB
    private const int MinFotoKerusakan = 1;
    private const int MaxFotoKerusakan = 5;

    private static readonly RoleEnum[] ExecutionRoles = { RoleEnum.ADMIN_GA, RoleEnum.APPROVAL_GA };

    private readonly AppDbContext _db;
    private readonly IHubContext<ChatHub> _hub;
    private readonly string _uploadDir;

    public PerbaikanSaranaController(AppDbContext db, CurrentUserService currentUser, IHubContext<ChatHub> hub, IConfiguration config) : base(currentUser)
    {
        _db = db;
        _hub = hub;
        var configured = config.GetValue<string>("SaranaUploadDir") ?? "uploads/sarana";
        _uploadDir = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(AppContext.BaseDirectory, "..", "..", "..", configured);
        _uploadDir = Path.GetFullPath(_uploadDir);
        Directory.CreateDirectory(_uploadDir);
    }

    // Label shown in the "transaksi baru"/"proses approval" notification banner - same
    // Lokasi+Nomor convention as BookingRuangController's ItemLabel.
    private static string ItemLabel(PerbaikanSarana item) => $"{item.Lokasi} - {item.NomorPerbaikan ?? "#" + item.Id}";

    // Every recipient of a workflow notification for this report: everyone CanAccessPerbaikanSarana
    // already lets see it, minus the actor who just triggered the event.
    private async Task<List<int>> ActivityRecipientIdsAsync(PerbaikanSarana item, int actorId)
    {
        var users = await _db.Users.Where(u => u.Id != actorId).ToListAsync();
        return users.Where(u => CanAccessPerbaikanSarana(u, item)).Select(u => u.Id).ToList();
    }

    private static string EffectiveDivisi(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDivisiLabel : user.Divisi!;

    private static string? EffectiveDepartemen(User user) =>
        user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA ? GaDepartemenLabel : user.Departemen;

    private static bool IsGaActor(User user) => user.Role is RoleEnum.ADMIN_GA or RoleEnum.APPROVAL_GA;

    // Same on-behalf allowance as PengirimanController - Admin/Approval GA can request a repair
    // for any divisi/departemen (payload.Divisi/Departemen), not just their own GA home unit.
    // Every other role always requests as itself; GA requesting with no Divisi chosen falls back
    // to their own GA home unit, same as before this feature existed.
    private static (string divisi, string? departemen) EffectiveOwner(User user, PerbaikanSaranaCreate payload) =>
        IsGaActor(user) && !string.IsNullOrEmpty(payload.Divisi)
            ? (payload.Divisi, payload.Departemen)
            : (EffectiveDivisi(user), EffectiveDepartemen(user));

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

    // Eksekusi fisik hanya berjalan setelah laporan disetujui final - Status sendiri tetap
    // APPROVED_GA_APPROVAL sepanjang ExecutionStage berjalan (lihat PerbaikanSarana.cs).
    private static bool IsApprovedFinal(PerbaikanSarana item) => item.Status == BookingStatusEnum.APPROVED_GA_APPROVAL;

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

    // Accepts either "YYYY-MM" (a specific month, used by the List/Report pages) or a bare
    // "YYYY" (the whole year, used by GetStats so the dashboard tiles reset every year instead
    // of carrying every request ever made) - both share this one filter since they're really the
    // same "which Tanggal range" concept at two different granularities.
    private static IQueryable<PerbaikanSarana> ApplyBulanFilter(IQueryable<PerbaikanSarana> query, string? bulan)
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

    public static IQueryable<PerbaikanSarana> ApplyListFilters(
        AppDbContext db,
        IQueryable<PerbaikanSarana> query,
        User currentUser,
        BookingStatusEnum? statusFilter,
        string? divisi,
        string? departemen,
        KategoriKerusakanEnum? kategori = null,
        string? direktorat = null,
        string? bulan = null,
        string? search = null,
        bool onlyRejected = false,
        DateOnly? tanggal = null)
    {
        if (currentUser.Role is RoleEnum.ADMIN_DEPARTEMEN or RoleEnum.APPROVAL_DEPARTEMEN)
        {
            query = query.Where(p => p.Departemen == currentUser.Departemen
                && (p.Status != BookingStatusEnum.DRAFT || p.CreatedBy == currentUser.Id));
        }
        else if (currentUser.Role is RoleEnum.ADMIN_DIVISI or RoleEnum.APPROVAL_DIVISI)
        {
            query = query.Where(p => p.Divisi == currentUser.Divisi && p.Departemen == null
                && (p.Status != BookingStatusEnum.DRAFT || p.CreatedBy == currentUser.Id));
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
        // Menjangkau nomor, lokasi, nama pelapor, dan deskripsi kerusakan - saat melaporkan
        // kerusakan, orang lebih sering ingat tempatnya ("Ruang Bromo") atau siapa yang melapor
        // daripada nomor dokumennya.
        if (!string.IsNullOrEmpty(search))
            query = query.Where(p =>
                (p.NomorPerbaikan != null && EF.Functions.ILike(p.NomorPerbaikan, $"%{search}%")) ||
                EF.Functions.ILike(p.Lokasi, $"%{search}%") ||
                EF.Functions.ILike(p.NamaPelapor, $"%{search}%") ||
                EF.Functions.ILike(p.DeskripsiKerusakan, $"%{search}%"));
        if (tanggal.HasValue) query = query.Where(p => p.Tanggal == tanggal.Value);

        return ApplyBulanFilter(query, bulan);
    }

    private static string? ValidatePayload(PerbaikanSaranaCreate payload, bool isGaActor)
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
        if (string.IsNullOrWhiteSpace(payload.Lokasi))
            return "Lokasi wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.DeskripsiKerusakan))
            return "Deskripsi kerusakan wajib diisi";
        if (payload.DeskripsiKerusakan.Length > MaxDeskripsiLength)
            return $"Deskripsi kerusakan maksimal {MaxDeskripsiLength} karakter";
        if (!Enum.IsDefined(typeof(KategoriKerusakanEnum), payload.Kategori))
            return "Kategori kerusakan tidak valid";
        if (string.IsNullOrWhiteSpace(payload.NamaPelapor))
            return "Nama pelapor wajib diisi";
        if (string.IsNullOrWhiteSpace(payload.NoTeleponPelapor))
            return "No. Telepon pelapor wajib diisi";
        return null;
    }

    private static void ApplyCreatePayload(PerbaikanSarana item, PerbaikanSaranaCreate payload)
    {
        item.Tanggal = payload.Tanggal;
        item.Lokasi = payload.Lokasi.Trim();
        item.Kategori = payload.Kategori;
        item.DeskripsiKerusakan = payload.DeskripsiKerusakan.Trim();
        item.Catatan = payload.Catatan;
        item.NamaPelapor = payload.NamaPelapor.Trim();
        item.NoTeleponPelapor = payload.NoTeleponPelapor.Trim();
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
    public async Task<IActionResult> NextNomor([FromQuery] DateOnly? tanggal, [FromQuery] string? divisi)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;
        var effectiveDivisi = IsGaActor(user!) && !string.IsNullOrEmpty(divisi) && OrgTree.AllDivisi.Contains(divisi)
            ? divisi
            : EffectiveDivisi(user!);
        if (string.IsNullOrEmpty(effectiveDivisi))
            return Ok(new { nomorPerbaikan = "" });

        var effectiveTanggal = tanggal ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var seq = await PeekNextNomorSequenceAsync(effectiveDivisi, effectiveTanggal.Year, effectiveTanggal.Month);
        return Ok(new { nomorPerbaikan = BuildNomorPerbaikan(effectiveDivisi, seq, effectiveTanggal) });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PerbaikanSaranaCreate payload)
    {
        var (user, error) = await RequireRoleAsync(OriginRoles);
        if (error != null) return error;

        var validationError = ValidatePayload(payload, IsGaActor(user!));
        if (validationError != null) return BadRequest(new { detail = validationError });

        var (divisi, departemen) = EffectiveOwner(user!, payload);
        if (string.IsNullOrEmpty(divisi))
            return StatusCode(403, new { detail = "Akun Anda belum terhubung dengan divisi/departemen manapun" });

        var item = new PerbaikanSarana
        {
            CreatedBy = user!.Id,
            CreatedByRole = user.Role,
            Status = BookingStatusEnum.DRAFT,
            Divisi = divisi,
            Departemen = departemen,
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

        var validationError = ValidatePayload(payload, IsGaActor(user!));
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

        var fotoCount = await _db.PerbaikanSaranaFotoKerusakans.CountAsync(f => f.PerbaikanSaranaId == item.Id);
        if (fotoCount < MinFotoKerusakan)
            return BadRequest(new { detail = "Foto kerusakan wajib diunggah sebelum mengirim laporan" });

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
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user.Id), "created", "sarana", item.Id, ItemLabel(item), user.Nama, "Melaporkan Kerusakan/Permintaan Perbaikan Baru");
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery(Name = "status")] string? status = null,
        [FromQuery] string? kategori = null,
        [FromQuery] string? divisi = null,
        [FromQuery] string? departemen = null,
        [FromQuery] string? direktorat = null,
        [FromQuery] string? bulan = null,
        [FromQuery] string? search = null,
        [FromQuery] DateOnly? tanggal = null)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = "Limit harus salah satu dari 5,10,20,50,1000" });
        if (page < 1)
            return BadRequest(new { detail = "Halaman harus dimulai dari 1" });

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

        IQueryable<PerbaikanSarana> query;
        try
        {
            query = ApplyListFilters(_db, _db.PerbaikanSaranas.AsQueryable(), user!, statusFilter, divisi, departemen, kategoriFilter, direktorat, bulan, search, onlyRejected, tanggal);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(p => p.CreatedAt)
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

    // Single-item fetch, independent of List's pagination/filters - lets a notification banner's
    // click deep-link straight into an item's chat (or its detail) even when that item isn't on
    // whatever page/filter the Transaksi table happens to be showing right now.
    [HttpGet("{itemId:int}")]
    public async Task<IActionResult> GetOne(int itemId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPerbaikanSarana(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] string? bulan = null)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        IQueryable<PerbaikanSarana> query;
        try
        {
            query = ApplyListFilters(_db, _db.PerbaikanSaranas.AsQueryable(), user!, null, null, null, null, null, bulan);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var counts = await query
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        // Breakdown eksekusi fisik (Cek Lokasi -> Buat Gambar -> Selesai) hanya berarti untuk
        // laporan yang sudah disetujui final - laporan lain semuanya masih di ExecutionStage
        // default MENUNGGU meski belum pernah masuk tahap eksekusi sama sekali, jadi harus difilter
        // by Status dulu supaya tidak salah dihitung sebagai "menunggu eksekusi".
        var executionCounts = await query
            .Where(p => p.Status == BookingStatusEnum.APPROVED_GA_APPROVAL)
            .GroupBy(p => p.ExecutionStage)
            .Select(g => new { Stage = g.Key, Count = g.Count() })
            .ToListAsync();

        return Ok(new PerbaikanSaranaStatsResponse
        {
            CountsByStatus = counts.ToDictionary(c => c.Status.ToString(), c => c.Count),
            ExecutionStageCounts = executionCounts.ToDictionary(c => c.Stage.ToString(), c => c.Count),
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
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "sarana", item.Id, ItemLabel(item), user.Nama, "Disetujui (Approval Departemen/Divisi)");
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
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "rejected", "sarana", item.Id, ItemLabel(item), user.Nama, "Ditolak (Approval Departemen/Divisi)");
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
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "sarana", item.Id, ItemLabel(item), user.Nama, "Disetujui (Admin GA)");
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
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "rejected", "sarana", item.Id, ItemLabel(item), user.Nama, "Ditolak (Admin GA)");
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
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approved", "sarana", item.Id, ItemLabel(item), user.Nama, "Disetujui (Approval GA)");
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
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "rejected", "sarana", item.Id, ItemLabel(item), user.Nama, "Ditolak (Approval GA)");
        return Ok(PerbaikanSaranaOut.From(item));
    }

    // --- Eksekusi fisik (Cek Lokasi -> Buat Gambar -> Eksekusi), hanya setelah disetujui final -
    // Admin GA dan Approval GA sama-sama bisa menjalankan tahap manapun, tidak dibatasi harus
    // orang yang sama sepanjang tahapan. Setiap tahap wajib berurutan (lihat masing-masing guard
    // di bawah) dan dicatat lewat AddLog supaya riwayatnya terlihat jelas di Transaksi/Overview.

    [HttpPatch("{itemId:int}/cek-lokasi")]
    public async Task<IActionResult> CekLokasi(int itemId, [FromBody] ExecutionStageRequest payload)
    {
        var (user, roleError) = await RequireRoleAsync(ExecutionRoles);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsApprovedFinal(item))
            return StatusCode(403, new { detail = "Data belum disetujui final" });
        if (item.ExecutionStage != ExecutionStageEnum.MENUNGGU)
            return StatusCode(403, new { detail = "Lokasi sudah pernah dicek" });

        item.ExecutionStage = ExecutionStageEnum.LOKASI_DICEK;
        item.LokasiDicekBy = user!.Id;
        item.LokasiDicekAt = DateTime.UtcNow;
        AddLog(item, "LOKASI_DICEK", user, payload.Catatan);
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user.Id), "approval", "sarana", item.Id, ItemLabel(item), user.Nama, "Menandai Lokasi Sudah Dicek");
        return Ok(PerbaikanSaranaOut.From(item));
    }

    // required=true (rencana perbaikan) rejects a missing file; required=false (foto kerusakan/
    // foto selesai, keduanya opsional) treats a missing file as "nothing to store" rather than an
    // error - contentType comes back null in that case as the signal to skip storing anything.
    private static (bool ok, string? contentType, string? error) ValidateImageFile(IFormFile? file, bool required)
    {
        if (file == null || file.Length == 0)
            return required ? (false, null, "Gambar wajib diunggah") : (true, null, null);
        if (file.Length > MaxGambarFileSizeBytes)
            return (false, null, $"Ukuran file maksimal {MaxGambarFileSizeBytes / 1024 / 1024} MB");
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext) || !AllowedGambarExtensions.TryGetValue(ext, out var contentType))
            return (false, null, "Format gambar tidak didukung. Gunakan JPG atau PNG.");
        return (true, contentType, null);
    }

    private async Task<string> StoreImageFileAsync(IFormFile file)
    {
        var storedFilename = $"{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
        var destPath = Path.Combine(_uploadDir, storedFilename);
        using var stream = System.IO.File.Create(destPath);
        await file.CopyToAsync(stream);
        return storedFilename;
    }

    [HttpPost("{itemId:int}/gambar")]
    public async Task<IActionResult> UploadGambar(int itemId, [FromForm] string? catatan, [FromForm] IFormFile? file)
    {
        var (user, roleError) = await RequireRoleAsync(ExecutionRoles);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsApprovedFinal(item))
            return StatusCode(403, new { detail = "Data belum disetujui final" });
        if (item.ExecutionStage != ExecutionStageEnum.LOKASI_DICEK)
            return StatusCode(403, new { detail = "Lokasi harus dicek terlebih dahulu" });

        var (fileOk, contentType, fileError) = ValidateImageFile(file, required: true);
        if (!fileOk) return BadRequest(new { detail = fileError });

        var storedFilename = await StoreImageFileAsync(file!);

        item.ExecutionStage = ExecutionStageEnum.GAMBAR_DIBUAT;
        item.GambarDibuatBy = user!.Id;
        item.GambarDibuatAt = DateTime.UtcNow;
        item.GambarFilePath = storedFilename;
        item.GambarOriginalFilename = string.IsNullOrEmpty(file.FileName) ? storedFilename : file.FileName;
        item.GambarContentType = contentType!;
        AddLog(item, "GAMBAR_DIBUAT", user, string.IsNullOrWhiteSpace(catatan) ? null : catatan.Trim());
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user.Id), "approval", "sarana", item.Id, ItemLabel(item), user.Nama, "Mengunggah Gambar Rencana Perbaikan");
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpGet("{itemId:int}/gambar")]
    public async Task<IActionResult> DownloadGambar(int itemId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PerbaikanSaranas.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPerbaikanSarana(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });
        if (item.GambarFilePath == null) return NotFound(new { detail = "Belum ada gambar untuk laporan ini" });

        var path = Path.Combine(_uploadDir, item.GambarFilePath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File gambar tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var cd = new ContentDisposition { Inline = true, FileName = item.GambarOriginalFilename ?? item.GambarFilePath };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(bytes, item.GambarContentType ?? "application/octet-stream");
    }

    // Foto kondisi kerusakan (before) - wajib minimal 1, maksimal 5, diunggah pelapor sendiri lewat
    // form Draft supaya approver bisa menilai tanpa cek lokasi fisik dulu. Bisa ditambah/dihapus
    // satu per satu selagi laporan masih Draft (lihat IsEditableByOrigin) - endpoint ini menambah
    // ke daftar yang sudah ada, bukan menggantikannya, jadi form pertama kali (semua file dalam
    // satu panggilan) dan penambahan susulan sama-sama lewat jalur yang sama.
    [HttpPost("{itemId:int}/foto-kerusakan")]
    public async Task<IActionResult> UploadFotoKerusakan(int itemId, [FromForm] List<IFormFile> files)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat diubah pada tahap ini" });

        if (files.Count == 0)
            return BadRequest(new { detail = "Minimal 1 foto kerusakan wajib diunggah" });

        var existingCount = await _db.PerbaikanSaranaFotoKerusakans.CountAsync(f => f.PerbaikanSaranaId == itemId);
        if (existingCount + files.Count > MaxFotoKerusakan)
            return BadRequest(new { detail = $"Maksimal {MaxFotoKerusakan} foto kerusakan per laporan" });

        foreach (var file in files)
        {
            var (fileOk, contentType, fileError) = ValidateImageFile(file, required: true);
            if (!fileOk) return BadRequest(new { detail = fileError });

            var storedFilename = await StoreImageFileAsync(file);
            _db.PerbaikanSaranaFotoKerusakans.Add(new PerbaikanSaranaFotoKerusakan
            {
                PerbaikanSaranaId = itemId,
                FilePath = storedFilename,
                OriginalFilename = string.IsNullOrEmpty(file.FileName) ? storedFilename : file.FileName,
                ContentType = contentType!,
                CreatedAt = DateTime.UtcNow,
            });
        }
        await _db.SaveChangesAsync();
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpGet("{itemId:int}/foto-kerusakan")]
    public async Task<IActionResult> ListFotoKerusakan(int itemId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PerbaikanSaranas.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPerbaikanSarana(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var photos = await _db.PerbaikanSaranaFotoKerusakans
            .Where(f => f.PerbaikanSaranaId == itemId)
            .OrderBy(f => f.Id)
            .Select(f => new PerbaikanSaranaFotoKerusakanOut(f.Id, f.OriginalFilename))
            .ToListAsync();
        return Ok(photos);
    }

    [HttpGet("{itemId:int}/foto-kerusakan/{fotoId:int}")]
    public async Task<IActionResult> DownloadFotoKerusakan(int itemId, int fotoId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PerbaikanSaranas.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPerbaikanSarana(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });

        var foto = await _db.PerbaikanSaranaFotoKerusakans.FirstOrDefaultAsync(f => f.Id == fotoId && f.PerbaikanSaranaId == itemId);
        if (foto == null) return NotFound(new { detail = "Foto tidak ditemukan" });

        var path = Path.Combine(_uploadDir, foto.FilePath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File foto tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var cd = new ContentDisposition { Inline = true, FileName = foto.OriginalFilename };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(bytes, foto.ContentType);
    }

    [HttpDelete("{itemId:int}/foto-kerusakan/{fotoId:int}")]
    public async Task<IActionResult> DeleteFotoKerusakan(int itemId, int fotoId)
    {
        var (user, roleError) = await RequireRoleAsync(OriginRoles);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsEditableByOrigin(item, user!))
            return StatusCode(403, new { detail = "Data tidak dapat diubah pada tahap ini" });

        var foto = await _db.PerbaikanSaranaFotoKerusakans.FirstOrDefaultAsync(f => f.Id == fotoId && f.PerbaikanSaranaId == itemId);
        if (foto == null) return NotFound(new { detail = "Foto tidak ditemukan" });

        var remaining = await _db.PerbaikanSaranaFotoKerusakans.CountAsync(f => f.PerbaikanSaranaId == itemId);
        if (remaining <= MinFotoKerusakan)
            return BadRequest(new { detail = $"Minimal {MinFotoKerusakan} foto kerusakan harus tetap ada" });

        _db.PerbaikanSaranaFotoKerusakans.Remove(foto);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{itemId:int}/eksekusi")]
    public async Task<IActionResult> Eksekusi(int itemId, [FromForm] string? catatan, [FromForm] IFormFile? file)
    {
        var (user, roleError) = await RequireRoleAsync(ExecutionRoles);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsApprovedFinal(item))
            return StatusCode(403, new { detail = "Data belum disetujui final" });
        if (item.ExecutionStage != ExecutionStageEnum.GAMBAR_DIBUAT)
            return StatusCode(403, new { detail = "Gambar rencana perbaikan harus dibuat terlebih dahulu" });

        // Foto hasil (after) opsional - kalau dilampirkan, tetap dijalankan lewat validasi gambar
        // yang sama supaya tidak ada celah format/ukuran file yang berbeda dari upload lain.
        var (fileOk, contentType, fileError) = ValidateImageFile(file, required: false);
        if (!fileOk) return BadRequest(new { detail = fileError });
        if (contentType != null)
        {
            item.FotoSelesaiFilePath = await StoreImageFileAsync(file!);
            item.FotoSelesaiOriginalFilename = string.IsNullOrEmpty(file!.FileName) ? item.FotoSelesaiFilePath : file.FileName;
            item.FotoSelesaiContentType = contentType;
        }

        item.ExecutionStage = ExecutionStageEnum.SELESAI;
        item.SelesaiBy = user!.Id;
        item.SelesaiAt = DateTime.UtcNow;
        AddLog(item, "SELESAI", user, string.IsNullOrWhiteSpace(catatan) ? null : catatan.Trim());
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user.Id), "approval", "sarana", item.Id, ItemLabel(item), user.Nama, "Menyelesaikan Eksekusi Perbaikan");
        return Ok(PerbaikanSaranaOut.From(item));
    }

    [HttpGet("{itemId:int}/foto-selesai")]
    public async Task<IActionResult> DownloadFotoSelesai(int itemId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PerbaikanSaranas.FindAsync(itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPerbaikanSarana(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });
        if (item.FotoSelesaiFilePath == null) return NotFound(new { detail = "Belum ada foto hasil perbaikan untuk laporan ini" });

        var path = Path.Combine(_uploadDir, item.FotoSelesaiFilePath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File foto tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var cd = new ContentDisposition { Inline = true, FileName = item.FotoSelesaiOriginalFilename ?? item.FotoSelesaiFilePath };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(bytes, item.FotoSelesaiContentType ?? "application/octet-stream");
    }

    // Proof-of-report certificate, only ever available once a report has actually won its final
    // Approval GA sign-off - mirrors BookingKendaraanController.DownloadBuktiPdf.
    [HttpGet("{itemId:int}/pdf")]
    public async Task<IActionResult> DownloadBuktiPdf(int itemId)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!CanAccessPerbaikanSarana(user!, item)) return StatusCode(403, new { detail = "Bukan data milik Anda" });
        if (item.Status != BookingStatusEnum.APPROVED_GA_APPROVAL)
            return StatusCode(403, new { detail = "Bukti laporan hanya tersedia untuk laporan yang sudah Approved" });

        var actorNames = await ResolveActorNamesAsync(item);
        var bytes = SaranaPdfService.Generate(item, actorNames);
        return File(bytes, "application/pdf", $"Bukti-Laporan-Perbaikan-{item.NomorPerbaikan}.pdf");
    }

    private async Task<Dictionary<int, string>> ResolveActorNamesAsync(PerbaikanSarana item)
    {
        var actorIds = new[] { item.ApprovedByApprovalGa, item.LokasiDicekBy, item.GambarDibuatBy, item.SelesaiBy }
            .Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        return actorIds.Count > 0
            ? await _db.Users.Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Nama)
            : new Dictionary<int, string>();
    }

    // Koreksi kalau salah unggah foto/salah tandai tahap - memundurkan ExecutionStage satu langkah
    // dan membersihkan field milik tahap yang dibatalkan itu (foto/gambar yang sudah di-upload
    // dibiarkan sebagai file yatim di disk, sama seperti konvensi re-upload di UploadGambar/
    // UploadFotoKerusakan yang juga tidak menghapus file lama). Status approval (APPROVED_GA_
    // APPROVAL) tidak ikut berubah - ini murni koreksi eksekusi fisik, bukan alur approval.
    [HttpPatch("{itemId:int}/eksekusi/reset")]
    public async Task<IActionResult> ResetEksekusi(int itemId, [FromBody] ExecutionStageRequest? payload)
    {
        var (user, roleError) = await RequireRoleAsync(ExecutionRoles);
        if (roleError != null) return roleError;

        var item = await _db.PerbaikanSaranas.FirstOrDefaultAsync(p => p.Id == itemId);
        if (item == null) return NotFound(new { detail = "Data tidak ditemukan" });
        if (!IsApprovedFinal(item))
            return StatusCode(403, new { detail = "Data belum disetujui final" });

        var fromStage = item.ExecutionStage;
        switch (fromStage)
        {
            case ExecutionStageEnum.LOKASI_DICEK:
                item.ExecutionStage = ExecutionStageEnum.MENUNGGU;
                item.LokasiDicekBy = null;
                item.LokasiDicekAt = null;
                break;
            case ExecutionStageEnum.GAMBAR_DIBUAT:
                item.ExecutionStage = ExecutionStageEnum.LOKASI_DICEK;
                item.GambarDibuatBy = null;
                item.GambarDibuatAt = null;
                item.GambarFilePath = null;
                item.GambarOriginalFilename = null;
                item.GambarContentType = null;
                break;
            case ExecutionStageEnum.SELESAI:
                item.ExecutionStage = ExecutionStageEnum.GAMBAR_DIBUAT;
                item.SelesaiBy = null;
                item.SelesaiAt = null;
                item.FotoSelesaiFilePath = null;
                item.FotoSelesaiOriginalFilename = null;
                item.FotoSelesaiContentType = null;
                break;
            default:
                return StatusCode(403, new { detail = "Belum ada tahap eksekusi untuk dibatalkan" });
        }

        var catatan = string.IsNullOrWhiteSpace(payload?.Catatan) ? null : payload!.Catatan!.Trim();
        AddLog(item, "EKSEKUSI_DIBATALKAN", user!, $"Dibatalkan dari tahap {fromStage}" + (catatan != null ? $": {catatan}" : ""));
        var saveError = await TrySaveChangesAsync(_db);
        if (saveError != null) return saveError;
        await BroadcastActivityNotificationAsync(_hub, await ActivityRecipientIdsAsync(item, user!.Id), "approval", "sarana", item.Id, ItemLabel(item), user.Nama, "Membatalkan Tahap Eksekusi Terakhir");
        return Ok(PerbaikanSaranaOut.From(item));
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
