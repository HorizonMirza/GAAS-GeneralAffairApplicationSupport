using Microsoft.EntityFrameworkCore;
using PengirimanApi.Controllers;
using PengirimanApi.Data;
using PengirimanApi.Models;

namespace PengirimanApi.Tests;

// Covers MeetingRoomAdminController.IsRoomInUse and VehicleAdminController.IsVehicleInUse - both
// public static (db passed explicitly, like ChatHub's own Can...Chat helpers) so they can be
// exercised here without standing up a real CurrentUserService/HttpContext.
public class MeetingRoomVehicleAdminTests
{
    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase($"room-vehicle-admin-{Guid.NewGuid()}").Options);

    private static BookingRuang NewBookingRuang(string namaRuang, BookingStatusEnum status) => new()
    {
        NamaKegiatan = "Rapat Test",
        NamaRuang = namaRuang,
        Divisi = "Test Division",
        Tanggal = new DateOnly(2026, 1, 1),
        Status = status,
        CreatedBy = 1,
        CreatedByRole = RoleEnum.ADMIN_DIVISI,
    };

    private static BookingKendaraan NewBookingKendaraan(string namaKendaraan, BookingStatusEnum status) => new()
    {
        Keperluan = "Dinas Test",
        NamaKendaraan = namaKendaraan,
        Divisi = "Test Division",
        Tanggal = new DateOnly(2026, 1, 1),
        Status = status,
        CreatedBy = 1,
        CreatedByRole = RoleEnum.ADMIN_DIVISI,
    };

    [Theory]
    [InlineData(BookingStatusEnum.DRAFT, true)]
    [InlineData(BookingStatusEnum.SUBMITTED, true)]
    [InlineData(BookingStatusEnum.APPROVED_L1, true)]
    [InlineData(BookingStatusEnum.APPROVED_GA_APPROVAL, true)]
    [InlineData(BookingStatusEnum.REJECTED_L1, false)]
    [InlineData(BookingStatusEnum.REJECTED_GA, false)]
    [InlineData(BookingStatusEnum.REJECTED_GA_APPROVAL, false)]
    [InlineData(BookingStatusEnum.CANCELLED, false)]
    public async Task Room_in_use_depends_on_whether_the_booking_status_is_a_dead_end(BookingStatusEnum status, bool expectedInUse)
    {
        await using var db = CreateContext();
        db.BookingRuangs.Add(NewBookingRuang("Ruang Test", status));
        await db.SaveChangesAsync();

        Assert.Equal(expectedInUse, await MeetingRoomAdminController.IsRoomInUse(db, "Ruang Test"));
    }

    [Fact]
    public async Task Room_not_referenced_by_any_booking_is_not_in_use()
    {
        await using var db = CreateContext();
        db.BookingRuangs.Add(NewBookingRuang("Ruang Lain", BookingStatusEnum.SUBMITTED));
        await db.SaveChangesAsync();

        Assert.False(await MeetingRoomAdminController.IsRoomInUse(db, "Ruang Test"));
    }

    [Fact]
    public async Task Room_used_only_as_an_additional_room_on_a_multi_room_booking_is_still_in_use()
    {
        await using var db = CreateContext();
        var primary = NewBookingRuang("Ruang Utama", BookingStatusEnum.SUBMITTED);
        db.BookingRuangs.Add(primary);
        await db.SaveChangesAsync();

        db.BookingRuangRooms.Add(new BookingRuangRoom { BookingRuangId = primary.Id, NamaRuang = "Ruang Tambahan" });
        await db.SaveChangesAsync();

        Assert.True(await MeetingRoomAdminController.IsRoomInUse(db, "Ruang Tambahan"));
    }

    [Fact]
    public async Task Room_used_only_as_an_additional_room_on_a_dead_end_booking_is_not_in_use()
    {
        await using var db = CreateContext();
        var primary = NewBookingRuang("Ruang Utama", BookingStatusEnum.CANCELLED);
        db.BookingRuangs.Add(primary);
        await db.SaveChangesAsync();

        db.BookingRuangRooms.Add(new BookingRuangRoom { BookingRuangId = primary.Id, NamaRuang = "Ruang Tambahan" });
        await db.SaveChangesAsync();

        Assert.False(await MeetingRoomAdminController.IsRoomInUse(db, "Ruang Tambahan"));
    }

    [Theory]
    [InlineData(BookingStatusEnum.DRAFT, true)]
    [InlineData(BookingStatusEnum.APPROVED_GA_APPROVAL, true)]
    [InlineData(BookingStatusEnum.REJECTED_GA_APPROVAL, false)]
    [InlineData(BookingStatusEnum.CANCELLED, false)]
    public async Task Vehicle_in_use_depends_on_whether_the_booking_status_is_a_dead_end(BookingStatusEnum status, bool expectedInUse)
    {
        await using var db = CreateContext();
        db.BookingKendaraans.Add(NewBookingKendaraan("Kendaraan Test", status));
        await db.SaveChangesAsync();

        Assert.Equal(expectedInUse, await VehicleAdminController.IsVehicleInUse(db, "Kendaraan Test"));
    }

    [Fact]
    public async Task Vehicle_not_referenced_by_any_booking_is_not_in_use()
    {
        await using var db = CreateContext();
        db.BookingKendaraans.Add(NewBookingKendaraan("Kendaraan Lain", BookingStatusEnum.SUBMITTED));
        await db.SaveChangesAsync();

        Assert.False(await VehicleAdminController.IsVehicleInUse(db, "Kendaraan Test"));
    }
}
