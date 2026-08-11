namespace PengirimanApi.Services;

public static class DivisiOptions
{
    public static readonly Dictionary<string, List<string>> DivisiByDirektorat = new()
    {
        ["Direktorat Keuangan dan Dukungan Bisnis"] = new()
        {
            "Finance",
            "Procurement and General Affair",
            "Information and Communication Technology",
            "Human Capital Management",
            "Risk Management",
        },
        ["Direktorat Operasi"] = new()
        {
            "Operation and Commercial Services",
            "Operation Engineering and QA",
            "Operation Project",
            "Manufactures and Fabrication",
        },
        ["Direktorat Teknik dan Pengembangan"] = new()
        {
            "EPC Commercial and Energy Equipment",
            "EPC Engineering and QA",
            "EPC Project",
            "Jargas Project",
        },
        ["Corporate Secretary"] = new() { "Corporate Secretary" },
        ["Chief Audit Executive"] = new() { "Chief Audit Executive" },
        ["QH SSE"] = new() { "QH SSE" },
        ["Strategic Planning"] = new() { "Strategic Planning" },
    };

    public static readonly List<string> AllDivisi =
        DivisiByDirektorat.Values.SelectMany(v => v).ToList();

    public static List<string> GetDivisiOptions(string? direktorat)
    {
        if (string.IsNullOrEmpty(direktorat)) return AllDivisi;
        return DivisiByDirektorat.TryGetValue(direktorat, out var opts) ? opts : new List<string>();
    }
}
