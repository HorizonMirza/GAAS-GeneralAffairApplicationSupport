using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;

namespace PengirimanApi.Services;

// Usernames are derived from Nama rather than stored, following the exact same convention the
// old hardcoded literal below used everywhere - see DbSeeder.BuildAccounts and
// UsersAdminController's own auto-provisioning, both of which read these off a DivisiNode/
// DepartemenNode the same way regardless of whether it came from SeedData or the database.
public record DepartemenNode(string Nama)
{
    public string AdminUsername => $"{Nama} Admin";
    public string ApprovalUsername => $"{Nama} Approval";
}

public record DivisiNode(string Nama, List<DepartemenNode> Departemen)
{
    public string AdminUsername => $"{Nama} Admin Div";
    public string ApprovalUsername => $"{Nama} Approval Div";
}

public record DirektoratNode(string Nama, List<DivisiNode> Divisi);

public static class OrgTree
{
    // The org structure exactly as it was hardcoded before this feature existed. Used ONLY as
    // one-time seed data for the org_direktorat/org_divisi/org_departemen tables the very first
    // time this app boots against a database that doesn't have them yet (see the backfill block in
    // Program.cs) - NOT read by anything else. Once that backfill has run, Tree/
    // KodeSatuanKerjaByDivisi below are rebuilt from the database instead (see LoadFromDb), so an
    // edit to this literal after go-live has no effect on a running deployment - the only way to
    // change the org structure after that point is through OrgAdminController.
    public static readonly List<DirektoratNode> SeedData = new()
    {
        new("Direktorat Utama", new()
        {
            new("Corporate Secretary", new()
            {
                new("Legal and Compliance"),
                new("Communication Relation and CSR"),
                new("BOD/BOC Support"),
            }),
            new("Chief Audit Executive", new()
            {
                new("Audit Planning and Monitoring"),
                new("Internal Auditor"),
            }),
            new("QHSSE", new()
            {
                new("Health, Safety, and Security"),
                new("Environment"),
                new("Quality Management"),
            }),
            new("Strategic Planning", new()
            {
                new("Business Strategy and Performance Monitoring"),
                new("Business Development and Marketing"),
            }),
        }),
        new("Direktorat Teknik dan Pengembangan", new()
        {
            new("EPC Commercial and Energy Equipment", new()
            {
                new("EPC Sales and Customer Relation"),
                new("EPC Project Proposal"),
                new("Energy Equipment"),
            }),
            new("EPC Engineering and QA", new()
            {
                new("Proposal Engineering - EPC"),
                new("QA - EPC"),
            }),
            new("EPC Project", new()
            {
                new("Engineering Project - EPC"),
                new("QHSSE Project -EPC"),
                new("Regional EPC Project I/II/III"),
                new("EPC Project Support and Contract Management"),
            }),
            new("Jargas Project", new()
            {
                new("Project Manager - Jargas"),
                new("Jargas Project Support and Contract Management"),
            }),
        }),
        new("Direktorat Operasi", new()
        {
            new("Operation Commercial Services", new()
            {
                new("Operation Sales and Customer Relation"),
                new("Operation Project Proposal"),
            }),
            new("Operation Engineering and QA", new()
            {
                new("Proposal Engineering - Operation"),
                new("QA - Operation"),
            }),
            new("Operation Project", new()
            {
                new("QHSSE Project -Operation"),
                new("Project Manager - SOR I/II/III"),
                new("Project Manager - OMM"),
                new("Project Manager - Operation"),
                new("Operation Project Support and Contract Management"),
            }),
            new("Manufacture and Fabrication", new()
            {
                new("Manufacture"),
                new("Fabrication"),
            }),
        }),
        new("Direktorat Keuangan Dan Dukungan Bisnis", new()
        {
            new("Finance", new()
            {
                new("Budgeting and Accounting"),
                new("Cash Management"),
                new("Tax Management"),
                new("Bad Debt"),
            }),
            new("Procurement and General Affair", new()
            {
                new("Procurement System and Planning"),
                new("Procurement Operational and Contract Administration"),
                new("Asset Management and General Affair"),
            }),
            new("Information and Communication Technology", new()
            {
                new("ICT Planning and Architecture"),
                new("ICT Development"),
                new("ICT Security Infrastructure and End User"),
            }),
            new("Human Capital Management", new()
            {
                new("Organization and Culture Management"),
                new("Career and Talent Management"),
                new("Reward and HC Services"),
                new("Learning and Development"),
            }),
            new("Risk Management", new()
            {
                new("Risk Management"),
            }),
        }),
    };

    public static readonly Dictionary<string, string> SeedKodeSatuanKerjaByDivisi = new()
    {
        ["Corporate Secretary"] = "Corsec",
        ["Chief Audit Executive"] = "CAE",
        ["QHSSE"] = "QHSSE",
        ["Strategic Planning"] = "SP",
        ["Operation Commercial Services"] = "OCS",
        ["Operation Engineering and QA"] = "OEQA",
        ["Operation Project"] = "OP",
        ["Manufacture and Fabrication"] = "MF",
        ["EPC Commercial and Energy Equipment"] = "EPCCEE",
        ["EPC Engineering and QA"] = "EPCEQA",
        ["EPC Project"] = "EPCP",
        ["Jargas Project"] = "JP",
        ["Finance"] = "FIN",
        ["Procurement and General Affair"] = "PGA",
        ["Information and Communication Technology"] = "ICT",
        ["Human Capital Management"] = "HCM",
        ["Risk Management"] = "RM",
    };

    // Single-process, in-memory cache of the DB-backed org structure (see Models/OrgDirektorat.cs/
    // OrgDivisi.cs/OrgDepartemen.cs and Controllers/OrgAdminController.cs). Kept as a plain in-
    // memory List/Dictionary - exactly like the hardcoded literal above that this replaces -
    // rather than hitting the database from every one of the 37 existing call sites across the
    // app's controllers, since those all sit on the hot path for ordinary create/list/approve
    // actions and none of them need to see an org edit in the same instant it happens.
    //
    // Populated once at startup (Program.cs calls LoadFromDb right after the one-time backfill),
    // and refreshed again, synchronously, at the end of every OrgAdminController write - so this
    // same process's very next request already reflects the change. KNOWN, ACCEPTED LIMITATION:
    // in a hypothetical multi-instance deployment another instance's copy of this cache would only
    // catch up on its own next restart - there is deliberately no pub/sub or distributed cache
    // built for this, since the app runs as a single instance.
    public static List<DirektoratNode> Tree { get; private set; } = SeedData;
    public static Dictionary<string, string> KodeSatuanKerjaByDivisi { get; private set; } = SeedKodeSatuanKerjaByDivisi;

    // Rebuilds Tree/KodeSatuanKerjaByDivisi from whatever org_direktorat/org_divisi/org_departemen
    // currently hold. Synchronous (matches the synchronous EnsureCreated()/ExecuteSqlRaw calls
    // it's called alongside in Program.cs, and OrgAdminController's own request-scoped DbContext
    // use) and safe to call repeatedly - each call fully replaces the previous snapshot rather
    // than mutating it in place, so there's nothing left over from before an edit.
    public static void LoadFromDb(AppDbContext db)
    {
        var direktorats = db.OrgDirektorats
            .Include(d => d.Divisi).ThenInclude(v => v.Departemen)
            .OrderBy(d => d.Id)
            .ToList();

        Tree = direktorats
            .Select(d => new DirektoratNode(
                d.Nama,
                d.Divisi
                    .OrderBy(v => v.Id)
                    .Select(v => new DivisiNode(
                        v.Nama,
                        v.Departemen.OrderBy(dep => dep.Id).Select(dep => new DepartemenNode(dep.Nama)).ToList()
                    ))
                    .ToList()
            ))
            .ToList();

        KodeSatuanKerjaByDivisi = direktorats
            .SelectMany(d => d.Divisi)
            .ToDictionary(v => v.Nama, v => v.KodeSatuanKerja);
    }

    public static List<string> AllDirektorat => Tree.Select(d => d.Nama).ToList();

    public static List<string> AllDivisi => Tree.SelectMany(d => d.Divisi).Select(v => v.Nama).ToList();

    public static List<string> AllDepartemen => Tree.SelectMany(d => d.Divisi).SelectMany(v => v.Departemen).Select(dep => dep.Nama).ToList();

    public static List<string> GetDivisiOptions(string? direktorat)
    {
        if (string.IsNullOrEmpty(direktorat)) return AllDivisi;
        var dir = Tree.FirstOrDefault(d => d.Nama == direktorat);
        return dir?.Divisi.Select(v => v.Nama).ToList() ?? new List<string>();
    }

    public static List<string> GetDepartemenOptions(string? divisi)
    {
        if (string.IsNullOrEmpty(divisi)) return AllDepartemen;
        var div = Tree.SelectMany(d => d.Divisi).FirstOrDefault(v => v.Nama == divisi);
        return div?.Departemen.Select(dep => dep.Nama).ToList() ?? new List<string>();
    }

    public static string? GetDirektoratForDivisi(string divisi) =>
        Tree.FirstOrDefault(d => d.Divisi.Any(v => v.Nama == divisi))?.Nama;

    public static string GetKodeSatuanKerja(string divisi) =>
        KodeSatuanKerjaByDivisi.TryGetValue(divisi, out var kode) ? kode : "GA";
}
