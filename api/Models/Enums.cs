namespace PengirimanApi.Models;

public enum RoleEnum
{
    ADMIN_DEPARTEMEN,
    APPROVAL_DEPARTEMEN,
    ADMIN_DIVISI,
    APPROVAL_DIVISI,
    ADMIN_GA,
    APPROVAL_GA,
    KPU,
    SUPER_ADMIN,
}

public enum AsuransiEnum
{
    Ya,
    Tidak,
}

public enum InvoiceStatusEnum
{
    PENDING,
    APPROVED,
    REJECTED,
}

public enum StatusEnum
{
    DRAFT,
    SUBMITTED,
    REJECTED_L1,
    APPROVED_L1,
    REJECTED_GA,
    APPROVED_GA,
    REJECTED_GA_APPROVAL,
    APPROVED_GA_APPROVAL,
    REJECTED_KPU,
    COMPLETED,
}

public enum RejectTargetEnum
{
    GA,
    ORIGIN,
}
