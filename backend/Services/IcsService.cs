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

    // Jakarta (WIB) is a fixed UTC+7 offset year-round - no DST to account for - so converting to
    // UTC here is exact and lets every event be emitted as a plain "...Z" UTC timestamp instead of
    // a named TZID.
    private static readonly TimeSpan JakartaOffset = TimeSpan.FromHours(7);

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
            // Emitted in UTC (real "Z" timestamps) rather than TZID=Asia/Jakarta - a bare TZID
            // with no matching VTIMEZONE block in the calendar is silently rejected by Google
            // Calendar's Import flow and Outlook (both expect either a VTIMEZONE definition or a
            // UTC time), so the event never showed up after import. Converting to UTC upfront
            // avoids needing a VTIMEZONE block at all and works everywhere.
            var start = item.Tanggal.ToDateTime(item.JamMulai ?? TimeOnly.MinValue) - JakartaOffset;
            var end = item.Tanggal.ToDateTime(item.JamSelesai ?? TimeOnly.MinValue) - JakartaOffset;
            lines.Add($"DTSTART:{FormatDateTime(start)}Z");
            lines.Add($"DTEND:{FormatDateTime(end)}Z");
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
