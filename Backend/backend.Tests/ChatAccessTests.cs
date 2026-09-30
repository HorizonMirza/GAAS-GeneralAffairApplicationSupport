using PengirimanApi.Hubs;
using PengirimanApi.Models;

namespace PengirimanApi.Tests;

public class ChatAccessTests
{
    [Fact]
    public void Mitra_can_join_office_supplies_chat()
    {
        var mitra = new AccessUser(10, RoleEnum.KPU, null, null);
        var request = new PermintaanAtk
        {
            CreatedBy = 20,
            Divisi = "General Affairs",
            NamaPemohon = "Pemohon",
            NoTeleponPemohon = "0800000000",
            Keperluan = "Alat tulis",
            Status = StatusEnum.APPROVED_GA_APPROVAL,
        };

        Assert.True(ChatHub.CanJoinAtkChat(mitra, request));
    }

    [Fact]
    public void A_different_department_cannot_join_another_units_draft_chat()
    {
        var user = new AccessUser(10, RoleEnum.ADMIN_DEPARTEMEN, "Operasi", "Departemen A");
        var request = new PermintaanAtk
        {
            CreatedBy = 20,
            Divisi = "Operasi",
            Departemen = "Departemen B",
            NamaPemohon = "Pemohon",
            NoTeleponPemohon = "0800000000",
            Keperluan = "Alat tulis",
            Status = StatusEnum.DRAFT,
        };

        Assert.False(ChatHub.CanJoinAtkChat(user, request));
    }
}
