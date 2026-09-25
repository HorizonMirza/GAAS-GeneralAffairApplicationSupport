using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Models;

namespace PengirimanApi.Tests;

public class ApprovalConcurrencyTests
{
    public static TheoryData<Type> ApprovalEntities => new()
    {
        typeof(Pengiriman),
        typeof(BookingRuang),
        typeof(BookingKendaraan),
        typeof(PermintaanAtk),
        typeof(PerbaikanSarana),
        typeof(PermintaanArsip),
    };

    [Theory]
    [MemberData(nameof(ApprovalEntities))]
    public void Status_is_configured_as_a_concurrency_token(Type entityType)
    {
        using var db = CreateContext();

        var status = db.Model.FindEntityType(entityType)?.FindProperty("Status");

        Assert.NotNull(status);
        Assert.True(status.IsConcurrencyToken);
    }

    [Fact]
    public async Task A_second_approval_decision_cannot_overwrite_the_first()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"approval-concurrency-{Guid.NewGuid()}")
            .Options;

        await using (var setup = new AppDbContext(options))
        {
            await setup.Database.EnsureCreatedAsync();
            var creator = new User
            {
                Username = "creator",
                PasswordHash = "not-used-in-test",
                Nama = "Test Creator",
                Role = RoleEnum.ADMIN_DIVISI,
                Divisi = "Test Division",
            };
            setup.Users.Add(creator);
            await setup.SaveChangesAsync();

            setup.BookingRuangs.Add(new BookingRuang
            {
                NamaKegiatan = "Concurrency Test",
                NamaRuang = "Test Room",
                Divisi = "Test Division",
                Tanggal = new DateOnly(2026, 9, 24),
                Status = BookingStatusEnum.SUBMITTED,
                CreatedBy = creator.Id,
                CreatedByRole = creator.Role,
            });
            await setup.SaveChangesAsync();
        }

        await using var approver = new AppDbContext(options);
        await using var rejector = new AppDbContext(options);
        var approved = await approver.BookingRuangs.SingleAsync();
        var rejected = await rejector.BookingRuangs.SingleAsync();

        approved.Status = BookingStatusEnum.APPROVED_L1;
        await approver.SaveChangesAsync();

        rejected.Status = BookingStatusEnum.REJECTED_L1;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => rejector.SaveChangesAsync());

        await using var verification = new AppDbContext(options);
        Assert.Equal(BookingStatusEnum.APPROVED_L1, (await verification.BookingRuangs.SingleAsync()).Status);
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"model-metadata-{Guid.NewGuid()}")
            .Options;
        return new AppDbContext(options);
    }
}
