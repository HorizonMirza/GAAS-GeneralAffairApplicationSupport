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

// PDF/Excel export for the Archive Transaction table - same shape as ExportController
// (Pengiriman) and BookingRuangExportController, minus a grand-total footer since archive
// requests carry no monetary value. One row per request (not per PermintaanArsipItem); the
// "Daftar Arsip" column flattens a request's items into one summary string, matching how the
// on-screen table already displays them (see arsipItemsSummary on the frontend).
[Route("api/permintaan-arsip")]
public class ArsipExportController : ApiControllerBase
{
    private readonly AppDbContext _db;

    private static readonly (string Field, string Label)[] Columns =
    {
        ("nomor_arsip", "No Permintaan"),
        ("diajukan", "Diajukan"),
        ("jumlah_arsip", "Jumlah Arsip"),
        ("nama_pic", "Nama PIC"),
        ("no_telepon_pic", "No. Telepon PIC"),
        ("keperluan", "Keperluan"),
        ("daftar_arsip", "Daftar Arsip"),
        ("jumlah_jenis", "Jumlah Jenis"),
        ("lokasi_penyimpanan", "Lokasi Penyimpanan"),
        ("divisi", "Divisi"),
        ("departemen", "Departemen"),
        ("tanggal", "Tanggal"),
        ("catatan", "Catatan"),
        ("status", "Status"),
    };

    private static readonly float[] PdfColWidths = { 45, 38, 24, 45, 40, 55, 95, 20, 55, 40, 40, 28, 45, 55 };

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

    public ArsipExportController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    private static string ArsipListSummary(PermintaanArsip row) =>
        string.Join(", ", row.Items.Select(i => $"{i.NamaArsip} ({i.Jumlah} {i.Satuan})"));

    private static object? GetFieldValue(PermintaanArsip row, string field) => field switch
    {
        "nomor_arsip" => row.NomorArsip,
        "diajukan" => row.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
        "jumlah_arsip" => row.JumlahArsip,
        "nama_pic" => row.NamaPic,
        "no_telepon_pic" => row.NoTeleponPic,
        "keperluan" => row.Keperluan,
        "daftar_arsip" => ArsipListSummary(row),
        "jumlah_jenis" => row.Items.Count,
        "lokasi_penyimpanan" => row.LokasiPenyimpanan,
        "divisi" => row.Divisi,
        "departemen" => row.Departemen,
        "tanggal" => row.Tanggal.ToString("yyyy-MM-dd"),
        "catatan" => row.Catatan,
        "status" => StatusLabel.GetValueOrDefault(row.Status.ToString(), row.Status.ToString()),
        _ => null,
    };

    private static string Slugify(string text)
    {
        var slug = Regex.Replace(text.Trim(), "[^A-Za-z0-9]+", "-");
        return slug.Trim('-').ToLowerInvariant();
    }

    private static string BuildFilename(string? bulan, BookingStatusEnum? statusFilter, bool onlyRejected, string? divisi, string? departemen, string? direktorat, string? search, DateOnly? tanggal = null, string? kategori = null)
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
        if (!string.IsNullOrEmpty(kategori)) parts.Add(Slugify(kategori));
        if (!string.IsNullOrEmpty(divisi)) parts.Add(Slugify(divisi));
        if (!string.IsNullOrEmpty(departemen)) parts.Add(Slugify(departemen));
        if (!string.IsNullOrEmpty(direktorat)) parts.Add(Slugify(direktorat));
        if (!string.IsNullOrEmpty(search)) parts.Add($"cari-{Slugify(search)}");
        return "permintaan-arsip-" + (parts.Count > 0 ? string.Join("-", parts) : "semua");
    }

    private static (BookingStatusEnum? statusFilter, bool onlyRejected)? ParseStatusFilter(string? status)
    {
        if (string.IsNullOrEmpty(status)) return (null, false);
        if (status == "REJECTED") return (null, true);
        return Enum.TryParse<BookingStatusEnum>(status, out var parsed) ? (parsed, false) : null;
    }

    private async Task<List<PermintaanArsip>> ExportRowsAsync(User currentUser, string? bulan, BookingStatusEnum? statusFilter, bool onlyRejected, string? divisi, string? departemen, string? direktorat, string? search, DateOnly? tanggal = null, string? kategori = null)
    {
        var query = PermintaanArsipController.ApplyListFilters(_db, _db.PermintaanArsips.AsQueryable(), currentUser, statusFilter, divisi, departemen, direktorat, bulan, search, onlyRejected, tanggal, kategori);
        return await query.Include(p => p.Items).OrderBy(p => p.Tanggal).ThenBy(p => p.Id).ToListAsync();
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] string? bulan,
        [FromQuery] string? status,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery] string? direktorat,
        [FromQuery] string? search,
        [FromQuery] DateOnly? tanggal = null,
        [FromQuery] string? kategori = null)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var parsedStatus = ParseStatusFilter(status);
        if (parsedStatus == null) return BadRequest(new { detail = "Status tidak valid" });
        var (statusFilter, onlyRejected) = parsedStatus.Value;

        List<PermintaanArsip> rows;
        try
        {
            rows = await ExportRowsAsync(user!, bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, search, tanggal, kategori);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Permintaan Arsip");

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
                var value = GetFieldValue(row, Columns[i].Field);
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

        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        var filename = BuildFilename(bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, search, tanggal, kategori) + ".xlsx";
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    [HttpGet("export-pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] string? bulan,
        [FromQuery] string? status,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery] string? direktorat,
        [FromQuery] string? search,
        [FromQuery] DateOnly? tanggal = null,
        [FromQuery] string? kategori = null)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var parsedStatus = ParseStatusFilter(status);
        if (parsedStatus == null) return BadRequest(new { detail = "Status tidak valid" });
        var (statusFilter, onlyRejected) = parsedStatus.Value;

        List<PermintaanArsip> rows;
        try
        {
            rows = await ExportRowsAsync(user!, bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, search, tanggal, kategori);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var baseFilename = BuildFilename(bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, search, tanggal, kategori);

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
                colTexts[i + 1].Add(GetFieldValue(row, Columns[i].Field)?.ToString() ?? "");
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
                            var value = GetFieldValue(row, field);
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
