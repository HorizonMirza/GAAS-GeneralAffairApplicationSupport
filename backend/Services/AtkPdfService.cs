using PengirimanApi.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PengirimanApi.Services;

// Single-page proof-of-request certificate for Office Supplies (Permintaan ATK), generated on
// demand (not stored) once a request has won its final Mitra sign-off - mirrors
// SaranaPdfService/VehiclePdfService's layout, plus a multi-row item table since one request can
// carry many barang (unlike those single-entity modules). See
// PermintaanAtkController.DownloadBuktiPdf.
public static class AtkPdfService
{
    private const string BorderColor = "#1A1A1A";
    private const string ApprovedGreen = "#1C8A43";
    private const string ExtraBoxBg = "#F5F8FC";
    private const string HeaderBg = "#CFD8E8";
    private const string AccentBlue = "#1450C9";

    private static readonly Dictionary<string, string> SumberPembelianLabel = new()
    {
        ["KPU"] = "KPU",
        ["PADI"] = "PaDi (Eksternal)",
    };

    private static byte[]? _logoBytes;

    private static byte[] LoadLogo()
    {
        if (_logoBytes != null) return _logoBytes;
        var path = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-pgm-solution.png");
        _logoBytes = File.ReadAllBytes(path);
        return _logoBytes;
    }

    // actorNames: id -> Nama untuk ApprovedByKpu - di-resolve sekali oleh controller sebelum
    // memanggil ini, karena PermintaanAtk sendiri tidak punya navigation property untuk FK itu
    // (lihat model).
    public static byte[] Generate(PermintaanAtk item, Dictionary<int, string> actorNames)
    {
        var logo = LoadLogo();

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily(Fonts.Arial));

                page.Content().Column(col =>
                {
                    col.Spacing(4);

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Height(38).Image(logo).FitArea();
                        row.ConstantItem(100).AlignRight().AlignMiddle()
                            .Border(1.5f).BorderColor(ApprovedGreen).Padding(6)
                            .Text("APPROVED").FontColor(ApprovedGreen).Bold().FontSize(11);
                    });

                    col.Item().PaddingTop(8).AlignCenter().Text("BUKTI PERMINTAAN ATK").Bold().FontSize(15);
                    col.Item().AlignCenter().Text(txt =>
                    {
                        txt.Span("No. Permintaan: ").FontSize(10.5f);
                        txt.Span(item.NomorPermintaan ?? "-").FontSize(10.5f).Bold();
                    });

                    col.Item().PaddingTop(10).Element(c => InfoRow(c, "Tanggal Dibutuhkan", item.Tanggal.ToString("dd MMMM yyyy")));
                    col.Item().Element(c => InfoRow(c, "Kepada", "Mitra"));
                    col.Item().Element(c => InfoRow(c, "Dari", $"{item.NamaPemohon} - {DivisiLabel(item)}"));
                    col.Item().Element(c => InfoRow(c, "No. Telepon Pemohon", item.NoTeleponPemohon));
                    col.Item().Element(c => InfoRow(c, "Tujuan", item.Keperluan));

                    col.Item().PaddingTop(12).Element(c => BuildTable(c, item));

                    col.Item().PaddingTop(10).Element(c => ExtraInfoBox(c, item));

                    col.Item().PaddingTop(20).Text("Menyetujui,").Bold();
                    col.Item().Text("Mitra").Bold();
                    col.Item().PaddingTop(30).Text(item.ApprovedKpuAt.HasValue
                        ? $"Disetujui secara digital pada {item.ApprovedKpuAt.Value:dd MMMM yyyy HH:mm} WIB{KpuSuffix(item, actorNames)}"
                        : "-").FontSize(9).FontColor("#555555");

                    col.Item().PaddingTop(14).Text(
                        "Dokumen ini diterbitkan otomatis oleh sistem PGN Solution (GAAS) sebagai bukti bahwa permintaan ATK di atas telah disetujui secara final. Nomor permintaan pada dokumen ini dapat digunakan sebagai referensi verifikasi dan serah terima barang."
                    ).FontSize(8.5f).FontColor("#666666");
                });

                page.Footer().AlignCenter().Text($"Dicetak {DateTime.Now:dd MMMM yyyy HH:mm}").FontSize(8).FontColor("#999999");
            });
        });

        return document.GeneratePdf();
    }

    private static string KpuSuffix(PermintaanAtk item, Dictionary<int, string> actorNames)
    {
        var name = item.ApprovedByKpu.HasValue ? actorNames.GetValueOrDefault(item.ApprovedByKpu.Value) : null;
        return string.IsNullOrEmpty(name) ? "" : $" oleh {name}";
    }

    private static void InfoRow(IContainer container, string label, string value)
    {
        container.Row(row =>
        {
            row.ConstantItem(155).Text(label).FontSize(10);
            row.ConstantItem(12).Text(":").FontSize(10);
            row.RelativeItem().Text(value).FontSize(10);
        });
    }

    private static void BuildTable(IContainer container, PermintaanAtk item)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.ConstantColumn(26);
                c.RelativeColumn(4f);
                c.RelativeColumn(1.6f);
                c.RelativeColumn(1.6f);
            });

            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().AlignMiddle().Padding(5).Text("NO").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("NAMA BARANG").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("JUMLAH").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("SATUAN").Bold().FontSize(9);

            var no = 0;
            foreach (var row in item.Items.OrderBy(i => i.Id))
            {
                no++;
                table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text(no.ToString()).FontSize(9.5f);
                table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(row.NamaBarang).FontSize(9.5f);
                table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text(row.Jumlah.ToString()).FontSize(9.5f);
                table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(row.Satuan).FontSize(9.5f);
            }
        });
    }

    private static void ExtraInfoBox(IContainer container, PermintaanAtk item)
    {
        container.Border(1).BorderColor(BorderColor).Background(ExtraBoxBg).Padding(10).Column(col =>
        {
            col.Item().Text("INFORMASI TAMBAHAN").Bold().FontSize(9.5f).FontColor(AccentBlue);
            col.Item().PaddingTop(6).Element(c => ExtraGrid(c, item));
        });
    }

    private static void ExtraGrid(IContainer container, PermintaanAtk item)
    {
        var pairs = new (string Label, string Value)[]
        {
            ("Divisi / Departemen", DivisiLabel(item)),
            ("Status", "Approved"),
            ("Sumber Pembelian", item.SumberPembelian.HasValue ? SumberPembelianLabel.GetValueOrDefault(item.SumberPembelian.Value.ToString(), item.SumberPembelian.Value.ToString()) : "-"),
            ("Diajukan Pada", item.CreatedAt.ToString("dd MMMM yyyy HH:mm") + " WIB"),
            ("Disetujui Pada", item.ApprovedKpuAt.HasValue ? item.ApprovedKpuAt.Value.ToString("dd MMMM yyyy HH:mm") + " WIB" : "-"),
        };

        container.Column(col =>
        {
            col.Spacing(4);
            foreach (var (label, value) in pairs)
            {
                col.Item().Row(row =>
                {
                    row.ConstantItem(150).Text(label).FontSize(9.5f);
                    row.RelativeItem().Text(value).FontSize(9.5f).Bold();
                });
            }
        });
    }

    private static string DivisiLabel(PermintaanAtk item)
        => string.IsNullOrEmpty(item.Departemen) ? item.Divisi : $"{item.Divisi} / {item.Departemen}";
}
