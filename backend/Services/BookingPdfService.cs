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
    private const string SectionBg = "#E8EFFC";
    private const string LabelBg = "#F5F9FF";
    private const string BorderColor = "#CCCCCC";

    private static readonly Dictionary<string, string> RecurrenceFrequencyLabel = new()
    {
        ["DAILY"] = "Harian",
        ["WEEKLY"] = "Mingguan",
        ["MONTHLY"] = "Bulanan",
    };

    // Value returning null skips that row entirely - used for fields that only apply to some
    // bookings (a second room, a recurring series) so a plain one-off booking's proof doesn't
    // show a run of empty "-" rows for things that were never relevant to it.
    private static readonly (string Section, (string Label, Func<BookingRuang, string?> Value)[] Rows)[] Groups =
    {
        ("Informasi Kegiatan", new (string, Func<BookingRuang, string?>)[]
        {
            ("Nama Kegiatan", b => b.NamaKegiatan),
            ("PIC", b => b.Pic ?? "-"),
            ("Tipe", b => b.Tipe == TipeBookingEnum.EXTERNAL ? "External" : "Internal"),
            ("Divisi", b => b.Divisi),
            ("Departemen", b => b.Departemen ?? "-"),
        }),
        ("Jadwal & Ruangan", new (string, Func<BookingRuang, string?>)[]
        {
            ("Ruangan", b => $"{b.NamaRuang} (kapasitas {b.KapasitasRuang} orang)"),
            ("Ruangan Tambahan", b => b.AdditionalRooms.Count == 0 ? null : string.Join(", ", b.AdditionalRooms.Select(r => r.NamaRuang))),
            ("Tanggal", b => b.Tanggal.ToString("dddd, dd MMMM yyyy")),
            ("Jam", b => b.IsWholeDay ? "Sepanjang Hari" : $"{b.JamMulai:HH:mm} - {b.JamSelesai:HH:mm}"),
            ("Pengulangan", b =>
            {
                if (b.SeriesId == null || b.RecurrenceFrequency == null) return null;
                var freq = RecurrenceFrequencyLabel.GetValueOrDefault(b.RecurrenceFrequency.Value.ToString(), b.RecurrenceFrequency.Value.ToString());
                var until = b.RecurrenceEndDate.HasValue ? $" s/d {b.RecurrenceEndDate.Value:dd MMMM yyyy}" : "";
                return $"{freq}{until}";
            }),
            ("Jumlah Peserta", b => $"{b.JumlahPeserta} orang"),
        }),
        ("Approval", new (string, Func<BookingRuang, string?>)[]
        {
            ("Diajukan Oleh", b => b.Pembuat?.Nama ?? "-"),
            ("Diajukan Pada", b => b.CreatedAt.ToString("dd MMMM yyyy HH:mm") + " WIB"),
            ("Status", _ => "Approved"),
            ("Disetujui Pada", b => b.ApprovedApprovalGaAt.HasValue ? b.ApprovedApprovalGaAt.Value.ToString("dd MMMM yyyy HH:mm") + " WIB" : "-"),
        }),
        ("Catatan", new (string, Func<BookingRuang, string?>)[]
        {
            ("Catatan", b => b.Catatan ?? "-"),
        }),
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
                    col.Spacing(12);

                    foreach (var (section, rows) in Groups)
                    {
                        var visibleRows = rows.Where(r => r.Value(item) != null).ToArray();
                        if (visibleRows.Length == 0) continue;

                        col.Item().Column(group =>
                        {
                            group.Item().Background(SectionBg).Padding(6).Text(section).Bold().FontSize(10.5f).FontColor(HeaderBg);
                            group.Item().Table(table =>
                            {
                                table.ColumnsDefinition(c =>
                                {
                                    c.ConstantColumn(150);
                                    c.RelativeColumn();
                                });

                                foreach (var (label, value) in visibleRows)
                                {
                                    table.Cell().Border(0.5f).BorderColor(BorderColor).Padding(6).Background(LabelBg).Text(label).Bold();
                                    table.Cell().Border(0.5f).BorderColor(BorderColor).Padding(6).Text(value(item)!);
                                }
                            });
                        });
                    }

                    col.Item().PaddingTop(12).Text(
                        "Dokumen ini diterbitkan otomatis oleh sistem PGM Solution sebagai bukti bahwa ruang meeting di atas telah disetujui dan dikonfirmasi untuk jadwal yang tercantum."
                    ).FontSize(8.5f).FontColor("#666666");
                });

                page.Footer().AlignCenter().Text($"Dicetak {DateTime.Now:dd MMMM yyyy HH:mm}").FontSize(8).FontColor("#999999");
            });
        });

        return document.GeneratePdf();
    }
}
