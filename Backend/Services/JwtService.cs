using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using PengirimanApi.Models;

namespace PengirimanApi.Services;

public class JwtService
{
    private readonly string _secretKey;
    private readonly int _expireMinutes;

    static JwtService()
    {
        JwtSecurityTokenHandler.DefaultMapInboundClaims = false;
    }

    public JwtService(IConfiguration configuration)
    {
        _secretKey = configuration["Jwt:SecretKey"] ?? throw new InvalidOperationException("Jwt:SecretKey missing");
        _expireMinutes = int.Parse(configuration["Jwt:ExpireMinutes"] ?? "480");
    }

    public int ExpireMinutes => _expireMinutes;

    // passwordChangedAt is stamped in as a claim so CurrentUserService can reject a token minted
    // before the account's most recent password change (see User.PasswordChangedAt) - null (the
    // account has never had its password changed since this column existed) omits the claim, and
    // CurrentUserService treats "no claim" the same as "matches" for that same reason.
    public string CreateAccessToken(int userId, RoleEnum role, DateTime? passwordChangedAt = null)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim("sub", userId.ToString()),
            new Claim("role", role.ToString()),
        };
        if (passwordChangedAt.HasValue)
            claims.Add(new Claim("pwd_at", passwordChangedAt.Value.Ticks.ToString()));

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_expireMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public ClaimsPrincipal? Validate(string token)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ClockSkew = TimeSpan.FromSeconds(30),
            }, out _);
            return principal;
        }
        catch
        {
            return null;
        }
    }
}
