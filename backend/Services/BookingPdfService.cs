using PengirimanApi.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PengirimanApi.Services;

// Single-page proof-of-booking certificate, generated on demand (not stored) once a booking has
// won its final Approval GA sign-off - see BookingRuangController.DownloadBuktiPdf. Layout mirrors
// the company's own FPFK (Formulir Permintaan Fasilitas Kantor) paper form so the printout reads
// as a familiar internal document, plus an extra status/approval box since - unlike the FPFK,
// which proves a request was submitted - this document proves a request was already approved.
public static class BookingPdfService
{
    private const string BorderColor = "#1A1A1A";
    private const string ApprovedGreen = "#1C8A43";
    private const string ExtraBoxBg = "#F5F8FC";
    private const string HeaderBg = "#CFD8E8";
    private const string AccentBlue = "#1450C9";

    private static readonly Dictionary<string, string> RecurrenceFrequencyLabel = new()
    {
        ["DAILY"] = "Harian",
        ["WEEKLY"] = "Mingguan",
        ["MONTHLY"] = "Bulanan",
    };

    private static byte[]? _logoBytes;

    private static byte[] LoadLogo()
    {
        if (_logoBytes != null) return _logoBytes;
        var path = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-pgm-solution.png");
        _logoBytes = File.ReadAllBytes(path);
        return _logoBytes;
    }

    public static byte[] Generate(BookingRuang item)
    {
        var logo = LoadLogo();

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                // Explicit Arial (not QuestPDF's own default font) - the default was silently
                // dropping every "ti" letter pair in small-size text (e.g. "bukti" -> "buk",
                // "meeting" -> "meeng") when the PDF's text layer was copied out, a broken
                // ligature/ToUnicode mapping in that font. Arial has no such ligature table.
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

                    col.Item().PaddingTop(8).AlignCenter().Text("BUKTI BOOKING RUANG MEETING").Bold().FontSize(15);
                    col.Item().AlignCenter().Text(txt =>
                    {
                        txt.Span("No. Pemesanan: ").FontSize(10.5f);
                        txt.Span(item.NomorPemesanan ?? "-").FontSize(10.5f).Bold();
                    });

                    col.Item().PaddingTop(10).Element(c => InfoRow(c, "Tanggal Permintaan", item.CreatedAt.ToString("dd MMMM yyyy")));
                    col.Item().Element(c => InfoRow(c, "Kepada", "Approval General Affair"));
                    col.Item().Element(c => InfoRow(c, "Dari", $"{item.Pembuat?.Nama ?? "-"} - {DivisiLabel(item)}"));

                    col.Item().PaddingTop(8).Element(PerihalRow);

                    col.Item().PaddingTop(8).Element(AnggaranRow);
                    col.Item().Element(c => InfoRow(c, "Tanggal Perkiraan Kebutuhan", item.Tanggal.ToString("dd MMMM yyyy")));
                    col.Item().Element(c => InfoRow(c, "Lampiran", "-"));

                    col.Item().PaddingTop(12).Element(c => BuildTable(c, item));

                    col.Item().PaddingTop(10).Element(c => ExtraInfoBox(c, item));

                    col.Item().PaddingTop(20).Text("Menyetujui,").Bold();
                    col.Item().Text("Approval General Affair").Bold();
                    col.Item().PaddingTop(30).Text(item.ApprovedApprovalGaAt.HasValue
                        ? $"Disetujui secara digital pada {item.ApprovedApprovalGaAt.Value:dd MMMM yyyy HH:mm} WIB"
                        : "-").FontSize(9).FontColor("#555555");

                    col.Item().PaddingTop(14).Text(
                        "Dokumen ini diterbitkan otomatis oleh sistem PGN Solution (GAAS) sebagai bukti bahwa ruang meeting di atas telah disetujui dan dikonfirmasi untuk jadwal yang tercantum. Nomor pemesanan pada dokumen ini dapat digunakan sebagai referensi verifikasi."
                    ).FontSize(8.5f).FontColor("#666666");
                });

                page.Footer().AlignCenter().Text($"Dicetak {DateTime.Now:dd MMMM yyyy HH:mm}").FontSize(8).FontColor("#999999");
            });
        });

        return document.GeneratePdf();
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

    private static void PerihalRow(IContainer container)
    {
        container.Row(row =>
        {
            row.ConstantItem(155).Text("Perihal").FontSize(10);
            row.ConstantItem(12);
            row.RelativeItem().Column(inner =>
            {
                inner.Spacing(2);
                inner.Item().Element(c => CheckboxLine(c, "Penyediaan", false));
                inner.Item().Element(c => CheckboxLine(c, "Peminjaman", true));
                inner.Item().Element(c => CheckboxLine(c, "Perbaikan", false));
            });
        });
    }

    private static void AnggaranRow(IContainer container)
    {
        container.Row(row =>
        {
            row.ConstantItem(155).Text("Ketersediaan Anggaran").FontSize(10);
            row.ConstantItem(12).Text(":").FontSize(10);
            row.RelativeItem().Row(inner =>
            {
                inner.AutoItem().Element(c => CheckboxLine(c, "Ada", false));
                inner.ConstantItem(24);
                inner.AutoItem().Element(c => CheckboxLine(c, "Tidak Ada", true));
            });
        });
    }

    private static void CheckboxLine(IContainer container, string label, bool isChecked)
    {
        container.Row(row =>
        {
            row.ConstantItem(14).Height(14).Border(1).BorderColor(BorderColor)
                .Background(isChecked ? "#EEF2FB" : Colors.White)
                .AlignMiddle().AlignCenter()
                .Text(isChecked ? "v" : "").FontSize(9).Bold();
            row.ConstantItem(6);
            row.AutoItem().Text(label).FontSize(10);
        });
    }

    private static void BuildTable(IContainer container, BookingRuang item)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.ConstantColumn(26);
                c.RelativeColumn(2.1f);
                c.ConstantColumn(58);
                c.ConstantColumn(58);
                c.RelativeColumn(2.2f);
                c.RelativeColumn(1.6f);
            });

            table.Cell().RowSpan(2).Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().AlignMiddle().Padding(5).Text("NO").Bold().FontSize(9);
            table.Cell().RowSpan(2).Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().AlignMiddle().Padding(5).Text("URAIAN").Bold().FontSize(9);
            table.Cell().ColumnSpan(2).Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().Padding(5).Text("JUMLAH YANG DIMINTA").Bold().FontSize(9);
            table.Cell().RowSpan(2).Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().AlignMiddle().Padding(5).Text("LOKASI / TUJUAN KEBUTUHAN").Bold().FontSize(9);
            table.Cell().RowSpan(2).Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().AlignMiddle().Padding(5).Text("KETERANGAN").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().Padding(5).Text("VOLUME").Bold().FontSize(8.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().Padding(5).Text("SATUAN").Bold().FontSize(8.5f);

            table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text("1").FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(item.NamaKegiatan).FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text("1").FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text("Ruangan").FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(RoomsLabel(item)).FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(JamLabel(item)).FontSize(9.5f);
        });
    }

    private static void ExtraInfoBox(IContainer container, BookingRuang item)
    {
        container.Border(1).BorderColor(BorderColor).Background(ExtraBoxBg).Padding(10).Column(col =>
        {
            col.Item().Text("INFORMASI TAMBAHAN").Bold().FontSize(9.5f).FontColor(AccentBlue);
            col.Item().PaddingTop(6).Element(c => ExtraGrid(c, item));
        });
    }

    private static void ExtraGrid(IContainer container, BookingRuang item)
    {
        var pairs = new (string Label, string Value)[]
        {
            ("Tipe Booking", item.Tipe == TipeBookingEnum.EXTERNAL ? "External" : "Internal"),
            ("Jumlah Peserta", $"{item.JumlahPeserta} orang"),
            ("PIC", item.Pic ?? "-"),
            ("Divisi / Departemen", DivisiLabel(item)),
            ("Pengulangan", RecurrenceLabel(item)),
            ("Status", "Approved"),
            ("Diajukan Pada", item.CreatedAt.ToString("dd MMMM yyyy HH:mm") + " WIB"),
            ("Disetujui Pada", item.ApprovedApprovalGaAt.HasValue ? item.ApprovedApprovalGaAt.Value.ToString("dd MMMM yyyy HH:mm") + " WIB" : "-"),
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

    private static string DivisiLabel(BookingRuang item)
        => string.IsNullOrEmpty(item.Departemen) ? item.Divisi : $"{item.Divisi} / {item.Departemen}";

    private static string RecurrenceLabel(BookingRuang item)
    {
        if (item.SeriesId == null || item.RecurrenceFrequency == null) return "Tidak Berulang";
        var freq = RecurrenceFrequencyLabel.GetValueOrDefault(item.RecurrenceFrequency.Value.ToString(), item.RecurrenceFrequency.Value.ToString());
        var until = item.RecurrenceEndDate.HasValue ? $" s/d {item.RecurrenceEndDate.Value:dd MMMM yyyy}" : "";
        return $"{freq}{until}";
    }

    private static string RoomsLabel(BookingRuang item)
    {
        var rooms = new List<string> { item.NamaRuang };
        rooms.AddRange(item.AdditionalRooms.Select(r => r.NamaRuang));
        return string.Join(", ", rooms);
    }

    private static string JamLabel(BookingRuang item)
        => item.IsWholeDay ? "Sepanjang Hari" : $"Pukul {item.JamMulai:HH:mm} s.d {item.JamSelesai:HH:mm} WIB";
}
