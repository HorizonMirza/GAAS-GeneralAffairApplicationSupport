using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using PengirimanApi.Data;
using PengirimanApi.Models;
using PengirimanApi.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PengirimanApi.Controllers;

// Same "Download PDF"/"Download Excel" toolbar as Ekspedisi's ExportController and
// BookingRuangExportController, applied to Vehicle Booking's Transaksi list - a separate file
// mirroring those rather than folding into BookingKendaraanController.
[ApiController]
[Route("api/booking-kendaraan")]
public class BookingKendaraanExportController : ApiControllerBase
{
    private readonly AppDbContext _db;

    private static readonly (string Field, string Label)[] Columns =
    {
        ("nomor_pemesanan", "No Pesanan"),
        ("diajukan", "Diajukan"),
        ("tanggal", "Tanggal"),
        ("jam", "Jam"),
        ("keperluan", "Keperluan"),
        ("pic", "PIC"),
        ("kendaraan", "Kendaraan"),
        ("supir", "Supir"),
        ("divisi", "Divisi"),
        ("departemen", "Departemen"),
        ("penumpang", "Penumpang"),
        ("catatan", "Catatan"),
        ("status", "Status"),
    };

    private static readonly float[] PdfColWidths =
    {
        30, 34, 22, 30, 50, 30, 46, 34, 34, 34, 20, 50, 40,
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
        ["CANCELLED"] = "Cancelled",
    };

    public BookingKendaraanExportController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    private static string VehicleLabel(BookingKendaraan row) =>
        string.IsNullOrEmpty(row.PlatNomor) ? row.NamaKendaraan : $"{row.NamaKendaraan} ({row.PlatNomor})";

    private static string JamLabel(BookingKendaraan row)
    {
        if (row.IsWholeDay) return "Sepanjang Hari";
        if (row.JamMulai == null || row.JamSelesai == null) return "-";
        return $"{row.JamMulai:HH:mm}-{row.JamSelesai:HH:mm}";
    }

    private static object? GetFieldValue(BookingKendaraan row, string field) => field switch
    {
        "nomor_pemesanan" => row.NomorPemesanan ?? "-",
        "diajukan" => row.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
        "tanggal" => row.Tanggal.ToString("yyyy-MM-dd"),
        "jam" => JamLabel(row),
        "keperluan" => row.Keperluan,
        "pic" => row.Pic,
        "kendaraan" => VehicleLabel(row),
        "supir" => row.Supir,
        "divisi" => row.Divisi,
        "departemen" => row.Departemen,
        "penumpang" => row.JumlahPenumpang,
        "catatan" => row.Catatan,
        "status" => StatusLabel.GetValueOrDefault(row.Status.ToString(), row.Status.ToString()),
        _ => null,
    };

    private static string Slugify(string text)
    {
        var slug = Regex.Replace(text.Trim(), "[^A-Za-z0-9]+", "-");
        return slug.Trim('-').ToLowerInvariant();
    }

    private static string BuildFilename(string? bulan, BookingStatusEnum? statusFilter, bool onlyRejected, string? divisi, string? departemen, string? direktorat, string? namaKendaraan, string? search, DateOnly? tanggal = null)
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
        if (!string.IsNullOrEmpty(namaKendaraan)) parts.Add(Slugify(namaKendaraan));
        if (!string.IsNullOrEmpty(search)) parts.Add($"cari-{Slugify(search)}");
        return "booking-kendaraan-" + (parts.Count > 0 ? string.Join("-", parts) : "semua");
    }

    private List<BookingKendaraan> ExportRows(User currentUser, BookingStatusEnum? statusFilter, bool onlyRejected, string? divisi, string? departemen, string? namaKendaraan, DateOnly? tanggal, string? direktorat, string? bulan, string? search)
    {
        var query = BookingKendaraanController.ApplyListFilters(_db, _db.BookingKendaraans.AsQueryable(), currentUser, statusFilter, divisi, departemen, namaKendaraan, tanggal, direktorat, bulan, search, onlyRejected: onlyRejected);
        return query.OrderBy(b => b.Tanggal).ThenBy(b => b.Id).ToList();
    }

    // "REJECTED" is a synthetic value the Status filter dropdown sends for its single "Rejected"
    // option - it isn't a real BookingStatusEnum member, so it's parsed here instead of via
    // [FromQuery] enum binding (which would 400 on it). Shared by both export endpoints below.
    private static (BookingStatusEnum? statusFilter, bool onlyRejected)? ParseStatusFilter(string? status)
    {
        if (string.IsNullOrEmpty(status)) return (null, false);
        if (status == "REJECTED") return (null, true);
        return Enum.TryParse<BookingStatusEnum>(status, out var parsed) ? (parsed, false) : null;
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] string? bulan,
        [FromQuery] string? status,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery(Name = "nama_kendaraan")] string? namaKendaraan,
        [FromQuery] DateOnly? tanggal,
        [FromQuery] string? direktorat,
        [FromQuery] string? search)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var parsedStatus = ParseStatusFilter(status);
        if (parsedStatus == null) return BadRequest(new { detail = "Status tidak valid" });
        var (statusFilter, onlyRejected) = parsedStatus.Value;

        List<BookingKendaraan> rows;
        try
        {
            rows = ExportRows(user!, statusFilter, onlyRejected, divisi, departemen, namaKendaraan, tanggal, direktorat, bulan, search);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Booking Kendaraan");

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
            if (col.Width > 40) col.Width = 40;
        }

        string[] wrapFields = { "keperluan", "catatan" };
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
        var filename = BuildFilename(bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, namaKendaraan, search, tanggal) + ".xlsx";
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    [HttpGet("export-pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] string? bulan,
        [FromQuery] string? status,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery(Name = "nama_kendaraan")] string? namaKendaraan,
        [FromQuery] DateOnly? tanggal,
        [FromQuery] string? direktorat,
        [FromQuery] string? search)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        var parsedStatus = ParseStatusFilter(status);
        if (parsedStatus == null) return BadRequest(new { detail = "Status tidak valid" });
        var (statusFilter, onlyRejected) = parsedStatus.Value;

        List<BookingKendaraan> rows;
        try
        {
            rows = ExportRows(user!, statusFilter, onlyRejected, divisi, departemen, namaKendaraan, tanggal, direktorat, bulan, search);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var baseFilename = BuildFilename(bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, namaKendaraan, search, tanggal);

        var headerBg = "#1450C9";
        var altBg = "#F5F9FF";
        var borderColor = "#CCCCCC";

        const float noColWidth = 14f;
        const float availableWidth = 828f;
        var totalWidth = noColWidth + PdfColWidths.Sum();
        var scale = availableWidth / totalWidth;
        var colWidthsScaled = new[] { noColWidth * scale }.Concat(PdfColWidths.Select(w => w * scale)).ToArray();

        const float baseBodySize = 5.5f;
        const float baseHeaderSize = 5.7f;
        const float minBodySize = 3.5f;
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
