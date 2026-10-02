using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;
using PengirimanApi.Hubs;
using PengirimanApi.Models;
using PengirimanApi.Services;
using QuestPDF.Infrastructure;

QuestPDF.Settings.License = LicenseType.Community;
JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
// Without this, SignalR's own JSON hub protocol (separate from MVC's AddJsonOptions above)
// serializes enums as their raw integer ordinal - every live chat/activity broadcast would
// carry senderRole as e.g. 6 instead of "KPU" until the page reloads and re-fetches over REST.
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

var connectionString = builder.Configuration.GetConnectionString("Default");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<CurrentUserService>();

builder.Services.AddAuthentication(GaasAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, GaasAuthenticationHandler>(GaasAuthenticationHandler.SchemeName, null);

builder.Services.AddSingleton<IAuthorizationHandler, SuperAdminRoleAuthorizationHandler>();
builder.Services.AddAuthorization();

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Default", policy =>
    {
        policy.WithOrigins(corsOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            JsonSerializer.Serialize(new { detail = "Terlalu banyak percobaan login. Silakan coba 1 menit lagi." }),
            cancellationToken);
    };

    options.AddPolicy("LoginRateLimit", httpContext =>
    {
        var ip = httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim();
        if (string.IsNullOrEmpty(ip))
            ip = httpContext.Request.Headers["X-Real-IP"].FirstOrDefault();
        if (string.IsNullOrEmpty(ip))
            ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });
});

var app = builder.Build();

// Execute structured database migration, schema synchronization, and cache initialization
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DatabaseMigrator.Migrate(db, app.Configuration);
}

if (args.Contains("resetdb"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // deletion_log/org_departemen/org_divisi/org_direktorat are this feature's own new tables,
    // appended here so they don't inherit the same "left off resetdb's list" gap that
    // notification_sound_settings and perbaikan_sarana_foto_kerusakan already have above (a
    // pre-existing bug in this same list, left untouched per product owner instruction).
    db.Database.ExecuteSqlRaw("DROP TABLE IF EXISTS chat_reads, chat_messages, booking_chat_reads, booking_chat_messages, booking_kendaraan_chat_reads, booking_kendaraan_chat_messages, booking_kendaraan_logs, booking_kendaraan, kendaraan_booking_counters, permintaan_atk_chat_reads, permintaan_atk_chat_messages, permintaan_atk_logs, permintaan_atk_items, permintaan_atk, atk_counters, perbaikan_sarana_chat_reads, perbaikan_sarana_chat_messages, perbaikan_sarana_logs, perbaikan_sarana, sarana_counters, permintaan_arsip_chat_reads, permintaan_arsip_chat_messages, permintaan_arsip_logs, permintaan_arsip_items, permintaan_arsip, arsip_counters, archive_documents, room_booking_counters, pengiriman_logs, invoice_logs, invoice_chat_reads, invoice_chat_messages, invoices, atk_invoice_log, atk_invoice_chat_reads, atk_invoice_chat_messages, atk_invoice, pengiriman, divisi_counters, booking_ruang_logs, booking_ruang_rooms, booking_ruang, deletion_log, admin_activity_log, impersonation_log, org_departemen, org_divisi, org_direktorat, meeting_room, vehicle, users CASCADE;");
    DbSeeder.Seed(db);
    return;
}

if (args.Contains("seed"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DbSeeder.Seed(db);
    return;
}

// Housekeeping sweep for files on disk that no database row points at any more - see
// Services/PembersihFileYatim.cs for where they come from. Reports only unless --apply is given.
//
//   dotnet run -- bersihkan-file-yatim
//   dotnet run -- bersihkan-file-yatim --apply
//   dotnet run -- bersihkan-file-yatim --apply --min-umur-jam=72
if (args.Contains("bersihkan-file-yatim"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var umurMinimumJam = PembersihFileYatim.DefaultUmurMinimumJam;
    var argUmur = args.FirstOrDefault(a => a.StartsWith("--min-umur-jam=", StringComparison.Ordinal));
    if (argUmur != null && !int.TryParse(argUmur["--min-umur-jam=".Length..], out umurMinimumJam))
    {
        Console.Error.WriteLine($"Nilai {argUmur} tidak valid - harus angka jam, misalnya --min-umur-jam=72");
        Environment.ExitCode = 1;
        return;
    }
    if (umurMinimumJam < 0)
    {
        Console.Error.WriteLine("--min-umur-jam tidak boleh negatif.");
        Environment.ExitCode = 1;
        return;
    }

    await PembersihFileYatim.JalankanAsync(
        db,
        app.Configuration,
        apply: args.Contains("--apply"),
        umurMinimumJam,
        Console.Out);
    return;
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Default");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.Run();
