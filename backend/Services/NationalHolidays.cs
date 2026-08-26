namespace PengirimanApi.Services;

// Hardcoded list of Indonesian national holidays ("Hari Libur Nasional", not "Cuti Bersama") per
// SKB 3 Menteri No. 1497/2/5 Tahun 2025 for 2026. There is no algorithmic way to derive the
// Islamic/lunar-calendar holidays here (Isra Mikraj, Idulfitri, Iduladha, 1 Muharam, Maulid Nabi)
// from a formula, and Nyepi/Waisak/Imlek are similarly calendar-specific - this needs a manual
// update once the next year's SKB is published (usually announced a few months in advance).
public static class NationalHolidays
{
    private static readonly Dictionary<DateOnly, string> Holidays2026 = new()
    {
        [new DateOnly(2026, 1, 1)] = "Tahun Baru 2026 Masehi",
        [new DateOnly(2026, 1, 16)] = "Isra Mikraj Nabi Muhammad SAW",
        [new DateOnly(2026, 2, 17)] = "Tahun Baru Imlek 2577 Kongzili",
        [new DateOnly(2026, 3, 19)] = "Hari Suci Nyepi",
        [new DateOnly(2026, 3, 21)] = "Idulfitri 1447 H",
        [new DateOnly(2026, 3, 22)] = "Idulfitri 1447 H",
        [new DateOnly(2026, 4, 3)] = "Wafat Yesus Kristus",
        [new DateOnly(2026, 4, 5)] = "Kebangkitan Yesus Kristus (Paskah)",
        [new DateOnly(2026, 5, 1)] = "Hari Buruh Internasional",
        [new DateOnly(2026, 5, 14)] = "Kenaikan Yesus Kristus",
        [new DateOnly(2026, 5, 27)] = "Iduladha 1447 H",
        [new DateOnly(2026, 5, 31)] = "Hari Raya Waisak 2570 BE",
        [new DateOnly(2026, 6, 1)] = "Hari Lahir Pancasila",
        [new DateOnly(2026, 6, 16)] = "1 Muharam Tahun Baru Islam 1448 H",
        [new DateOnly(2026, 8, 17)] = "Hari Proklamasi Kemerdekaan RI",
        [new DateOnly(2026, 8, 25)] = "Maulid Nabi Muhammad SAW",
        [new DateOnly(2026, 12, 25)] = "Hari Raya Natal",
    };

    private static readonly Dictionary<int, Dictionary<DateOnly, string>> ByYear = new()
    {
        [2026] = Holidays2026,
    };

    public static IReadOnlyDictionary<DateOnly, string> ForYear(int year) =>
        ByYear.TryGetValue(year, out var holidays) ? holidays : new Dictionary<DateOnly, string>();

    public static bool IsHoliday(DateOnly date) => ForYear(date.Year).ContainsKey(date);

    public static string? NameFor(DateOnly date) => ForYear(date.Year).TryGetValue(date, out var name) ? name : null;
}
