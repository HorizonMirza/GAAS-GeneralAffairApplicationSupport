using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Dtos;
using PengirimanApi.Models;
using PengirimanApi.Services;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PengirimanApi.Controllers;

// PDF/Excel export for the Archive Inventory (Katalog) table - scoped to only fully-approved
// requests exactly like PermintaanArsipController.GetCatalog - see that method for why (this IS
// the "what's actually sitting in the inactive archive right now" view, not a workflow/
// approval-status list like ArsipExportController).
[Route("api/permintaan-arsip/catalog")]
public class ArsipKatalogExportController : ApiControllerBase
{
    private readonly AppDbContext _db;

    private static readonly Dictionary<ArchiveKategoriEnum, string> KategoriLabel = new()
    {
        [ArchiveKategoriEnum.SOP] = "SOP",
        [ArchiveKategoriEnum.SURAT] = "Surat",
        [ArchiveKategoriEnum.KONTRAK] = "Kontrak",
        [ArchiveKategoriEnum.LAPORAN] = "Laporan",
        [ArchiveKategoriEnum.PANDUAN] = "Panduan",
        [ArchiveKategoriEnum.LAINNYA] = "Lainnya",
    };

    private static readonly (string Field, string Label)[] Columns =
    {
        ("nomor_arsip", "No Pemindahan"),
        ("tanggal", "Tanggal"),
        ("jumlah_arsip", "Jumlah"),
        ("nama_arsip", "Nama Arsip"),
        ("kategori", "Kategori"),
        ("tahun", "Tahun"),
        ("lokasi_penyimpanan", "Lokasi Penyimpanan Saat Ini"),
        ("nama_pic", "Nama PIC"),
        ("no_telepon_pic", "No. Telepon PIC"),
        ("catatan", "Catatan"),
        ("divisi", "Divisi"),
        ("departemen", "Departemen"),
        ("tanggal_disetujui", "Tanggal Disetujui"),
    };

    private static readonly float[] PdfColWidths = { 45, 28, 30, 70, 30, 24, 55, 45, 40, 55, 40, 40, 40 };

    public ArsipKatalogExportController(AppDbContext db, CurrentUserService currentUser) : base(currentUser)
    {
        _db = db;
    }

    private static object? GetFieldValue(PermintaanArsipCatalogItemOut row, string field) => field switch
    {
        "nomor_arsip" => row.NomorArsip,
        "tanggal" => row.Tanggal.ToString("yyyy-MM-dd"),
        "jumlah_arsip" => row.JumlahArsip,
        "nama_arsip" => row.NamaArsip,
        "kategori" => KategoriLabel.GetValueOrDefault(row.Kategori, row.Kategori.ToString()),
        "tahun" => row.TahunArsip,
        "nama_pic" => row.NamaPic,
        "no_telepon_pic" => row.NoTeleponPic,
        "lokasi_penyimpanan" => row.LokasiPenyimpanan,
        "divisi" => row.Divisi,
        "departemen" => row.Departemen,
        "catatan" => row.Catatan,
        "tanggal_disetujui" => row.ApprovedApprovalGaAt?.ToString("yyyy-MM-dd"),
        _ => null,
    };

    private static string Slugify(string text)
    {
        var slug = Regex.Replace(text.Trim(), "[^A-Za-z0-9]+", "-");
        return slug.Trim('-').ToLowerInvariant();
    }

    private static string BuildFilename(string? search, string? kategori, string? divisi, string? departemen, string? direktorat, string? bulan, DateOnly? tanggal)
    {
        var parts = new List<string>();
        if (!string.IsNullOrEmpty(bulan)) parts.Add(bulan);
        if (tanggal.HasValue) parts.Add(tanggal.Value.ToString("yyyy-MM-dd"));
        if (!string.IsNullOrEmpty(kategori)) parts.Add(Slugify(KategoriLabel.TryGetValue(Enum.TryParse<ArchiveKategoriEnum>(kategori, out var k) ? k : ArchiveKategoriEnum.LAINNYA, out var label) ? label : kategori));
        if (!string.IsNullOrEmpty(divisi)) parts.Add(Slugify(divisi));
        if (!string.IsNullOrEmpty(departemen)) parts.Add(Slugify(departemen));
        if (!string.IsNullOrEmpty(direktorat)) parts.Add(Slugify(direktorat));
        if (!string.IsNullOrEmpty(search)) parts.Add($"cari-{Slugify(search)}");
        return "katalog-arsip-" + (parts.Count > 0 ? string.Join("-", parts) : "semua");
    }

    private async Task<List<PermintaanArsipCatalogItemOut>> ExportRowsAsync(
        User currentUser, string? search, string? kategori, string? divisi, string? departemen, string? direktorat, string? bulan, DateOnly? tanggal)
    {
        ArchiveKategoriEnum? kategoriFilter = null;
        if (!string.IsNullOrEmpty(kategori))
        {
            if (!Enum.TryParse<ArchiveKategoriEnum>(kategori, out var parsedKategori))
                throw new ArgumentException("Kategori tidak valid");
            kategoriFilter = parsedKategori;
        }

        var requestQuery = PermintaanArsipController.ApplyListFilters(
            _db, _db.PermintaanArsips.AsQueryable(), currentUser, BookingStatusEnum.APPROVED_GA_APPROVAL, divisi, departemen, direktorat, bulan, null, false, tanggal);

        if (kategoriFilter.HasValue) requestQuery = requestQuery.Where(p => p.Kategori == kategoriFilter.Value);
        if (!string.IsNullOrEmpty(search)) requestQuery = requestQuery.Where(p => EF.Functions.ILike(p.NamaArsip, $"%{search}%"));

        return await requestQuery
            .OrderByDescending(p => p.ApprovedApprovalGaAt)
            .ThenBy(p => p.Id)
            .Select(p => new PermintaanArsipCatalogItemOut(
                p.Id, p.NomorArsip, p.Tanggal, p.JumlahArsip,
                p.NamaArsip, p.Kategori, p.TahunArsip, p.LokasiPenyimpanan,
                p.NamaPic, p.NoTeleponPic,
                p.Divisi, p.Departemen, p.Catatan,
                p.ApprovedApprovalGaAt))
            .ToListAsync();
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] string? search,
        [FromQuery] string? kategori,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery] string? direktorat,
        [FromQuery] string? bulan,
        [FromQuery] DateOnly? tanggal)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        List<PermintaanArsipCatalogItemOut> rows;
        try
        {
            rows = await ExportRowsAsync(user!, search, kategori, divisi, departemen, direktorat, bulan, tanggal);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Katalog Arsip");

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
        var filename = BuildFilename(search, kategori, divisi, departemen, direktorat, bulan, tanggal) + ".xlsx";
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    [HttpGet("export-pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] string? search,
        [FromQuery] string? kategori,
        [FromQuery] string? divisi,
        [FromQuery] string? departemen,
        [FromQuery] string? direktorat,
        [FromQuery] string? bulan,
        [FromQuery] DateOnly? tanggal)
    {
        var (user, error) = await RequireRoleExceptAsync(RoleEnum.KPU);
        if (error != null) return error;

        List<PermintaanArsipCatalogItemOut> rows;
        try
        {
            rows = await ExportRowsAsync(user!, search, kategori, divisi, departemen, direktorat, bulan, tanggal);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { detail = ex.Message });
        }

        var baseFilename = BuildFilename(search, kategori, divisi, departemen, direktorat, bulan, tanggal);

        var headerBg = "#1450C9";
        var altBg = "#F5F9FF";
        var borderColor = "#CCCCCC";

        const float noColWidth = 16f;
        const float availableWidth = 828f;
        var totalWidth = noColWidth + PdfColWidths.Sum();
        var scale = availableWidth / totalWidth;
        var colWidthsScaled = new[] { noColWidth * scale }.Concat(PdfColWidths.Select(w => w * scale)).ToArray();

        const float baseBodySize = 6.5f;
        const float baseHeaderSize = 6.7f;
        const float minBodySize = 4.5f;
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
