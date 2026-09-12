using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Models;
using PengirimanApi.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PengirimanApi.Controllers;

// Same "Download PDF"/"Download Excel" toolbar as Ekspedisi's ExportController and
// BookingRuangExportController, applied to Maintenance's Transaksi list.
[ApiController]
[Route("api/perbaikan-sarana")]
public class PerbaikanSaranaExportController : ApiControllerBase
{
    private readonly AppDbContext _db;

    private static readonly (string Field, string Label)[] Columns =
    {
        ("nomor_perbaikan", "No Pengajuan"),
        ("diajukan", "Diajukan"),
        ("tanggal", "Tanggal Pengajuan"),
        ("lokasi", "Lokasi"),
        ("kategori", "Kategori"),
        ("deskripsi", "Deskripsi Kerusakan"),
        ("nama_pelapor", "Nama Pelapor"),
        ("no_telepon_pelapor", "No. Telepon Pelapor"),
        ("divisi", "Divisi"),
        ("departemen", "Departemen"),
        ("catatan", "Catatan"),
        ("status", "Status"),
        ("execution_stage", "Status Eksekusi"),
        ("lokasi_dicek_oleh", "Lokasi Dicek Oleh"),
        ("lokasi_dicek_pada", "Lokasi Dicek Pada"),
        ("gambar_dibuat_oleh", "Gambar Dibuat Oleh"),
        ("gambar_dibuat_pada", "Gambar Dibuat Pada"),
        ("selesai_oleh", "Selesai Oleh"),
        ("selesai_pada", "Selesai Pada"),
    };

    private static readonly float[] PdfColWidths = { 34, 34, 26, 45, 30, 65, 40, 40, 40, 40, 55, 45, 45, 40, 40, 40, 40, 40, 40 };

    // Matches frontend's EXECUTION_STAGE_LABEL (lib/constants.ts) word-for-word.
    private static readonly Dictionary<string, string> ExecutionStageLabel = new()
    {
        ["MENUNGGU"] = "Menunggu Eksekusi",
        ["LOKASI_DICEK"] = "Lokasi Dicek",
        ["GAMBAR_DIBUAT"] = "Gambar Dibuat",
        ["SELESAI"] = "Selesai Dieksekusi",
    };

    private static readonly Dictionary<string, string> StatusLabel = new()
    {
        ["DRAFT"] = "Draft",
        ["SUBMITTED"] = "On-Approval: Approval Departemen/Divisi",
        ["REJECTED_L1"] = "Rejected: Approval Departemen/Divisi",
        ["APPROVED_L1"] = "On-Approval: Admin GA",
        ["REJECTED_GA"] = "Rejected: Admin GA",
        ["APPROVED_GA"] = "On-Approval: Approval GA",
        ["REJECTED_GA_APPROVAL"] = "Rejected: Approval GA",
        ["APPROVED_GA_APPROVAL"] = "Approved",
    };

    private static readonly Dictionary<string, string> KategoriLabel = new()
    {
        ["AC"] = "AC / Pendingin",
        ["LISTRIK"] = "Listrik",
        ["AIR"] = "Air / Saluran",
        ["FURNITUR"] = "Furnitur",
        ["GEDUNG"] = "Gedung / Bangunan",
        ["IT"] = "IT / Jaringan",
        ["LAINNYA"] = "Lainnya",
    };

    public PerbaikanSaranaExportController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    private static object? GetFieldValue(PerbaikanSarana row, string field, Dictionary<int, string> actorNames) => field switch
    {
        "nomor_perbaikan" => row.NomorPerbaikan ?? "-",
        "diajukan" => row.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
        "tanggal" => row.Tanggal.ToString("yyyy-MM-dd"),
        "lokasi" => row.Lokasi,
        "kategori" => KategoriLabel.GetValueOrDefault(row.Kategori.ToString(), row.Kategori.ToString()),
        "deskripsi" => row.DeskripsiKerusakan,
        "nama_pelapor" => row.NamaPelapor,
        "no_telepon_pelapor" => row.NoTeleponPelapor,
        "divisi" => row.Divisi,
        "departemen" => row.Departemen,
        "catatan" => row.Catatan,
        "status" => StatusLabel.GetValueOrDefault(row.Status.ToString(), row.Status.ToString()),
        // Eksekusi fisik cuma berarti untuk laporan yang sudah Approved final - lihat komentar yang
        // sama di PerbaikanSaranaController.GetStats.
        "execution_stage" => row.Status == BookingStatusEnum.APPROVED_GA_APPROVAL
            ? ExecutionStageLabel.GetValueOrDefault(row.ExecutionStage.ToString(), row.ExecutionStage.ToString())
            : "-",
        "lokasi_dicek_oleh" => row.LokasiDicekBy.HasValue ? actorNames.GetValueOrDefault(row.LokasiDicekBy.Value, "-") : "-",
        "lokasi_dicek_pada" => row.LokasiDicekAt?.ToString("yyyy-MM-dd HH:mm") ?? "-",
        "gambar_dibuat_oleh" => row.GambarDibuatBy.HasValue ? actorNames.GetValueOrDefault(row.GambarDibuatBy.Value, "-") : "-",
        "gambar_dibuat_pada" => row.GambarDibuatAt?.ToString("yyyy-MM-dd HH:mm") ?? "-",
        "selesai_oleh" => row.SelesaiBy.HasValue ? actorNames.GetValueOrDefault(row.SelesaiBy.Value, "-") : "-",
        "selesai_pada" => row.SelesaiAt?.ToString("yyyy-MM-dd HH:mm") ?? "-",
        _ => null,
    };

    private async Task<Dictionary<int, string>> ResolveActorNamesAsync(List<PerbaikanSarana> rows)
    {
        var actorIds = rows
            .SelectMany(r => new[] { r.LokasiDicekBy, r.GambarDibuatBy, r.SelesaiBy })
            .Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        return actorIds.Count > 0
            ? await _db.Users.Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Nama)
            : new Dictionary<int, string>();
    }

    private static string Slugify(string text)
    {
        var slug = Regex.Replace(text.Trim(), "[^A-Za-z0-9]+", "-");
        return slug.Trim('-').ToLowerInvariant();
    }

    private static string BuildFilename(string? bulan, BookingStatusEnum? statusFilter, bool onlyRejected, string? divisi, string? departemen, string? direktorat, string? search, DateOnly? tanggal = null)
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(bulan)) parts.Add(bulan);
        if (tanggal.HasValue) parts.Add(tanggal.Value.ToString("yyyy-MM-dd"));
        if (statusFilter.HasValue)
        {
            var key = statusFilter.Value.ToString();
            parts.Add(Slugify(StatusLabel.GetValueOrDefault(key, key)));
        }
        else if (onlyRejected) parts.Add("rejected");
        if (!string.IsNullOrEmpty(divisi)) parts.Add(Slugify(divisi));
        if (!string.IsNullOrEmpty(departemen)) parts.Add(Slugify(departemen));
        if (!string.IsNullOrEmpty(direktorat)) parts.Add(Slugify(direktorat));
        if (!string.IsNullOrEmpty(search)) parts.Add($"cari-{Slugify(search)}");
        return "perbaikan-sarana-" + (parts.Count > 0 ? string.Join("-", parts) : "semua");
    }

    private static (BookingStatusEnum? statusFilter, bool onlyRejected)? ParseStatusFilter(string? status)
    {
        if (string.IsNullOrEmpty(status)) return (null, false);
        if (status == "REJECTED") return (null, true);
        return Enum.TryParse<BookingStatusEnum>(status, out var parsed) ? (parsed, false) : null;
    }

    private List<PerbaikanSarana> ExportRows(User currentUser, string? bulan, BookingStatusEnum? statusFilter, bool onlyRejected, string? kategori, string? divisi, string? departemen, string? direktorat, string? search, DateOnly? tanggal = null)
    {
        KategoriKerusakanEnum? kategoriFilter = !string.IsNullOrEmpty(kategori) && Enum.TryParse<KategoriKerusakanEnum>(kategori, out var parsedKategori) ? parsedKategori : null;
        var query = PerbaikanSaranaController.ApplyListFilters(_db, _db.PerbaikanSaranas.AsQueryable(), currentUser, statusFilter, divisi, departemen, kategoriFilter, direktorat, bulan, search, onlyRejected, tanggal);
        return query.OrderBy(p => p.Tanggal).ThenBy(p => p.Id).ToList();
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] string? bulan,
        [FromQuery] string? status,
        [FromQuery] string? kategori,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery] string? direktorat,
        [FromQuery] string? search,
        [FromQuery] DateOnly? tanggal = null)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var parsedStatus = ParseStatusFilter(status);
        if (parsedStatus == null) return BadRequest(new { detail = "Status tidak valid" });
        var (statusFilter, onlyRejected) = parsedStatus.Value;

        List<PerbaikanSarana> rows;
        try
        {
            rows = ExportRows(user!, bulan, statusFilter, onlyRejected, kategori, divisi, departemen, direktorat, search, tanggal);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var actorNames = await ResolveActorNamesAsync(rows);

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Perbaikan Sarana");

        var header = new List<string> { "No" };
        header.AddRange(Columns.Select(c => c.Label));
        for (var i = 0; i < header.Count; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = header[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1450C9");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#B7C6E0");
        }

        var rowIdx = 1;
        foreach (var row in rows)
        {
            rowIdx++;
            ws.Cell(rowIdx, 1).Value = rowIdx - 1;
            for (var i = 0; i < Columns.Length; i++)
            {
                var value = GetFieldValue(row, Columns[i].Field, actorNames);
                var cell = ws.Cell(rowIdx, i + 2);
                if (value is int intVal) cell.Value = intVal;
                else cell.Value = value?.ToString() ?? "";
            }
            for (var i = 1; i <= header.Count; i++)
            {
                var cell = ws.Cell(rowIdx, i);
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#B7C6E0");
            }
        }

        ws.Columns(1, header.Count).AdjustToContents();
        foreach (var col in ws.Columns(1, header.Count))
        {
            if (col.Width < 10) col.Width = 10;
            if (col.Width > 45) col.Width = 45;
        }

        string[] wrapFields = { "deskripsi", "catatan" };
        foreach (var field in wrapFields)
        {
            var colIdx = Array.FindIndex(Columns, c => c.Field == field) + 2;
            ws.Column(colIdx).Width = 32;
            var colRange = ws.Range(2, colIdx, rowIdx, colIdx);
            colRange.Style.Alignment.WrapText = true;
            colRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
        }
        ws.Rows(1, rowIdx).AdjustToContents();

        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        var filename = BuildFilename(bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, search, tanggal) + ".xlsx";
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    [HttpGet("export-pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] string? bulan,
        [FromQuery] string? status,
        [FromQuery] string? kategori,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery] string? direktorat,
        [FromQuery] string? search,
        [FromQuery] DateOnly? tanggal = null)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var parsedStatus = ParseStatusFilter(status);
        if (parsedStatus == null) return BadRequest(new { detail = "Status tidak valid" });
        var (statusFilter, onlyRejected) = parsedStatus.Value;

        List<PerbaikanSarana> rows;
        try
        {
            rows = ExportRows(user!, bulan, statusFilter, onlyRejected, kategori, divisi, departemen, direktorat, search, tanggal);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var actorNames = await ResolveActorNamesAsync(rows);
        var baseFilename = BuildFilename(bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, search, tanggal);

        var headerBg = "#1450C9";
        var altBg = "#F5F9FF";
        var borderColor = "#CCCCCC";

        const float noColWidth = 16f;
        const float availableWidth = 828f;
        var totalWidth = noColWidth + PdfColWidths.Sum();
        var scale = availableWidth / totalWidth;
        var colWidthsScaled = new[] { noColWidth * scale }.Concat(PdfColWidths.Select(w => w * scale)).ToArray();

        const float baseBodySize = 6f;
        const float baseHeaderSize = 6.2f;
        const float minBodySize = 4f;
        const float avgCharWidthRatio = 0.52f;

        var colTexts = new List<string>[colWidthsScaled.Length];
        colTexts[0] = new List<string> { "No" };
        for (var i = 0; i < Columns.Length; i++) colTexts[i + 1] = new List<string> { Columns[i].Label };
        var rowCount = 0;
        foreach (var row in rows)
        {
            rowCount++;
            colTexts[0].Add(rowCount.ToString());
            for (var i = 0; i < Columns.Length; i++)
                colTexts[i + 1].Add(GetFieldValue(row, Columns[i].Field, actorNames)?.ToString() ?? "");
        }

        var fontScale = 1f;
        for (var i = 0; i < colWidthsScaled.Length; i++)
        {
            var usableWidth = colWidthsScaled[i] - 4f;
            var longest = colTexts[i].Count > 0 ? colTexts[i].Max(t => t.Length) : 0;
            if (longest == 0 || usableWidth <= 0) continue;
            var maxFontForCol = usableWidth / (longest * avgCharWidthRatio);
            fontScale = Math.Min(fontScale, maxFontForCol / baseBodySize);
        }
        fontScale = Math.Clamp(fontScale, minBodySize / baseBodySize, 1f);

        var bodySize = baseBodySize * fontScale;
        var headerSize = baseHeaderSize * fontScale;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(6);
                page.DefaultTextStyle(x => x.FontSize(bodySize).LineHeight(1));

                page.Content().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        foreach (var w in colWidthsScaled) columns.ConstantColumn(w);
                    });

                    table.Header(h =>
                    {
                        h.Cell().Background(headerBg).BorderColor("#7C9CE0").Border(0.4f).Padding(2)
                            .Text("No").FontColor(Colors.White).Bold().FontSize(headerSize);
                        foreach (var (_, label) in Columns)
                            h.Cell().Background(headerBg).BorderColor("#7C9CE0").Border(0.4f).Padding(2)
                                .Text(label).FontColor(Colors.White).Bold().FontSize(headerSize);
                    });

                    var idx = 0;
                    foreach (var row in rows)
                    {
                        idx++;
                        var bg = idx % 2 == 0 ? altBg : "#FFFFFF";
                        table.Cell().Background(bg).BorderColor(borderColor).Border(0.4f).Padding(2).Text(idx.ToString());
                        foreach (var (field, _) in Columns)
                        {
                            var value = GetFieldValue(row, field, actorNames);
                            table.Cell().Background(bg).BorderColor(borderColor).Border(0.4f).Padding(2).Text(value?.ToString() ?? "");
                        }
                    }
                });
            });
        });

        var bytes = document.GeneratePdf();
        var filename = baseFilename + ".pdf";
        return File(bytes, "application/pdf", filename);
    }
}
