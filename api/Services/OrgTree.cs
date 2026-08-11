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
            new("Corporate Secretary", "CorporateSecretaryADMINDIV", "CorporateSecretaryAPPROVALDIV", new()
            {
                new("Legal and Compliance", "LegalAndComplianceADMIN", "LegalAndComplianceAPPROVAL"),
                new("Communication Relation and CSR", "CommunicationRelationAndCSRADMIN", "CommunicationRelationAndCSRAPPROVAL"),
                new("BOD/BOC Support", "BODBOCSupportADMIN", "BODBOCSupportAPPROVAL"),
            }),
            new("Chief Audit Executive", "ChiefAuditExecutiveADMINDIV", "ChiefAuditExecutiveAPPROVALDIV", new()
            {
                new("Audit Planning and Monitoring", "AuditPlanningAndMonitoringADMIN", "AuditPlanningAndMonitoringAPPROVAL"),
                new("Internal Auditor", "InternalAuditorADMIN", "InternalAuditorAPPROVAL"),
            }),
            new("QHSSE", "QHSSEADMINDIV", "QHSSEAPPROVALDIV", new()
            {
                new("Health, Safety, and Security", "HealthSafetyAndSecurityADMIN", "HealthSafetyAndSecurityAPPROVAL"),
                new("Environment", "EnvironmentADMIN", "EnvironmentAPPROVAL"),
                new("Quality Management", "QualityManagementADMIN", "QualityManagementAPPROVAL"),
            }),
            new("Strategic Planning", "StrategicPlanningADMINDIV", "StrategicPlanningAPPROVALDIV", new()
            {
                new("Business Strategy and Performance Monitoring", "BusinessStrategyAndPerformanceMonitoringADMIN", "BusinessStrategyAndPerformanceMonitoringAPPROVAL"),
                new("Business Development and Marketing", "BusinessDevelopmentAndMarketingADMIN", "BusinessDevelopmentAndMarketingAPPROVAL"),
            }),
        }),
        new("Direktorat Teknik dan Pengembangan", new()
        {
            new("EPC Commercial and Energy Equipment", "EPCCommercialAndEnergyEquipmentADMINDIV", "EPCCommercialAndEnergyEquipmentAPPROVALDIV", new()
            {
                new("EPC Sales and Customer Relation", "EPCSalesAndCustomerRelationADMIN", "EPCSalesAndCustomerRelationAPPROVAL"),
                new("EPC Project Proposal", "EPCProjectProposalADMIN", "EPCProjectProposalAPPROVAL"),
                new("Energy Equipment", "EnergyEquipmentADMIN", "EnergyEquipmentAPPROVAL"),
            }),
            new("EPC Engineering and QA", "EPCEngineeringAndQAADMINDIV", "EPCEngineeringAndQAAPPROVALDIV", new()
            {
                new("Proposal Engineering - EPC", "ProposalEngineeringEPCADMIN", "ProposalEngineeringEPCAPPROVAL"),
                new("QA - EPC", "QAEPCADMIN", "QAEPCAPPROVAL"),
            }),
            new("EPC Project", "EPCProjectADMINDIV", "EPCProjectAPPROVALDIV", new()
            {
                new("Engineering Project – EPC", "EngineeringProjectEPCADMIN", "EngineeringProjectEPCAPPROVAL"),
                new("QHSSE Project -EPC", "QHSSEProjectEPCADMIN", "QHSSEProjectEPCAPPROVAL"),
                new("Regional EPC Project I/II/III", "RegionalEPCProjectADMIN", "RegionalEPCProjectAPPROVAL"),
                new("EPC Project Support and Contract Management", "EPCProjectSupportAndContractManagementADMIN", "EPCProjectSupportAndContractManagementAPPROVAL"),
            }),
            new("Jargas Project", "JargasProjectADMINDIV", "JargasProjectAPPROVALDIV", new()
            {
                new("Project Manager - Jargas", "ProjectManagerJargasADMIN", "ProjectManagerJargasAPPROVAL"),
                new("Jargas Project Support and Contract Management", "JargasProjectSupportAndContractManagementADMIN", "JargasProjectSupportAndContractManagementAPPROVAL"),
            }),
        }),
        new("Direktorat Operasi", new()
        {
            new("Operation Commercial Services", "OperationCommercialServicesADMINDIV", "OperationCommercialServicesAPPROVALDIV", new()
            {
                new("Operation Sales and Customer Relation", "OperationSalesAndCustomerRelationADMIN", "OperationSalesAndCustomerRelationAPPROVAL"),
                new("Operation Project Proposal", "OperationProjectProposalADMIN", "OperationProjectProposalAPPROVAL"),
            }),
            new("Operation Engineering and QA", "OperationEngineeringAndQAADMINDIV", "OperationEngineeringAndQAAPPROVALDIV", new()
            {
                new("Proposal Engineering - Operation", "ProposalEngineeringOperationADMIN", "ProposalEngineeringOperationAPPROVAL"),
                new("QA - Operation", "QAOperationADMIN", "QAOperationAPPROVAL"),
            }),
            new("Operation Project", "OperationProjectADMINDIV", "OperationProjectAPPROVALDIV", new()
            {
                new("QHSSE Project -Operation", "QHSSEProjectOperationADMIN", "QHSSEProjectOperationAPPROVAL"),
                new("Project Manager - SOR I/II/III", "ProjectManagerSORADMIN", "ProjectManagerSORAPPROVAL"),
                new("Project Manager - OMM", "ProjectManagerOMMADMIN", "ProjectManagerOMMAPPROVAL"),
                new("Project Manager - Operation", "ProjectManagerOperationADMIN", "ProjectManagerOperationAPPROVAL"),
                new("Operation Project Support and Contract Management", "OperationProjectSupportAndContractManagementADMIN", "OperationProjectSupportAndContractManagementAPPROVAL"),
            }),
            new("Manufacture and Fabrication", "ManufactureAndFabricationADMINDIV", "ManufactureAndFabricationAPPROVALDIV", new()
            {
                new("Manufacture", "ManufactureADMIN", "ManufactureAPPROVAL"),
                new("Fabrication", "FabricationADMIN", "FabricationAPPROVAL"),
            }),
        }),
        new("Direktorat Keuangan Dan Dukungan Bisnis", new()
        {
            new("Finance", "FinanceADMINDIV", "FinanceAPPROVALDIV", new()
            {
                new("Budgeting and Accounting", "BudgetingAndAccountingADMIN", "BudgetingAndAccountingAPPROVAL"),
                new("Cash Management", "CashManagementADMIN", "CashManagementAPPROVAL"),
                new("Tax Management", "TaxManagementADMIN", "TaxManagementAPPROVAL"),
                new("Bad Debt", "BadDebtADMIN", "BadDebtAPPROVAL"),
            }),
            new("Procurement and General Affair", "ProcurementAndGeneralAffairADMINDIV", "ProcurementAndGeneralAffairAPPROVALDIV", new()
            {
                new("Procurement System and Planning", "ProcurementSystemAndPlanningADMIN", "ProcurementSystemAndPlanningAPPROVAL"),
                new("Procurement Operational and Contract Administration", "ProcurementOperationalAndContractAdministrationADMIN", "ProcurementOperationalAndContractAdministrationAPPROVAL"),
                new("Asset Management and General Affair", "AssetManagementAndGeneralAffairADMIN", "AssetManagementAndGeneralAffairAPPROVAL"),
            }),
            new("Information and Communication Technology", "InformationAndCommunicationTechnologyADMINDIV", "InformationAndCommunicationTechnologyAPPROVALDIV", new()
            {
                new("ICT Planning and Architecture", "ICTPlanningAndArchitectureADMIN", "ICTPlanningAndArchitectureAPPROVAL"),
                new("ICT Development", "ICTDevelopmentADMIN", "ICTDevelopmentAPPROVAL"),
                new("ICT Security Infrastructure and End User", "ICTSecurityInfrastructureAndEndUserADMIN", "ICTSecurityInfrastructureAndEndUserAPPROVAL"),
            }),
            new("Human Capital Management", "HumanCapitalManagementADMINDIV", "HumanCapitalManagementAPPROVALDIV", new()
            {
                new("Organization and Culture Management", "OrganizationAndCultureManagementADMIN", "OrganizationAndCultureManagementAPPROVAL"),
                new("Career and Talent Management", "CareerAndTalentManagementADMIN", "CareerAndTalentManagementAPPROVAL"),
                new("Reward and HC Services", "RewardAndHCServicesADMIN", "RewardAndHCServicesAPPROVAL"),
                new("Learning and Development", "LearningAndDevelopmentADMIN", "LearningAndDevelopmentAPPROVAL"),
            }),
            new("Risk Management", "RiskManagementADMINDIV", "RiskManagementAPPROVALDIV", new()
            {
                new("Risk Management", "RiskManagementADMIN", "RiskManagementAPPROVAL"),
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
