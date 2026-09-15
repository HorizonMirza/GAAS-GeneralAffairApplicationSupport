using Microsoft.AspNetCore.Mvc;
using PengirimanApi.Data;
using PengirimanApi.Services;
using System.Net.Mime;

namespace PengirimanApi.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly string _uploadDir;

    public UsersController(AppDbContext db, CurrentUserService currentUser, IConfiguration config) : base(currentUser)
    {
        _db = db;
        // Same upload dir as ProfileController - both read the photo files it writes.
        var configured = config.GetValue<string>("ProfilePhotoUploadDir") ?? "uploads/profile-photos";
        _uploadDir = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(AppContext.BaseDirectory, "..", "..", "..", configured);
        _uploadDir = Path.GetFullPath(_uploadDir);
    }

    // Any logged-in user can view another user's profile photo, same visibility as their name -
    // which already appears app-wide on every approval log, notification, and chat message.
    [HttpGet("{id:int}/photo")]
    public async Task<IActionResult> GetPhoto(int id)
    {
        var (_, error) = await RequireRoleAsync();
        if (error != null) return error;

        var user = await _db.Users.FindAsync(id);
        if (user?.PhotoPath == null)
            return NotFound(new { detail = "Belum ada foto profil" });

        var path = Path.Combine(_uploadDir, user.PhotoPath);
        if (!System.IO.File.Exists(path))
            return NotFound(new { detail = "File foto tidak ditemukan di server" });

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        var cd = new ContentDisposition { Inline = true, FileName = user.PhotoOriginalFilename ?? user.PhotoPath };
        Response.Headers["Content-Disposition"] = cd.ToString();
        return File(bytes, user.PhotoContentType ?? "application/octet-stream");
    }
}
