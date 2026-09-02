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

[ApiController]
[Route("api/pengiriman")]
public class ExportController : ApiControllerBase
{
    private readonly AppDbContext _db;

    private static readonly (string Field, string Label)[] Columns =
    {
        ("nomor_transmittal", "Nomor Transmittal"),
        ("no_resi", "No Resi"),
        ("tanggal", "Tanggal"),
        ("tujuan_penerimaan", "Tujuan Penerimaan"),
        ("jumlah_item", "Jumlah Item"),
        ("divisi", "Divisi"),
        ("departemen", "Departemen"),
        ("nama_pengirim", "Nama Pengirim"),
        ("no_telepon_pengirim", "No. Telepon Pengirim"),
        ("alamat_pengirim", "Alamat Pengirim"),
        ("nama_penerima", "Nama Penerima"),
        ("no_telepon_penerima", "No. Telepon Penerima"),
        ("alamat_penerima", "Alamat Penerima"),
        ("kode_program", "Kode Program"),
        ("asuransi_status", "Asuransi"),
        ("asuransi_harga", "Asuransi (Harga)"),
        ("request_packing", "Request Packing"),
        ("catatan", "Catatan"),
        ("berat_barang_kg", "Berat Barang (Kg)"),
        ("sub_total", "Ongkos Kirim (Harga)"),
        ("total", "Total"),
        ("status", "Status"),
    };

    private static readonly float[] PdfColWidths =
    {
        45, 30, 26, 50, 16, 36, 36, 38, 34, 95, 38, 34, 95, 34, 20, 26, 24, 60, 24, 28, 46, 40,
    };

    private static readonly Dictionary<string, string> StatusLabel = new()
    {
        ["DRAFT"] = "Draft",
        ["SUBMITTED"] = "On-Approval Departemen/Divisi",
        ["REJECTED_L1"] = "Rejected Approval Departemen/Divisi",
        ["APPROVED_L1"] = "On-Approval Admin General Affair",
        ["REJECTED_GA"] = "Rejected Admin General Affair",
        ["APPROVED_GA"] = "On-Approval Approval GA",
        ["REJECTED_GA_APPROVAL"] = "Rejected Approval GA",
        ["APPROVED_GA_APPROVAL"] = "On-Approval Mitra",
        ["REJECTED_KPU"] = "Rejected Mitra",
        ["COMPLETED"] = "Approved",
    };

    public ExportController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    private static object? GetFieldValue(Pengiriman row, string field) => field switch
    {
        "no_resi" => row.NoResi,
        "tanggal" => row.Tanggal.ToString("yyyy-MM-dd"),
        "nomor_transmittal" => row.NomorTransmittal,
        "tujuan_penerimaan" => row.TujuanPenerimaan,
        "jumlah_item" => row.JumlahItem,
        "nama_pengirim" => row.NamaPengirim,
        "no_telepon_pengirim" => row.NoTeleponPengirim,
        "alamat_pengirim" => row.AlamatPengirim,
        "divisi" => row.Divisi,
        "departemen" => row.Departemen,
        "kode_program" => row.KodeProgram,
        "nama_penerima" => row.NamaPenerima,
        "alamat_penerima" => row.AlamatPenerima,
        "no_telepon_penerima" => row.NoTeleponPenerima,
        "asuransi_status" => row.AsuransiStatus.ToString(),
        "request_packing" => row.RequestPacking,
        "catatan" => row.Catatan,
        "berat_barang_kg" => row.BeratBarangKg,
        "asuransi_harga" => row.AsuransiHarga,
        "sub_total" => row.SubTotal,
        "total" => row.Total,
        "status" => row.Status.ToString(),
        _ => null,
    };

    private static string Slugify(string text)
    {
        var slug = Regex.Replace(text.Trim(), "[^A-Za-z0-9]+", "-");
        return slug.Trim('-').ToLowerInvariant();
    }

    private static string BuildFilename(string? bulan, StatusEnum? statusFilter, bool onlyRejected, string? divisi, string? departemen, string? direktorat, string? nomorTransmittal)
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(bulan)) parts.Add(bulan);
        if (statusFilter.HasValue)
        {
            var key = statusFilter.Value.ToString();
            parts.Add(Slugify(StatusLabel.GetValueOrDefault(key, key)));
        }
        else if (onlyRejected) parts.Add("rejected");
        if (!string.IsNullOrEmpty(divisi)) parts.Add(Slugify(divisi));
        if (!string.IsNullOrEmpty(departemen)) parts.Add(Slugify(departemen));
        if (!string.IsNullOrEmpty(direktorat)) parts.Add(Slugify(direktorat));
        if (!string.IsNullOrEmpty(nomorTransmittal)) parts.Add($"cari-{Slugify(nomorTransmittal)}");
        return "mutasi-pengiriman-" + (parts.Count > 0 ? string.Join("-", parts) : "semua");
    }

    private List<Pengiriman> ExportRows(User currentUser, string? bulan, StatusEnum? statusFilter, bool onlyRejected, string? divisi, string? departemen, string? direktorat, string? nomorTransmittal)
    {
        var query = PengirimanController.ApplyListFilters(_db, _db.Pengiriman.AsQueryable(), currentUser, statusFilter, divisi, departemen, direktorat, nomorTransmittal, bulan, onlyRejected: onlyRejected);
        return query.OrderBy(p => p.Tanggal).ThenBy(p => p.Id).ToList();
    }

    // "REJECTED" is a synthetic value the Status filter dropdown sends for its single "Rejected"
    // option - it isn't a real StatusEnum member, so it's parsed here instead of via [FromQuery]
    // enum binding (which would 400 on it). Shared by both export endpoints below.
    private static (StatusEnum? statusFilter, bool onlyRejected)? ParseStatusFilter(string? status)
    {
        if (string.IsNullOrEmpty(status)) return (null, false);
        if (status == "REJECTED") return (null, true);
        return Enum.TryParse<StatusEnum>(status, out var parsed) ? (parsed, false) : null;
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] string? bulan,
        [FromQuery] string? status,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery] string? direktorat,
        [FromQuery(Name = "nomor_transmittal")] string? nomorTransmittal)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var parsedStatus = ParseStatusFilter(status);
        if (parsedStatus == null) return BadRequest(new { detail = "Status tidak valid" });
        var (statusFilter, onlyRejected) = parsedStatus.Value;

        var rows = ExportRows(user!, bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, nomorTransmittal);

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Mutasi Pengiriman");

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
        decimal grandTotal = 0;
        foreach (var row in rows)
        {
            rowIdx++;
            ws.Cell(rowIdx, 1).Value = rowIdx - 1;
            for (var i = 0; i < Columns.Length; i++)
            {
                var value = GetFieldValue(row, Columns[i].Field);
                var cell = ws.Cell(rowIdx, i + 2);
                if (value is decimal dec) cell.Value = dec;
                else if (value is int intVal) cell.Value = intVal;
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
            if (row.Total.HasValue) grandTotal += row.Total.Value;
        }

        rowIdx++;
        // Position the total under the "Total" column itself (not the last column, which is
        // "Status") so the footer label/value line up with the header row above them.
        var totalCol = Array.FindIndex(Columns, c => c.Field == "total") + 2;
        var labelCell = ws.Cell(rowIdx, totalCol - 1);
        labelCell.Value = "Total\nKeseluruhan:";
        labelCell.Style.Font.Bold = true;
        labelCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
        labelCell.Style.Alignment.WrapText = true;
        var valueCell = ws.Cell(rowIdx, totalCol);
        valueCell.Value = grandTotal;
        valueCell.Style.Font.Bold = true;
        valueCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
        ws.Row(rowIdx).Height = 30;
        for (var i = 1; i <= totalCol; i++)
        {
            ws.Cell(rowIdx, i).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            ws.Cell(rowIdx, i).Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            ws.Cell(rowIdx, i).Style.Border.OutsideBorderColor = XLColor.FromHtml("#B7C6E0");
        }

        ws.Columns(1, header.Count).AdjustToContents();
        foreach (var col in ws.Columns(1, header.Count))
        {
            if (col.Width < 10) col.Width = 10;
            if (col.Width > 40) col.Width = 40;
        }

        // AdjustToContents can undersize a column whose header text is wider than its data
        // (bold header font isn't measured accurately), leaving these headers clipped instead
        // of sitting on one line - force a floor wide enough for the header itself.
        var minColWidths = new (string Field, double MinWidth)[]
        {
            ("tanggal", 11),
            ("jumlah_item", 12),
            ("no_telepon_pengirim", 21),
            ("no_telepon_penerima", 21),
            ("asuransi_harga", 16),
        };
        foreach (var (field, minWidth) in minColWidths)
        {
            var colIdx = Array.FindIndex(Columns, c => c.Field == field) + 2;
            var col = ws.Column(colIdx);
            if (col.Width < minWidth) col.Width = minWidth;
        }

        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        var filename = BuildFilename(bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, nomorTransmittal) + ".xlsx";
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    [HttpGet("export-pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] string? bulan,
        [FromQuery] string? status,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery] string? direktorat,
        [FromQuery(Name = "nomor_transmittal")] string? nomorTransmittal)
    {
        var (user, error) = await RequireRoleAsync();
        if (error != null) return error;

        var parsedStatus = ParseStatusFilter(status);
        if (parsedStatus == null) return BadRequest(new { detail = "Status tidak valid" });
        var (statusFilter, onlyRejected) = parsedStatus.Value;

        var rows = ExportRows(user!, bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, nomorTransmittal);
        decimal grandTotal = rows.Where(r => r.Total.HasValue).Sum(r => r.Total!.Value);
        var baseFilename = BuildFilename(bulan, statusFilter, onlyRejected, divisi, departemen, direktorat, nomorTransmittal);

        var headerBg = "#1450C9";
        var altBg = "#F5F9FF";
        var borderColor = "#CCCCCC";

        const float noColWidth = 14f;
        const float availableWidth = 828f;
        var totalWidth = noColWidth + PdfColWidths.Sum();
        var scale = availableWidth / totalWidth;
        var colWidthsScaled = new[] { noColWidth * scale }.Concat(PdfColWidths.Select(w => w * scale)).ToArray();

        // Base sizes tuned for a page fully packed with data - never grown past this, only
        // shrunk (matching the Excel export's "everything on one line" look) when the longest
        // value in some column would otherwise wrap onto a second line at this size.
        const float baseBodySize = 4.8f;
        const float baseHeaderSize = 5f;
        const float baseFooterSize = 6f;
        const float minBodySize = 3f;
        // Rough average glyph width for the default sans font - just precise enough to decide
        // whether a column needs to shrink, not an exact text-measurement replacement.
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
            var usableWidth = colWidthsScaled[i] - 4f; // minus left+right cell padding
            var longest = colTexts[i].Count > 0 ? colTexts[i].Max(t => t.Length) : 0;
            if (longest == 0 || usableWidth <= 0) continue;
            var maxFontForCol = usableWidth / (longest * avgCharWidthRatio);
            fontScale = Math.Min(fontScale, maxFontForCol / baseBodySize);
        }
        fontScale = Math.Clamp(fontScale, minBodySize / baseBodySize, 1f);

        var bodySize = baseBodySize * fontScale;
        var headerSize = baseHeaderSize * fontScale;
        var footerSize = baseFooterSize * fontScale;

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

                    // Same reasoning as the Excel export: line the value up under the "Total"
                    // column instead of the actual last column ("Status"), and pad the
                    // remaining columns after it so the row still fills the table width.
                    var totalFieldIndex = Array.FindIndex(Columns, c => c.Field == "total");
                    table.Cell().ColumnSpan((uint)totalFieldIndex).Background("#EAF1FF").BorderColor(borderColor).Border(0.4f);
                    table.Cell().Background("#EAF1FF").BorderColor(borderColor).Border(0.4f).Padding(2)
                        .Text("Total\nKeseluruhan:").FontSize(footerSize).Bold();
                    table.Cell().Background("#EAF1FF").BorderColor(borderColor).Border(0.4f).Padding(2)
                        .Text(grandTotal.ToString("N0").Replace(",", ".")).FontSize(footerSize).Bold();
                    for (var i = totalFieldIndex + 1; i < Columns.Length; i++)
                        table.Cell().Background("#EAF1FF").BorderColor(borderColor).Border(0.4f);
                });
            });
        });

        var bytes = document.GeneratePdf();
        var filename = baseFilename + ".pdf";
        return File(bytes, "application/pdf", filename);
    }
}
