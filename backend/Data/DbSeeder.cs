using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Data;

public static class DbSeeder
{
    private record Account(string Username, string Password, string Nama, RoleEnum Role, string? Direktorat, string? Divisi, string? Departemen);

    private const string DefaultPassword = "123456789";

    private static List<Account> BuildAccounts()
    {
        var accounts = new List<Account>();

        foreach (var direktorat in OrgTree.Tree)
        {
            foreach (var divisi in direktorat.Divisi)
            {
                accounts.Add(new(divisi.AdminUsername, DefaultPassword, divisi.Nama, RoleEnum.ADMIN_DIVISI, direktorat.Nama, divisi.Nama, null));
                accounts.Add(new(divisi.ApprovalUsername, DefaultPassword, divisi.Nama, RoleEnum.APPROVAL_DIVISI, direktorat.Nama, divisi.Nama, null));

                foreach (var departemen in divisi.Departemen)
                {
                    accounts.Add(new(departemen.AdminUsername, DefaultPassword, departemen.Nama, RoleEnum.ADMIN_DEPARTEMEN, direktorat.Nama, divisi.Nama, departemen.Nama));
                    accounts.Add(new(departemen.ApprovalUsername, DefaultPassword, departemen.Nama, RoleEnum.APPROVAL_DEPARTEMEN, direktorat.Nama, divisi.Nama, departemen.Nama));
                }
            }
        }

        accounts.Add(new("AdminGeneralAffair", DefaultPassword, "Admin General Affair", RoleEnum.ADMIN_GA, null, null, null));
        accounts.Add(new("ApprovalGeneralAffair", DefaultPassword, "Approval General Affair", RoleEnum.APPROVAL_GA, null, null, null));
        accounts.Add(new("KPU", DefaultPassword, "KPU", RoleEnum.KPU, null, null, null));
        accounts.Add(new("SuperAdminGAAS", DefaultPassword, "Super Admin", RoleEnum.SUPER_ADMIN, null, null, null));

        return accounts;
    }

    public static void Seed(AppDbContext db)
    {
        db.Database.EnsureCreated();

        var accounts = BuildAccounts();
        var created = 0;
        foreach (var account in accounts)
        {
            var existing = db.Users.FirstOrDefault(u => u.Username == account.Username);
            if (existing != null) continue;

            db.Users.Add(new User
            {
                Username = account.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(account.Password),
                Nama = account.Nama,
                Role = account.Role,
                Direktorat = account.Direktorat,
                Divisi = account.Divisi,
                Departemen = account.Departemen,
            });
            created++;
        }
        db.SaveChanges();
        Console.WriteLine($"Seed selesai. {created} akun baru dibuat, {accounts.Count - created} sudah ada. Total akun: {accounts.Count}.");
    }
}
