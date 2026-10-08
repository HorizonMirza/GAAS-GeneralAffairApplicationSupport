using QuestPDF.Fluent;
using QuestPDF.Helpers;

namespace PengirimanApi.Services;

public static class InvoiceFallbackPdfHelper
{
    public static void EnsureFallbackPdf(string path, string title, string subtitle, string filename)
    {
        if (File.Exists(path)) return;

        try
        {
            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(36);
                    page.DefaultTextStyle(x => x.FontSize(11).FontFamily("Arial"));

                    page.Header().Column(col =>
                    {
                        col.Item().Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("PT PGAS SOLUTION").FontSize(16).Bold().FontColor("#10275a");
                                c.Item().Text("General Affair Application Support (GAAS)").FontSize(10).FontColor("#4a5b7a");
                            });
                            row.ConstantItem(120).AlignRight().Text("ARSIP DIGITAL").FontSize(11).Bold().FontColor("#1c6dff");
                        });
                        col.Item().PaddingTop(10).LineHorizontal(1.5f).LineColor("#1c6dff");
                    });

                    page.Content().PaddingTop(30).Column(col =>
                    {
                        col.Item().Background("#f1f5f9").Padding(16).Column(c =>
                        {
                            c.Item().Text(title).FontSize(14).Bold().FontColor("#0b1a33");
                            c.Item().Text(subtitle).FontSize(11).FontColor("#4a5b7a");
                        });

                        col.Item().PaddingTop(24).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.ConstantColumn(160);
                                columns.RelativeColumn();
                            });

                            table.Cell().BorderBottom(1).BorderColor("#e2e8f0").Padding(8).Text("Nama File").Bold();
                            table.Cell().BorderBottom(1).BorderColor("#e2e8f0").Padding(8).Text(filename);

                            table.Cell().BorderBottom(1).BorderColor("#e2e8f0").Padding(8).Text("Status Dokumen").Bold();
                            table.Cell().BorderBottom(1).BorderColor("#e2e8f0").Padding(8).Text("Tersimpan dalam Sistem GAAS");

                            table.Cell().BorderBottom(1).BorderColor("#e2e8f0").Padding(8).Text("Tanggal Akses").Bold();
                            table.Cell().BorderBottom(1).BorderColor("#e2e8f0").Padding(8).Text(DateTime.Now.ToString("dd MMMM yyyy HH:mm:ss", new System.Globalization.CultureInfo("id-ID")));
                        });

                        col.Item().PaddingTop(40).Text("Catatan: Dokumen digital ini diarsipkan secara otomatis oleh sistem GAAS.")
                            .FontSize(9).Italic().FontColor("#64748b");
                    });

                    page.Footer().AlignCenter().Text(x =>
                    {
                        x.Span("Dokumen Resmi PT PGAS Solution · Halaman ");
                        x.CurrentPageNumber();
                        x.Span(" / ");
                        x.TotalPages();
                    });
                });
            }).GeneratePdf(path);
        }
        catch
        {
            // Fallback gracefully if generation encounters any issue
        }
    }
}
