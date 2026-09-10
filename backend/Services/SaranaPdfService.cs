using PengirimanApi.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PengirimanApi.Services;

// Single-page proof-of-repair-report certificate for Maintenance (Perbaikan Sarana), generated on
// demand (not stored) once a report has won its final Approval GA sign-off - mirrors
// VehiclePdfService/BookingPdfService's layout, plus a physical-execution section (Cek Lokasi ->
// Gambar Rencana -> Selesai) since that sub-workflow is unique to this module. See
// PerbaikanSaranaController.DownloadBuktiPdf.
public static class SaranaPdfService
{
    private const string BorderColor = "#1A1A1A";
    private const string ApprovedGreen = "#1C8A43";
    private const string ExtraBoxBg = "#F5F8FC";
    private const string HeaderBg = "#CFD8E8";
    private const string AccentBlue = "#1450C9";

    private static readonly Dictionary<string, string> KategoriLabel = new()
    {
        ["AC"] = "AC / Pendingin",
        ["LISTRIK"] = "Listrik",
        ["AIR"] = "Air / Saluran",
        ["FURNITUR"] = "Furnitur",
        ["GEDUNG"] = "Gedung / Bangunan",
        ["IT"] = "IT / Jaringan",
        ["LAINNYA"] = "Lainnya",
    };

    // Matches frontend's EXECUTION_STAGE_LABEL (lib/constants.ts) word-for-word.
    private static readonly Dictionary<string, string> ExecutionStageLabel = new()
    {
        ["MENUNGGU"] = "Menunggu Eksekusi",
        ["LOKASI_DICEK"] = "Lokasi Dicek",
        ["GAMBAR_DIBUAT"] = "Gambar Dibuat",
        ["SELESAI"] = "Selesai Dieksekusi",
    };

    private static byte[]? _logoBytes;

    private static byte[] LoadLogo()
    {
        if (_logoBytes != null) return _logoBytes;
        var path = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-pgm-solution.png");
        _logoBytes = File.ReadAllBytes(path);
        return _logoBytes;
    }

    // actorNames: id -> Nama untuk LokasiDicekBy/GambarDibuatBy/SelesaiBy/ApprovedByApprovalGa -
    // di-resolve sekali oleh controller sebelum memanggil ini, karena PerbaikanSarana sendiri tidak
    // punya navigation property untuk FK-FK itu (lihat model).
    public static byte[] Generate(PerbaikanSarana item, Dictionary<int, string> actorNames)
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

                    col.Item().PaddingTop(8).AlignCenter().Text("BUKTI LAPORAN PERBAIKAN SARANA").Bold().FontSize(15);
                    col.Item().AlignCenter().Text(txt =>
                    {
                        txt.Span("No. Laporan: ").FontSize(10.5f);
                        txt.Span(item.NomorPerbaikan ?? "-").FontSize(10.5f).Bold();
                    });

                    col.Item().PaddingTop(10).Element(c => InfoRow(c, "Tanggal Laporan", item.Tanggal.ToString("dd MMMM yyyy")));
                    col.Item().Element(c => InfoRow(c, "Kepada", "Approval General Affair"));
                    col.Item().Element(c => InfoRow(c, "Dari", $"{item.NamaPelapor} - {DivisiLabel(item)}"));
                    col.Item().Element(c => InfoRow(c, "No. Telepon Pelapor", item.NoTeleponPelapor));

                    col.Item().PaddingTop(12).Element(c => BuildTable(c, item));

                    col.Item().PaddingTop(10).Element(c => ExtraInfoBox(c, item, actorNames));

                    col.Item().PaddingTop(20).Text("Menyetujui,").Bold();
                    col.Item().Text("Approval General Affair").Bold();
                    col.Item().PaddingTop(30).Text(item.ApprovedApprovalGaAt.HasValue
                        ? $"Disetujui secara digital pada {item.ApprovedApprovalGaAt.Value:dd MMMM yyyy HH:mm} WIB{ApprovalGaSuffix(item, actorNames)}"
                        : "-").FontSize(9).FontColor("#555555");

                    col.Item().PaddingTop(14).Text(
                        "Dokumen ini diterbitkan otomatis oleh sistem PGN Solution (GAAS) sebagai bukti bahwa laporan perbaikan di atas telah disetujui secara final. Nomor laporan pada dokumen ini dapat digunakan sebagai referensi verifikasi dan serah terima pekerjaan."
                    ).FontSize(8.5f).FontColor("#666666");
                });

                page.Footer().AlignCenter().Text($"Dicetak {DateTime.Now:dd MMMM yyyy HH:mm}").FontSize(8).FontColor("#999999");
            });
        });

        return document.GeneratePdf();
    }

    private static string ApprovalGaSuffix(PerbaikanSarana item, Dictionary<int, string> actorNames)
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

    private static void BuildTable(IContainer container, PerbaikanSarana item)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.ConstantColumn(26);
                c.RelativeColumn(2.4f);
                c.RelativeColumn(1.6f);
                c.RelativeColumn(3.6f);
            });

            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignCenter().AlignMiddle().Padding(5).Text("NO").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("LOKASI").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("KATEGORI").Bold().FontSize(9);
            table.Cell().Border(1).BorderColor(BorderColor).Background(HeaderBg).AlignMiddle().Padding(5).Text("DESKRIPSI KERUSAKAN").Bold().FontSize(9);

            table.Cell().Border(1).BorderColor(BorderColor).AlignCenter().Padding(5).Text("1").FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(item.Lokasi).FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(KategoriLabel.GetValueOrDefault(item.Kategori.ToString(), item.Kategori.ToString())).FontSize(9.5f);
            table.Cell().Border(1).BorderColor(BorderColor).Padding(5).Text(item.DeskripsiKerusakan).FontSize(9.5f);
        });
    }

    private static void ExtraInfoBox(IContainer container, PerbaikanSarana item, Dictionary<int, string> actorNames)
    {
        container.Border(1).BorderColor(BorderColor).Background(ExtraBoxBg).Padding(10).Column(col =>
        {
            col.Item().Text("INFORMASI TAMBAHAN").Bold().FontSize(9.5f).FontColor(AccentBlue);
            col.Item().PaddingTop(6).Element(c => ExtraGrid(c, item));

            col.Item().PaddingTop(10).Text("STATUS EKSEKUSI FISIK").Bold().FontSize(9.5f).FontColor(AccentBlue);
            col.Item().PaddingTop(6).Element(c => ExecutionGrid(c, item, actorNames));
        });
    }

    private static void ExtraGrid(IContainer container, PerbaikanSarana item)
    {
        var pairs = new (string Label, string Value)[]
        {
            ("Divisi / Departemen", DivisiLabel(item)),
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

    private static void ExecutionGrid(IContainer container, PerbaikanSarana item, Dictionary<int, string> actorNames)
    {
        string ActorAndTime(int? actorId, DateTime? at) =>
            actorId.HasValue && at.HasValue
                ? $"{actorNames.GetValueOrDefault(actorId.Value, "-")} - {at.Value:dd MMMM yyyy HH:mm} WIB"
                : "-";

        var pairs = new (string Label, string Value)[]
        {
            ("Tahap Saat Ini", ExecutionStageLabel.GetValueOrDefault(item.ExecutionStage.ToString(), item.ExecutionStage.ToString())),
            ("Lokasi Dicek Oleh", ActorAndTime(item.LokasiDicekBy, item.LokasiDicekAt)),
            ("Gambar Rencana Dibuat Oleh", ActorAndTime(item.GambarDibuatBy, item.GambarDibuatAt)),
            ("Eksekusi Selesai Oleh", ActorAndTime(item.SelesaiBy, item.SelesaiAt)),
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

    private static string DivisiLabel(PerbaikanSarana item)
        => string.IsNullOrEmpty(item.Departemen) ? item.Divisi : $"{item.Divisi} / {item.Departemen}";
}
