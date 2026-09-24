using PengirimanApi.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PengirimanApi.Services;

// Single-page proof-of-request certificate for Archive (Permintaan Pemindahan Arsip), generated on
// demand (not stored) once a request has won its final Approval GA sign-off - mirrors
// SaranaPdfService/VehiclePdfService's layout. See PermintaanArsipController.DownloadBuktiPdf.
public static class ArsipPdfService
{
    private const string BorderColor = "#1A1A1A";
    private const string ApprovedGreen = "#1C8A43";
    private const string ExtraBoxBg = "#F5F8FC";
    private const string HeaderBg = "#CFD8E8";
    private const string AccentBlue = "#1450C9";

    private static readonly Dictionary<string, string> KategoriLabel = new()
    {
        ["SOP"] = "SOP",
        ["SURAT"] = "Surat",
        ["KONTRAK"] = "Kontrak",
        ["LAPORAN"] = "Laporan",
        ["PANDUAN"] = "Panduan",
        ["LAINNYA"] = "Lainnya",
    };

    private static byte[]? _logoBytes;

    private static byte[] LoadLogo()
    {
        if (_logoBytes != null) return _logoBytes;
        var path = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-pgm-solution.png");
        _logoBytes = File.ReadAllBytes(path);
        return _logoBytes;
    }

    // actorNames: id -> Nama untuk ApprovedByApprovalGa - di-resolve sekali oleh controller
    // sebelum memanggil ini, karena PermintaanArsip sendiri tidak punya navigation property untuk
    // FK itu (lihat model).
    public static byte[] Generate(PermintaanArsip item, Dictionary<int, string> actorNames)
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

                    col.Item().PaddingTop(8).AlignCenter().Text("BUKTI PEMINDAHAN ARSIP").Bold().FontSize(15);
                    col.Item().AlignCenter().Text(txt =>
                    {
                        txt.Span("No. Pemindahan: ").FontSize(10.5f);
                        txt.Span(item.NomorArsip ?? "-").FontSize(10.5f).Bold();
                    });

                    col.Item().PaddingTop(10).Element(c => InfoRow(c, "Tanggal", item.Tanggal.ToString("dd MMMM yyyy")));
                    col.Item().Element(c => InfoRow(c, "Kategori", KategoriLabel.GetValueOrDefault(item.Kategori.ToString(), item.Kategori.ToString())));
                    col.Item().Element(c => InfoRow(c, "Kepada", "Approval General Affair"));
                    col.Item().Element(c => InfoRow(c, "Dari", $"{item.NamaPic} - {DivisiLabel(item)}"));
                    col.Item().Element(c => InfoRow(c, "No. Telepon PIC", item.NoTeleponPic ?? "-"));

                    col.Item().PaddingTop(12).Element(c => BuildTable(c, item));

                    col.Item().PaddingTop(10).Element(c => ExtraInfoBox(c, item));

                    col.Item().PaddingTop(20).Text("Menyetujui,").Bold();
                    col.Item().Text("Approval General Affair").Bold();
                    col.Item().PaddingTop(30).Text(item.ApprovedApprovalGaAt.HasValue
                        ? $"Disetujui secara digital pada {WaktuWib.From(item.ApprovedApprovalGaAt.Value):dd MMMM yyyy HH:mm} WIB{ApprovalGaSuffix(item, actorNames)}"
                        : "-").FontSize(9).FontColor("#555555");

                    col.Item().PaddingTop(14).Text(
                        "Dokumen ini diterbitkan otomatis oleh sistem PGN Solution (GAAS) sebagai bukti bahwa pemindahan arsip di atas telah disetujui secara final. Nomor pemindahan pada dokumen ini dapat digunakan sebagai referensi verifikasi dan serah terima arsip."
                    ).FontSize(8.5f).FontColor("#666666");
                });

                page.Footer().AlignCenter().Text($"Dicetak {WaktuWib.Now:dd MMMM yyyy HH:mm} WIB").FontSize(8).FontColor("#999999");
            });
        });

        return document.GeneratePdf();
    }

    private static string ApprovalGaSuffix(PermintaanArsip item, Dictionary<int, string> actorNames)
    {
        var name = item.ApprovedByApprovalGa.HasValue ? actorNames.GetValueOrDefault(item.ApprovedByApprovalGa.Value) : null;
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

    private static void BuildTable(IContainer container, PermintaanArsip item)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.ConstantColumn(26);
                c.RelativeColumn(3f);
                c.RelativeColumn(1.4f);
                c.RelativeColumn(1.2f);
                c.RelativeColumn(2.6f);
            });

            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().AlignMiddle().Padding(5).Text("NO").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("NAMA ARSIP").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("JUMLAH ARSIP").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("TAHUN").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("LOKASI PENYIMPANAN").Bold().FontSize(9);

            table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text("1").FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(item.NamaArsip).FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text(item.JumlahArsip.ToString()).FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text(item.TahunArsip).FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(item.LokasiPenyimpanan).FontSize(9.5f);
        });
    }

    private static void ExtraInfoBox(IContainer container, PermintaanArsip item)
    {
        container.Border(1).BorderColor(BorderColor).Background(ExtraBoxBg).Padding(10).Column(col =>
        {
            col.Item().Text("INFORMASI TAMBAHAN").Bold().FontSize(9.5f).FontColor(AccentBlue);
            col.Item().PaddingTop(6).Element(c => ExtraGrid(c, item));
        });
    }

    private static void ExtraGrid(IContainer container, PermintaanArsip item)
    {
        var pairs = new (string Label, string Value)[]
        {
            ("Divisi / Departemen", DivisiLabel(item)),
            ("Status", "Approved"),
            ("Catatan", string.IsNullOrWhiteSpace(item.Catatan) ? "-" : item.Catatan),
            ("Diajukan Pada", WaktuWib.Panjang(item.CreatedAt)),
            ("Disetujui Pada", WaktuWib.Panjang(item.ApprovedApprovalGaAt)),
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

    private static string DivisiLabel(PermintaanArsip item)
        => string.IsNullOrEmpty(item.Departemen) ? item.Divisi : $"{item.Divisi} / {item.Departemen}";
}
