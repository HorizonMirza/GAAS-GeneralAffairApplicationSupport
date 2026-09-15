namespace PengirimanApi.Services;

// Every audit timestamp (CreatedAt, ApprovedApprovalGaAt, ...) is stored as UTC via
// DateTime.UtcNow, but users, PDFs and Excel exports all read them as WIB. Indonesia has no DST,
// so a fixed +7h offset is exact year-round (same fact IcsService's JakartaOffset and
// BookingRuangController.IsPastCancelDeadline rely on). Route every stored timestamp through
// here before rendering it, so a document that prints "WIB" is actually showing WIB.
public static class WaktuWib
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(7);

    public static DateTime Now => DateTime.UtcNow + Offset;

    public static DateTime From(DateTime utc) => utc + Offset;

    public static DateTime? From(DateTime? utc) => utc.HasValue ? utc.Value + Offset : null;

    // "15 September 2026 17:40 WIB" - the long form used on printed PDF slips.
    public static string Panjang(DateTime utc) => From(utc).ToString("dd MMMM yyyy HH:mm") + " WIB";

    public static string Panjang(DateTime? utc) => utc.HasValue ? Panjang(utc.Value) : "-";

    // "2026-09-15 17:40" - the sortable form used in Excel/CSV export cells, where the column
    // header already says WIB.
    public static string Pendek(DateTime utc) => From(utc).ToString("yyyy-MM-dd HH:mm");

    public static string Pendek(DateTime? utc) => utc.HasValue ? Pendek(utc.Value) : "-";
}
