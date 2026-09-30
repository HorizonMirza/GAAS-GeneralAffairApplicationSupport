namespace PengirimanApi.Services;

// Shared upload/validate/serve logic for chat image attachments, used by ChatController,
// BookingChatController, and BookingKendaraanChatController - identical rules across all three
// chat threads (Ekspedisi, Room Booking, Vehicle Booking), so it lives in one place instead of
// being copy-pasted three times.
public static class ChatImageStorage
{
    public const long MaxSizeBytes = 10 * 1024 * 1024; // 10 MB

    private static readonly Dictionary<string, string> AllowedContentTypes = new()
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
        ["image/gif"] = ".gif",
    };

    public static string ResolveUploadDir(IConfiguration config)
    {
        var configured = config.GetValue<string>("ChatUploadDir") ?? "uploads/chat";
        var dir = Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(AppContext.BaseDirectory, "..", "..", "..", configured);
        dir = Path.GetFullPath(dir);
        Directory.CreateDirectory(dir);
        return dir;
    }

    public static bool IsAllowedContentType(string? contentType) => contentType != null && AllowedContentTypes.ContainsKey(contentType);

    public static async Task<string> SaveAsync(IFormFile image, string uploadDir)
    {
        var ext = AllowedContentTypes[image.ContentType];
        var storedFilename = $"{Guid.NewGuid():N}{ext}";
        var destPath = Path.Combine(uploadDir, storedFilename);
        using (var stream = File.Create(destPath))
        {
            await image.CopyToAsync(stream);
        }
        return storedFilename;
    }

    public static string ContentTypeFor(string storedFilename)
    {
        var ext = Path.GetExtension(storedFilename).ToLowerInvariant();
        return ext switch
        {
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => "image/jpeg",
        };
    }
}
