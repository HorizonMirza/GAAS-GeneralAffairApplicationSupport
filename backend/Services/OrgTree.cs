namespace PengirimanApi.Services;

public record DepartemenNode(string Nama, string AdminUsername, string ApprovalUsername);

public record DivisiNode(string Nama, string AdminUsername, string ApprovalUsername, List<DepartemenNode> Departemen);

public record DirektoratNode(string Nama, List<DivisiNode> Divisi);

public static class OrgTree
{
    public static readonly List<DirektoratNode> Tree = new()
    {
        new("Direktorat Utama", new()
        {
            new("Corporate Secretary", "Corporate Secretary Admin Div", "Corporate Secretary Approval Div", new()
            {
                new("Legal and Compliance", "Legal and Compliance Admin", "Legal and Compliance Approval"),
                new("Communication Relation and CSR", "Communication Relation and CSR Admin", "Communication Relation and CSR Approval"),
                new("BOD/BOC Support", "BOD/BOC Support Admin", "BOD/BOC Support Approval"),
            }),
            new("Chief Audit Executive", "Chief Audit Executive Admin Div", "Chief Audit Executive Approval Div", new()
            {
                new("Audit Planning and Monitoring", "Audit Planning and Monitoring Admin", "Audit Planning and Monitoring Approval"),
                new("Internal Auditor", "Internal Auditor Admin", "Internal Auditor Approval"),
            }),
            new("QHSSE", "QHSSE Admin Div", "QHSSE Approval Div", new()
            {
                new("Health, Safety, and Security", "Health, Safety, and Security Admin", "Health, Safety, and Security Approval"),
                new("Environment", "Environment Admin", "Environment Approval"),
                new("Quality Management", "Quality Management Admin", "Quality Management Approval"),
            }),
            new("Strategic Planning", "Strategic Planning Admin Div", "Strategic Planning Approval Div", new()
            {
                new("Business Strategy and Performance Monitoring", "Business Strategy and Performance Monitoring Admin", "Business Strategy and Performance Monitoring Approval"),
                new("Business Development and Marketing", "Business Development and Marketing Admin", "Business Development and Marketing Approval"),
            }),
        }),
        new("Direktorat Teknik dan Pengembangan", new()
        {
            new("EPC Commercial and Energy Equipment", "EPC Commercial and Energy Equipment Admin Div", "EPC Commercial and Energy Equipment Approval Div", new()
            {
                new("EPC Sales and Customer Relation", "EPC Sales and Customer Relation Admin", "EPC Sales and Customer Relation Approval"),
                new("EPC Project Proposal", "EPC Project Proposal Admin", "EPC Project Proposal Approval"),
                new("Energy Equipment", "Energy Equipment Admin", "Energy Equipment Approval"),
            }),
            new("EPC Engineering and QA", "EPC Engineering and QA Admin Div", "EPC Engineering and QA Approval Div", new()
            {
                new("Proposal Engineering - EPC", "Proposal Engineering - EPC Admin", "Proposal Engineering - EPC Approval"),
                new("QA - EPC", "QA - EPC Admin", "QA - EPC Approval"),
            }),
            new("EPC Project", "EPC Project Admin Div", "EPC Project Approval Div", new()
            {
                new("Engineering Project - EPC", "Engineering Project - EPC Admin", "Engineering Project - EPC Approval"),
                new("QHSSE Project -EPC", "QHSSE Project -EPC Admin", "QHSSE Project -EPC Approval"),
                new("Regional EPC Project I/II/III", "Regional EPC Project I/II/III Admin", "Regional EPC Project I/II/III Approval"),
                new("EPC Project Support and Contract Management", "EPC Project Support and Contract Management Admin", "EPC Project Support and Contract Management Approval"),
            }),
            new("Jargas Project", "Jargas Project Admin Div", "Jargas Project Approval Div", new()
            {
                new("Project Manager - Jargas", "Project Manager - Jargas Admin", "Project Manager - Jargas Approval"),
                new("Jargas Project Support and Contract Management", "Jargas Project Support and Contract Management Admin", "Jargas Project Support and Contract Management Approval"),
            }),
        }),
        new("Direktorat Operasi", new()
        {
            new("Operation Commercial Services", "Operation Commercial Services Admin Div", "Operation Commercial Services Approval Div", new()
            {
                new("Operation Sales and Customer Relation", "Operation Sales and Customer Relation Admin", "Operation Sales and Customer Relation Approval"),
                new("Operation Project Proposal", "Operation Project Proposal Admin", "Operation Project Proposal Approval"),
            }),
            new("Operation Engineering and QA", "Operation Engineering and QA Admin Div", "Operation Engineering and QA Approval Div", new()
            {
                new("Proposal Engineering - Operation", "Proposal Engineering - Operation Admin", "Proposal Engineering - Operation Approval"),
                new("QA - Operation", "QA - Operation Admin", "QA - Operation Approval"),
            }),
            new("Operation Project", "Operation Project Admin Div", "Operation Project Approval Div", new()
            {
                new("QHSSE Project -Operation", "QHSSE Project -Operation Admin", "QHSSE Project -Operation Approval"),
                new("Project Manager - SOR I/II/III", "Project Manager - SOR I/II/III Admin", "Project Manager - SOR I/II/III Approval"),
                new("Project Manager - OMM", "Project Manager - OMM Admin", "Project Manager - OMM Approval"),
                new("Project Manager - Operation", "Project Manager - Operation Admin", "Project Manager - Operation Approval"),
                new("Operation Project Support and Contract Management", "Operation Project Support and Contract Management Admin", "Operation Project Support and Contract Management Approval"),
            }),
            new("Manufacture and Fabrication", "Manufacture and Fabrication Admin Div", "Manufacture and Fabrication Approval Div", new()
            {
                new("Manufacture", "Manufacture Admin", "Manufacture Approval"),
                new("Fabrication", "Fabrication Admin", "Fabrication Approval"),
            }),
        }),
        new("Direktorat Keuangan Dan Dukungan Bisnis", new()
        {
            new("Finance", "Finance Admin Div", "Finance Approval Div", new()
            {
                new("Budgeting and Accounting", "Budgeting and Accounting Admin", "Budgeting and Accounting Approval"),
                new("Cash Management", "Cash Management Admin", "Cash Management Approval"),
                new("Tax Management", "Tax Management Admin", "Tax Management Approval"),
                new("Bad Debt", "Bad Debt Admin", "Bad Debt Approval"),
            }),
            new("Procurement and General Affair", "Procurement and General Affair Admin Div", "Procurement and General Affair Approval Div", new()
            {
                new("Procurement System and Planning", "Procurement System and Planning Admin", "Procurement System and Planning Approval"),
                new("Procurement Operational and Contract Administration", "Procurement Operational and Contract Administration Admin", "Procurement Operational and Contract Administration Approval"),
                new("Asset Management and General Affair", "Asset Management and General Affair Admin", "Asset Management and General Affair Approval"),
            }),
            new("Information and Communication Technology", "Information and Communication Technology Admin Div", "Information and Communication Technology Approval Div", new()
            {
                new("ICT Planning and Architecture", "ICT Planning and Architecture Admin", "ICT Planning and Architecture Approval"),
                new("ICT Development", "ICT Development Admin", "ICT Development Approval"),
                new("ICT Security Infrastructure and End User", "ICT Security Infrastructure and End User Admin", "ICT Security Infrastructure and End User Approval"),
            }),
            new("Human Capital Management", "Human Capital Management Admin Div", "Human Capital Management Approval Div", new()
            {
                new("Organization and Culture Management", "Organization and Culture Management Admin", "Organization and Culture Management Approval"),
                new("Career and Talent Management", "Career and Talent Management Admin", "Career and Talent Management Approval"),
                new("Reward and HC Services", "Reward and HC Services Admin", "Reward and HC Services Approval"),
                new("Learning and Development", "Learning and Development Admin", "Learning and Development Approval"),
            }),
            new("Risk Management", "Risk Management Admin Div", "Risk Management Approval Div", new()
            {
                new("Risk Management", "Risk Management Admin", "Risk Management Approval"),
            }),
        }),
    };

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

    public static readonly Dictionary<string, string> KodeSatuanKerjaByDivisi = new()
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

    public static string GetKodeSatuanKerja(string divisi) =>
        KodeSatuanKerjaByDivisi.TryGetValue(divisi, out var kode) ? kode : "GA";
}
