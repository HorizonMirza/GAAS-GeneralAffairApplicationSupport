using System.Text;
using PengirimanApi.Models;

namespace PengirimanApi.Services;

// Plain RFC 5545 text generation, no external library - the format is simple enough that adding
// a dependency (like QuestPDF for the PDF) would be overkill. Generated on demand, not stored,
// so a viewer can pull it into their own Outlook/Google Calendar at any time, whatever the
// booking's current status - see BookingRuangController.DownloadIcs.
public static class IcsService
{
    // Escape text-value special characters per RFC 5545 section 3.3.11.
    private static string Escape(string value) =>
        value.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\n", "\\n");

    private static string FormatDateTime(DateTime value) => value.ToString("yyyyMMddTHHmmss");

    private static string FormatDateOnly(DateOnly value) => value.ToString("yyyyMMdd");

    private static string StatusLabel(BookingStatusEnum status) => status switch
    {
        BookingStatusEnum.APPROVED_GA_APPROVAL => "Approved",
        BookingStatusEnum.DRAFT => "Draft",
        _ when status.ToString().StartsWith("REJECTED") => "Rejected",
        _ => "On-Approval",
    };

    public static byte[] Generate(BookingRuang item)
    {
        var rooms = new[] { item.NamaRuang }.Concat(item.AdditionalRooms.Select(r => r.NamaRuang));
        var location = string.Join(", ", rooms);

        var descriptionLines = new List<string>
        {
            $"Nomor Pemesanan: {item.NomorPemesanan ?? "-"}",
            $"PIC: {item.Pic ?? "-"}",
            $"Jumlah Peserta: {item.JumlahPeserta} orang",
            $"Status: {StatusLabel(item.Status)}",
        };
        if (!string.IsNullOrWhiteSpace(item.Catatan)) descriptionLines.Add($"Catatan: {item.Catatan}");
        // Join with a real newline, not the literal "\n" text - Escape() below turns a real
        // newline into the RFC 5545 "\n" line-break escape; joining with the escape sequence
        // directly would get its own backslash doubled by Escape()'s backslash-escaping step,
        // corrupting it into a literal "\n" shown in the text instead of an actual line break.
        var description = string.Join("\n", descriptionLines);

        var lines = new List<string>
        {
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//PGM Solution//Room Booking//ID",
            "CALSCALE:GREGORIAN",
            "BEGIN:VEVENT",
            $"UID:booking-ruang-{item.Id}@pgmsolution",
            $"DTSTAMP:{FormatDateTime(DateTime.UtcNow)}Z",
        };

        if (item.IsWholeDay)
        {
            lines.Add($"DTSTART;VALUE=DATE:{FormatDateOnly(item.Tanggal)}");
            lines.Add($"DTEND;VALUE=DATE:{FormatDateOnly(item.Tanggal.AddDays(1))}");
        }
        else
        {
            // Emitted as local Asia/Jakarta wall-clock time via TZID without an embedded
            // VTIMEZONE block - accepted as-is by Google Calendar and most modern clients for a
            // well-known IANA zone name; acceptable simplification for a generated-on-demand file.
            var start = item.Tanggal.ToDateTime(item.JamMulai ?? TimeOnly.MinValue);
            var end = item.Tanggal.ToDateTime(item.JamSelesai ?? TimeOnly.MinValue);
            lines.Add($"DTSTART;TZID=Asia/Jakarta:{FormatDateTime(start)}");
            lines.Add($"DTEND;TZID=Asia/Jakarta:{FormatDateTime(end)}");
        }

        lines.Add($"SUMMARY:{Escape(item.NamaKegiatan)}");
        lines.Add($"LOCATION:{Escape(location)}");
        lines.Add($"DESCRIPTION:{Escape(description)}");
        lines.Add("END:VEVENT");
        lines.Add("END:VCALENDAR");

        // RFC 5545 mandates CRLF line endings.
        return Encoding.UTF8.GetBytes(string.Join("\r\n", lines) + "\r\n");
    }
}
