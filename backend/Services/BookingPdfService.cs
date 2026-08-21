using PengirimanApi.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PengirimanApi.Services;

// Single-page proof-of-booking certificate, generated on demand (not stored) once a booking has
// won its final Approval GA sign-off - see BookingRuangController.DownloadBuktiPdf.
public static class BookingPdfService
{
    private const string HeaderBg = "#1450C9";
    private const string BorderColor = "#CCCCCC";

    private static readonly (string Label, Func<BookingRuang, string> Value)[] Rows =
    {
        ("Nama Kegiatan", b => b.NamaKegiatan),
        ("PIC", b => b.Pic ?? "-"),
        ("Ruangan", b => $"{b.NamaRuang} (kapasitas {b.KapasitasRuang} orang)"),
        ("Jumlah Peserta", b => b.JumlahPeserta.ToString()),
        ("Tanggal", b => b.Tanggal.ToString("dddd, dd MMMM yyyy")),
        ("Jam", b => b.IsWholeDay ? "Sepanjang Hari" : $"{b.JamMulai:HH:mm} - {b.JamSelesai:HH:mm}"),
        ("Divisi", b => b.Divisi),
        ("Departemen", b => b.Departemen ?? "-"),
        ("Diajukan Oleh", b => b.Pembuat?.Nama ?? "-"),
        ("Catatan", b => b.Catatan ?? "-"),
        ("Status", _ => "Approved"),
        ("Disetujui Pada", b => b.ApprovedApprovalGaAt.HasValue ? b.ApprovedApprovalGaAt.Value.ToString("dd MMMM yyyy HH:mm") + " WIB" : "-"),
    };

    public static byte[] Generate(BookingRuang item)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(36);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Background(HeaderBg).Padding(16).Column(header =>
                {
                    header.Item().Text("Bukti Booking Ruang Meeting").FontColor(Colors.White).FontSize(18).Bold();
                    header.Item().Text(item.NomorPemesanan ?? "-").FontColor(Colors.White).FontSize(11);
                });

                page.Content().PaddingTop(20).Column(col =>
                {
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(150);
                            c.RelativeColumn();
                        });

                        foreach (var (label, value) in Rows)
                        {
                            table.Cell().Border(0.5f).BorderColor(BorderColor).Padding(6).Background("#F5F9FF").Text(label).Bold();
                            table.Cell().Border(0.5f).BorderColor(BorderColor).Padding(6).Text(value(item));
                        }
                    });

                    col.Item().PaddingTop(24).Text(
                        "Dokumen ini diterbitkan otomatis oleh sistem PGM Solution sebagai bukti bahwa ruang meeting di atas telah disetujui dan dikonfirmasi untuk jadwal yang tercantum."
                    ).FontSize(8.5f).FontColor("#666666");
                });

                page.Footer().AlignCenter().Text($"Dicetak {DateTime.Now:dd MMMM yyyy HH:mm}").FontSize(8).FontColor("#999999");
            });
        });

        return document.GeneratePdf();
    }
}
