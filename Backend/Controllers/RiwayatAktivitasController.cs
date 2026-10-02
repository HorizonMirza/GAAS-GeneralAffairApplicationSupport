using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Controllers;

// Cross-module activity log for Super Admin.
//
// Every module already writes who-did-what-when into its own *_logs table, but each one is only
// readable through that module's {itemId}/logs endpoint - you have to know which record you want
// before you can see anything. So questions an audit actually asks ("what did this person do last
// week", "who cancelled those bookings") had no answer inside the app even though the data was
// all there.
//
// The seven tables share the same shape (id, <parent>_id, action, actor_id, reason, created_at),
// so they are UNION ALL-ed into one stream here rather than fetched separately and merged in
// memory - that keeps ordering, paging and counting in the database, where a "last 50 across
// everything" query belongs.
[ApiController]
[Route("api/riwayat-aktivitas")]
public class RiwayatAktivitasController : ApiControllerBase
{
    private static readonly HashSet<int> AllowedLimits = new() { 10, 20, 50, 100 };

    // modul key -> (log table, foreign key column, parent table, parent's human-readable number).
    // Hard-coded rather than derived: these are seven fixed tables, and building SQL from
    // user-supplied names is exactly the thing to avoid.
    private static readonly Dictionary<string, (string Log, string Fk, string Parent, string Nomor)> Sources = new()
    {
        ["ekspedisi"] = ("pengiriman_logs", "pengiriman_id", "pengiriman", "nomor_transmittal"),
        ["booking-ruang"] = ("booking_ruang_logs", "booking_ruang_id", "booking_ruang", "nomor_pemesanan"),
        ["booking-kendaraan"] = ("booking_kendaraan_logs", "booking_kendaraan_id", "booking_kendaraan", "nomor_pemesanan"),
        ["permintaan-atk"] = ("permintaan_atk_logs", "permintaan_atk_id", "permintaan_atk", "nomor_permintaan"),
        ["perbaikan-sarana"] = ("perbaikan_sarana_logs", "perbaikan_sarana_id", "perbaikan_sarana", "nomor_perbaikan"),
        ["permintaan-arsip"] = ("permintaan_arsip_logs", "permintaan_arsip_id", "permintaan_arsip", "nomor_arsip"),
        ["invoice"] = ("invoice_logs", "invoice_id", "invoices", "bulan"),
    };

    // 8th source (Part 4): a Super Admin delete, straight from deletion_log - it doesn't fit the
    // Log/Fk/Parent/Nomor join shape above (there's no parent row left to join to, that's the
    // whole point of the table), so it's a fixed literal SQL fragment instead, no user-supplied
    // text anywhere in it. Its own Modul column snapshots which of the seven modules above the
    // deleted item actually belonged to (see DeletionLog.Modul) - this key ("deleted") is only the
    // Aksi-feed's own filterable label for "any delete", independent of that.
    private const string DeletedSourceKey = "deleted";
    private const string DeletedSql = """
      SELECT 'deleted' AS modul, dl.item_id AS item_id, dl.item_nomor::text AS nomor,
             'DELETED' AS action,
             (CASE
               WHEN dl.filter_summary IS NOT NULL AND dl.filter_summary <> ''
                 THEN COALESCE(dl.item_nomor, '') || CASE WHEN dl.item_nomor IS NOT NULL THEN ' - ' ELSE '' END || dl.filter_summary
               ELSE dl.item_nomor
             END)::text AS reason,
             dl.deleted_by AS actor_id, dl.deleted_by_nama::text AS actor_nama, u.role::text AS actor_role,
             u.divisi AS actor_divisi, u.departemen AS actor_departemen,
             dl.created_at
      FROM deletion_log dl
      LEFT JOIN users u ON u.id = dl.deleted_by
      """;

    // 9th source: every OTHER Super Admin write (user account changes, org structure edits,
    // Master Data CRUD, app settings/branding/hours/holiday changes) that isn't one of the seven
    // business modules or a delete - see AdminActivityLog's own class comment. Same "fixed literal
    // fragment, no parent row to join to" shape as DeletedSql above, for the same reason: there is
    // no single business row this action belongs to. Reason carries the human description since
    // Nomor has nothing to hold here.
    private const string AdminSourceKey = "admin";
    private const string AdminSql = """
      SELECT 'admin' AS modul, aal.id AS item_id, NULL::text AS nomor,
             aal.action AS action, aal.deskripsi::text AS reason,
             aal.actor_id AS actor_id, aal.actor_nama::text AS actor_nama, u.role::text AS actor_role,
             u.divisi AS actor_divisi, u.departemen AS actor_departemen,
             aal.created_at
      FROM admin_activity_log aal
      LEFT JOIN users u ON u.id = aal.actor_id
      """;

    // Every modul key BuildUnion/List/Aktor accept - the seven per-module log sources plus the
    // deletion_log-backed "deleted" feed and the admin_activity_log-backed "admin" feed.
    private static readonly HashSet<string> AllModuls = new(Sources.Keys) { DeletedSourceKey, AdminSourceKey };

    private readonly AppDbContext _db;

    public RiwayatAktivitasController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    // One SELECT per module, UNION ALL-ed. Every value the caller supplies travels as a parameter;
    // the only interpolated text is table/column names taken from Sources above (or the fixed
    // DeletedSql/AdminSql literals for "deleted"/"admin").
    private static string BuildUnion(IEnumerable<string> moduls) =>
        string.Join("\n  UNION ALL\n", moduls.Select(m =>
        {
            if (m == DeletedSourceKey) return DeletedSql;
            if (m == AdminSourceKey) return AdminSql;
            var s = Sources[m];
            return $"""
              SELECT '{m}' AS modul, l.{s.Fk} AS item_id, p.{s.Nomor}::text AS nomor,
                     l.action, l.reason, l.actor_id, u.nama AS actor_nama, u.role::text AS actor_role,
                     u.divisi AS actor_divisi, u.departemen AS actor_departemen,
                     l.created_at
              FROM {s.Log} l
              LEFT JOIN {s.Parent} p ON p.id = l.{s.Fk}
              LEFT JOIN users u ON u.id = l.actor_id
              """;
        }));

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? bulan = null,
        [FromQuery] DateOnly? tanggal = null,
        [FromQuery] string? modul = null,
        [FromQuery(Name = "actor_id")] int? actorId = null,
        [FromQuery] string? action = null,
        [FromQuery(Name = "dari_tanggal")] DateOnly? dariTanggal = null,
        [FromQuery(Name = "sampai_tanggal")] DateOnly? sampaiTanggal = null)
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        if (page < 1) return BadRequest(new { detail = "Halaman tidak valid" });
        if (!AllowedLimits.Contains(limit))
            return BadRequest(new { detail = $"Limit harus salah satu dari {string.Join(",", AllowedLimits)}" });

        var moduls = AllModuls.AsEnumerable();
        if (!string.IsNullOrEmpty(modul))
        {
            if (!AllModuls.Contains(modul)) return BadRequest(new { detail = "Modul tidak valid" });
            moduls = new[] { modul };
        }

        var where = new List<string>();
        var parameters = new List<NpgsqlParameter>();

        if (!string.IsNullOrWhiteSpace(search))
        {
            where.Add("(nomor ILIKE @search OR reason ILIKE @search OR actor_nama ILIKE @search)");
            parameters.Add(new NpgsqlParameter("search", $"%{search.Trim()}%"));
        }

        if (actorId.HasValue)
        {
            where.Add("actor_id = @actorId");
            parameters.Add(new NpgsqlParameter("actorId", actorId.Value));
        }
        if (!string.IsNullOrEmpty(action))
        {
            where.Add("action = @action");
            parameters.Add(new NpgsqlParameter("action", action));
        }

        if (tanggal.HasValue)
        {
            where.Add("created_at >= @tglDari AND created_at < @tglSampai");
            parameters.Add(new NpgsqlParameter("tglDari", tanggal.Value.ToDateTime(TimeOnly.MinValue) - WaktuWib.Offset));
            parameters.Add(new NpgsqlParameter("tglSampai", tanggal.Value.AddDays(1).ToDateTime(TimeOnly.MinValue) - WaktuWib.Offset));
        }
        else if (!string.IsNullOrWhiteSpace(bulan))
        {
            var parts = bulan.Trim().Split('-');
            if (parts.Length == 1 && int.TryParse(parts[0], out var yr))
            {
                var start = new DateTime(yr, 1, 1, 0, 0, 0, DateTimeKind.Unspecified) - WaktuWib.Offset;
                var end = new DateTime(yr + 1, 1, 1, 0, 0, 0, DateTimeKind.Unspecified) - WaktuWib.Offset;
                where.Add("created_at >= @blnStart AND created_at < @blnEnd");
                parameters.Add(new NpgsqlParameter("blnStart", start));
                parameters.Add(new NpgsqlParameter("blnEnd", end));
            }
            else if (parts.Length == 2 && int.TryParse(parts[0], out var yr2) && int.TryParse(parts[1], out var mo))
            {
                var start = new DateTime(yr2, mo, 1, 0, 0, 0, DateTimeKind.Unspecified) - WaktuWib.Offset;
                var end = start.AddMonths(1);
                where.Add("created_at >= @blnStart AND created_at < @blnEnd");
                parameters.Add(new NpgsqlParameter("blnStart", start));
                parameters.Add(new NpgsqlParameter("blnEnd", end));
            }
        }

        // Dates are the WIB calendar days the user picked, but created_at is UTC - shift the
        // boundaries by the same +7h the rest of the app uses so "16 September" means the WIB day,
        // not the UTC one (see Services/WaktuWib.cs).
        if (dariTanggal.HasValue)
        {
            where.Add("created_at >= @dari");
            parameters.Add(new NpgsqlParameter("dari", dariTanggal.Value.ToDateTime(TimeOnly.MinValue) - WaktuWib.Offset));
        }
        if (sampaiTanggal.HasValue)
        {
            where.Add("created_at < @sampai");
            parameters.Add(new NpgsqlParameter("sampai", sampaiTanggal.Value.AddDays(1).ToDateTime(TimeOnly.MinValue) - WaktuWib.Offset));
        }
        var whereSql = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var union = BuildUnion(moduls);
        var total = await ScalarAsync($"SELECT count(*) FROM (\n{union}\n) AS gabungan {whereSql}", parameters);

        var rows = new List<RiwayatAktivitasOut>();
        var sql = $"""
            SELECT modul, item_id, nomor, action, reason, actor_id, actor_nama, actor_role, actor_divisi, actor_departemen, created_at
            FROM (
            {union}
            ) AS gabungan
            {whereSql}
            ORDER BY created_at DESC, item_id DESC
            LIMIT @limit OFFSET @offset
            """;

        {
            // Deliberately not `await using` - this connection belongs to the DbContext, and
            // disposing it here would close it for everything else on the same request.
            var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, conn);
            foreach (var p in parameters) cmd.Parameters.Add(Clone(p));
            cmd.Parameters.AddWithValue("limit", limit);
            cmd.Parameters.AddWithValue("offset", (page - 1) * limit);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                rows.Add(new RiwayatAktivitasOut
                {
                    Modul = reader.GetString(0),
                    ItemId = reader.GetInt32(1),
                    Nomor = reader.IsDBNull(2) ? null : reader.GetString(2),
                    Action = reader.GetString(3),
                    Reason = reader.IsDBNull(4) ? null : reader.GetString(4),
                    ActorId = reader.IsDBNull(5) ? null : reader.GetInt32(5),
                    ActorNama = reader.IsDBNull(6) ? null : reader.GetString(6),
                    ActorRole = reader.IsDBNull(7) ? null : reader.GetString(7),
                    ActorDivisi = reader.IsDBNull(8) ? null : reader.GetString(8),
                    ActorDepartemen = reader.IsDBNull(9) ? null : reader.GetString(9),
                    CreatedAt = reader.GetDateTime(10),
                });
            }
        }

        return Ok(new RiwayatAktivitasListOut { Items = rows, Total = total, Page = page, Limit = limit });
    }

    // Only the people who actually appear in the logs, so the Pelaku dropdown stays short instead
    // of listing every account that has never done anything.
    [HttpGet("aktor")]
    public async Task<IActionResult> Aktor()
    {
        var (_, error) = await RequireRoleAsync(RoleEnum.SUPER_ADMIN);
        if (error != null) return error;

        var union = BuildUnion(AllModuls);
        var sql = $"""
            SELECT DISTINCT actor_id, actor_nama, actor_role
            FROM (
            {union}
            ) AS gabungan
            WHERE actor_id IS NOT NULL
            ORDER BY actor_nama
            """;

        var result = new List<RiwayatAktorOut>();
        var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            result.Add(new RiwayatAktorOut
            {
                Id = reader.GetInt32(0),
                Nama = reader.IsDBNull(1) ? "-" : reader.GetString(1),
                Role = reader.IsDBNull(2) ? "-" : reader.GetString(2),
            });
        }
        return Ok(result);
    }

    private async Task<int> ScalarAsync(string sql, List<NpgsqlParameter> parameters)
    {
        var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var p in parameters) cmd.Parameters.Add(Clone(p));
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    // An NpgsqlParameter instance can only belong to one command, and the same filter values are
    // used by both the count and the page query.
    private static NpgsqlParameter Clone(NpgsqlParameter p) => new(p.ParameterName, p.Value);
}
