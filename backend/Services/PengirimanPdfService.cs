using PengirimanApi.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PengirimanApi.Services;

// Single-page proof-of-shipment certificate for Expedition (Pengiriman), generated on demand (not
// stored) once a shipment has won its final Mitra sign-off - mirrors AtkPdfService/
// SaranaPdfService's layout. See PengirimanController.DownloadBuktiPdf.
public static class PengirimanPdfService
{
    private const string BorderColor = "#1A1A1A";
    private const string ApprovedGreen = "#1C8A43";
    private const string ExtraBoxBg = "#F5F8FC";
    private const string HeaderBg = "#CFD8E8";
    private const string AccentBlue = "#1450C9";

    private static byte[]? _logoBytes;

    private static byte[] LoadLogo()
    {
        if (_logoBytes != null) return _logoBytes;
        var path = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-pgm-solution.png");
        _logoBytes = File.ReadAllBytes(path);
        return _logoBytes;
    }

    // actorNames: id -> Nama untuk ApprovedByKpu - di-resolve sekali oleh controller sebelum
    // memanggil ini, karena Pengiriman sendiri tidak punya navigation property untuk FK itu (lihat
    // model).
    public static byte[] Generate(Pengiriman item, Dictionary<int, string> actorNames)
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

                    col.Item().PaddingTop(8).AlignCenter().Text("BUKTI PENGIRIMAN BARANG").Bold().FontSize(15);
                    col.Item().AlignCenter().Text(txt =>
                    {
                        txt.Span("No. Transmittal: ").FontSize(10.5f);
                        txt.Span(item.NomorTransmittal).FontSize(10.5f).Bold();
                    });

                    col.Item().PaddingTop(10).Element(c => InfoRow(c, "Tanggal", item.Tanggal.ToString("dd MMMM yyyy")));
                    col.Item().Element(c => InfoRow(c, "No. Resi", item.NoResi ?? "-"));
                    col.Item().Element(c => InfoRow(c, "Kode Program", item.KodeProgram));
                    col.Item().Element(c => InfoRow(c, "Kepada", "Mitra"));
                    col.Item().Element(c => InfoRow(c, "Dari", $"{item.NamaPengirim} - {DivisiLabel(item)}"));
                    col.Item().Element(c => InfoRow(c, "No. Telepon Pengirim", item.NoTeleponPengirim));
                    col.Item().Element(c => InfoRow(c, "Alamat Pengirim", item.AlamatPengirim));

                    col.Item().PaddingTop(12).Element(c => BuildTable(c, item));

                    col.Item().PaddingTop(10).Element(c => ExtraInfoBox(c, item));

                    col.Item().PaddingTop(20).Text("Menyetujui,").Bold();
                    col.Item().Text("Mitra").Bold();
                    col.Item().PaddingTop(30).Text(item.ApprovedKpuAt.HasValue
                        ? $"Disetujui secara digital pada {WaktuWib.From(item.ApprovedKpuAt.Value):dd MMMM yyyy HH:mm} WIB{KpuSuffix(item, actorNames)}"
                        : "-").FontSize(9).FontColor("#555555");

                    col.Item().PaddingTop(14).Text(
                        "Dokumen ini diterbitkan otomatis oleh sistem PGN Solution (GAAS) sebagai bukti bahwa pengiriman barang di atas telah disetujui secara final. Nomor transmittal pada dokumen ini dapat digunakan sebagai referensi verifikasi dan serah terima barang."
                    ).FontSize(8.5f).FontColor("#666666");
                });

                page.Footer().AlignCenter().Text($"Dicetak {WaktuWib.Now:dd MMMM yyyy HH:mm} WIB").FontSize(8).FontColor("#999999");
            });
        });

        return document.GeneratePdf();
    }

    private static string KpuSuffix(Pengiriman item, Dictionary<int, string> actorNames)
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

    private static void BuildTable(IContainer container, Pengiriman item)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.ConstantColumn(26);
                c.RelativeColumn(2.2f);
                c.RelativeColumn(3.4f);
                c.RelativeColumn(2f);
            });

            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().AlignMiddle().Padding(5).Text("NO").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("NAMA PENERIMA").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("ALAMAT PENERIMA").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("NO. TELEPON PENERIMA").Bold().FontSize(9);

            table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text("1").FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(item.NamaPenerima).FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(item.AlamatPenerima).FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(item.NoTeleponPenerima).FontSize(9.5f);
        });
    }

    private static void ExtraInfoBox(IContainer container, Pengiriman item)
    {
        container.Border(1).BorderColor(BorderColor).Background(ExtraBoxBg).Padding(10).Column(col =>
        {
            col.Item().Text("INFORMASI TAMBAHAN").Bold().FontSize(9.5f).FontColor(AccentBlue);
            col.Item().PaddingTop(6).Element(c => ExtraGrid(c, item));
        });
    }

    private static void ExtraGrid(IContainer container, Pengiriman item)
    {
        var pairs = new (string Label, string Value)[]
        {
            ("Divisi / Departemen", DivisiLabel(item)),
            ("Status", "Approved"),
            ("Tujuan Penerimaan", item.TujuanPenerimaan),
            ("Jumlah Item", item.JumlahItem.ToString()),
            ("Berat Barang", item.BeratBarangKg.HasValue ? $"{item.BeratBarangKg} Kg" : "-"),
            ("Asuransi", item.AsuransiStatus == AsuransiEnum.Ya
                ? $"Ya - Rp {item.AsuransiHarga:N0}"
                : "Tidak"),
            ("Request Packing", item.RequestPacking),
            ("Ongkos Kirim", item.SubTotal.HasValue ? $"Rp {item.SubTotal:N0}" : "-"),
            ("Total", item.Total.HasValue ? $"Rp {item.Total:N0}" : "-"),
            ("Catatan", string.IsNullOrWhiteSpace(item.Catatan) ? "-" : item.Catatan),
            ("Diajukan Pada", WaktuWib.Panjang(item.CreatedAt)),
            ("Disetujui Pada", WaktuWib.Panjang(item.ApprovedKpuAt)),
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

    private static string DivisiLabel(Pengiriman item)
        => string.IsNullOrEmpty(item.Departemen) ? item.Divisi : $"{item.Divisi} / {item.Departemen}";
}
