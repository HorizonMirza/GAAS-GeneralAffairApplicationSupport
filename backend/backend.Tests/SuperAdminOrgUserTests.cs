using Microsoft.EntityFrameworkCore;
using PengirimanApi.Controllers;
using PengirimanApi.Data;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Tests;

// Covers the Super Admin Org/User management logic that shipped with no automated coverage:
// UsersAdminController.ValidateRoleOrgConsistency/IsLastActiveSuperAdmin and
// OrgAdminController.IsDivisiInUse/IsDepartemenInUse are all public static (db passed explicitly)
// specifically so they can be exercised here without standing up a real CurrentUserService/
// HttpContext - same reasoning as ChatHub's own public static Can...Chat helpers.
public class SuperAdminOrgUserTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase($"superadmin-{Guid.NewGuid()}").Options);

    private static User NewUser(string username, RoleEnum role, string? divisi = null, string? departemen = null) => new()
    {
        Username = username,
        PasswordHash = "not-used-in-test",
        Nama = username,
        Role = role,
        Divisi = divisi,
        Departemen = departemen,
    };

    // ---- ValidateRoleOrgConsistency ----

    [Theory]
    [InlineData(RoleEnum.ADMIN_GA, null, null, true)]
    [InlineData(RoleEnum.APPROVAL_GA, "Divisi X", null, false)]
    [InlineData(RoleEnum.KPU, null, "Departemen X", false)]
    [InlineData(RoleEnum.SUPER_ADMIN, "Divisi X", "Departemen X", false)]
    public void GA_KPU_and_SuperAdmin_roles_must_have_no_org_unit(RoleEnum role, string? divisi, string? departemen, bool expectedValid)
    {
        var error = UsersAdminController.ValidateRoleOrgConsistency(role, divisi, departemen);
        Assert.Equal(expectedValid, error == null);
    }

    [Theory]
    [InlineData(RoleEnum.ADMIN_DIVISI, "Divisi X", null, true)]
    [InlineData(RoleEnum.APPROVAL_DIVISI, null, null, false)]
    [InlineData(RoleEnum.ADMIN_DIVISI, "Divisi X", "Departemen X", false)]
    public void Divisi_roles_need_a_divisi_but_reject_a_departemen(RoleEnum role, string? divisi, string? departemen, bool expectedValid)
    {
        var error = UsersAdminController.ValidateRoleOrgConsistency(role, divisi, departemen);
        Assert.Equal(expectedValid, error == null);
    }

    [Theory]
    [InlineData(RoleEnum.ADMIN_DEPARTEMEN, "Divisi X", "Departemen X", true)]
    [InlineData(RoleEnum.APPROVAL_DEPARTEMEN, "Divisi X", null, false)]
    [InlineData(RoleEnum.ADMIN_DEPARTEMEN, null, null, false)]
    public void Departemen_roles_need_both_divisi_and_departemen(RoleEnum role, string? divisi, string? departemen, bool expectedValid)
    {
        var error = UsersAdminController.ValidateRoleOrgConsistency(role, divisi, departemen);
        Assert.Equal(expectedValid, error == null);
    }

    // ---- IsLastActiveSuperAdmin ----

    [Fact]
    public async Task Sole_active_super_admin_is_flagged_as_last()
    {
        await using var db = CreateContext();
        var sa = NewUser("sa1", RoleEnum.SUPER_ADMIN);
        db.Users.Add(sa);
        await db.SaveChangesAsync();

        Assert.True(await UsersAdminController.IsLastActiveSuperAdmin(db, sa));
    }

    [Fact]
    public async Task Not_last_when_another_active_super_admin_exists()
    {
        await using var db = CreateContext();
        var sa1 = NewUser("sa1", RoleEnum.SUPER_ADMIN);
        var sa2 = NewUser("sa2", RoleEnum.SUPER_ADMIN);
        db.Users.AddRange(sa1, sa2);
        await db.SaveChangesAsync();

        Assert.False(await UsersAdminController.IsLastActiveSuperAdmin(db, sa1));
    }

    [Fact]
    public async Task An_inactive_other_super_admin_does_not_count()
    {
        await using var db = CreateContext();
        var sa1 = NewUser("sa1", RoleEnum.SUPER_ADMIN);
        var sa2 = NewUser("sa2", RoleEnum.SUPER_ADMIN);
        sa2.IsActive = false;
        db.Users.AddRange(sa1, sa2);
        await db.SaveChangesAsync();

        Assert.True(await UsersAdminController.IsLastActiveSuperAdmin(db, sa1));
    }

    [Fact]
    public async Task A_non_super_admin_target_is_never_flagged_as_last()
    {
        await using var db = CreateContext();
        var admin = NewUser("adm", RoleEnum.ADMIN_GA);
        db.Users.Add(admin);
        await db.SaveChangesAsync();

        Assert.False(await UsersAdminController.IsLastActiveSuperAdmin(db, admin));
    }

    // ---- IsDivisiInUse / IsDepartemenInUse ----

    [Fact]
    public async Task Divisi_in_use_by_a_user_account_is_detected()
    {
        await using var db = CreateContext();
        db.Users.Add(NewUser("u1", RoleEnum.ADMIN_DIVISI, divisi: "Divisi X"));
        await db.SaveChangesAsync();

        Assert.True(await OrgAdminController.IsDivisiInUse(db, "Divisi X"));
        Assert.False(await OrgAdminController.IsDivisiInUse(db, "Divisi Lain"));
    }

    [Fact]
    public async Task Divisi_in_use_by_a_business_row_is_detected_even_with_no_matching_user()
    {
        await using var db = CreateContext();
        db.Pengiriman.Add(new Pengiriman
        {
            Divisi = "Divisi X",
            Tanggal = new DateOnly(2026, 1, 1),
            TujuanPenerimaan = "Kantor Pusat",
            NamaPengirim = "Pengirim",
            NoTeleponPengirim = "0800000000",
            AlamatPengirim = "Alamat Pengirim",
            NomorTransmittal = "T-001",
            KodeProgram = "P-001",
            NamaPenerima = "Penerima",
            AlamatPenerima = "Alamat Penerima",
            NoTeleponPenerima = "0800000001",
            RequestPacking = "Tidak",
            CreatedBy = 1,
            CreatedByRole = RoleEnum.ADMIN_DIVISI,
        });
        await db.SaveChangesAsync();

        Assert.True(await OrgAdminController.IsDivisiInUse(db, "Divisi X"));
    }

    [Fact]
    public async Task Departemen_in_use_by_a_user_account_is_detected()
    {
        await using var db = CreateContext();
        db.Users.Add(NewUser("u1", RoleEnum.ADMIN_DEPARTEMEN, divisi: "Divisi X", departemen: "Departemen X"));
        await db.SaveChangesAsync();

        Assert.True(await OrgAdminController.IsDepartemenInUse(db, "Departemen X"));
        Assert.False(await OrgAdminController.IsDepartemenInUse(db, "Departemen Lain"));
    }

    // ---- LogDeletion (ApiControllerBase - deletion_log wiring) ----

    // Grants access to LogDeletion (protected static on ApiControllerBase) without needing a real
    // CurrentUserService/HttpContext - the constructor exists only so this compiles as a concrete
    // subclass; it is never actually invoked, since CallLogDeletion needs no instance.
    private sealed class TestableApiController : ApiControllerBase
    {
        public TestableApiController(CurrentUserService currentUser) : base(currentUser) { }

        public static void CallLogDeletion(AppDbContext db, string modul, int itemId, string? itemNomor, User actor, string? filterSummary = null)
            => LogDeletion(db, modul, itemId, itemNomor, actor, filterSummary);
    }

    [Fact]
    public async Task LogDeletion_queues_a_deletion_log_row_with_the_actors_identity()
    {
        await using var db = CreateContext();
        var actor = NewUser("sa1", RoleEnum.SUPER_ADMIN);
        db.Users.Add(actor);
        await db.SaveChangesAsync();

        TestableApiController.CallLogDeletion(db, "ekspedisi", 42, "0001.ABC.01.2026", actor, "status: REJECTED");
        await db.SaveChangesAsync();

        var row = await db.DeletionLogs.SingleAsync();
        Assert.Equal("ekspedisi", row.Modul);
        Assert.Equal(42, row.ItemId);
        Assert.Equal("0001.ABC.01.2026", row.ItemNomor);
        Assert.Equal(actor.Id, row.DeletedBy);
        Assert.Equal("sa1", row.DeletedByNama);
        Assert.Equal("status: REJECTED", row.FilterSummary);
    }
}
