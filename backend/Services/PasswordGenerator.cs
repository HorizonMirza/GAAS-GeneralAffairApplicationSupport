using System.Security.Cryptography;

namespace PengirimanApi.Services;

// One-time plaintext passwords for Super Admin-created/reset accounts (see UsersAdminController,
// OrgAdminController's auto-provisioning) - RandomNumberGenerator rather than System.Random,
// which is not cryptographically secure and unsuitable for anything that gates account access.
public static class PasswordGenerator
{
    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lower = "abcdefghijkmnopqrstuvwxyz";
    private const string Digits = "23456789";
    private const string Special = "!@#$%^&*";
    private const string All = Upper + Lower + Digits + Special;

    // Guarantees at least one of each character class ProfileController.ChangePassword's own
    // complexity checklist requires, so a generated password would satisfy that checklist too if
    // the person it's handed to ever re-typed it there verbatim.
    public static string Generate(int length = 12)
    {
        var chars = new char[length];
        chars[0] = Upper[RandomNumberGenerator.GetInt32(Upper.Length)];
        chars[1] = Lower[RandomNumberGenerator.GetInt32(Lower.Length)];
        chars[2] = Digits[RandomNumberGenerator.GetInt32(Digits.Length)];
        chars[3] = Special[RandomNumberGenerator.GetInt32(Special.Length)];
        for (var i = 4; i < length; i++)
            chars[i] = All[RandomNumberGenerator.GetInt32(All.Length)];

        // Fisher-Yates shuffle so the four guaranteed characters above aren't always in the same
        // four positions.
        for (var i = chars.Length - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }
        return new string(chars);
    }
}
