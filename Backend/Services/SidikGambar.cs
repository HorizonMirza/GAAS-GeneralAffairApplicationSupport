namespace PengirimanApi.Services;

// Both the filename extension and the browser-supplied Content-Type are attacker-controlled: a
// text file renamed to "bukti.png" satisfies either check, gets stored, and is then served back
// under an image/* Content-Type. Reading the first bytes is what actually establishes that a
// file is the image it claims to be - the same approach InvoiceController.LooksLikePdfAsync
// takes with "%PDF-", and the same thing ImageSharp does implicitly in ProfileController.
public static class SidikGambar
{
    // The longest signature checked below is WebP's 12-byte "RIFF....WEBP".
    private const int UkuranHeader = 12;

    private static readonly byte[] Png = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
    private static readonly byte[] Gif87a = "GIF87a"u8.ToArray();
    private static readonly byte[] Gif89a = "GIF89a"u8.ToArray();
    private static readonly byte[] Riff = "RIFF"u8.ToArray();
    private static readonly byte[] Webp = "WEBP"u8.ToArray();

    // Returns the real media type of the uploaded bytes, or null when they are not an image we
    // recognise. Reads only the header, so it costs nothing on a 10 MB upload.
    public static async Task<string?> DeteksiTipeAsync(IFormFile file)
    {
        var header = new byte[UkuranHeader];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAsync(header.AsMemory(0, UkuranHeader));
        return DeteksiTipe(header.AsSpan(0, read));
    }

    public static string? DeteksiTipe(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
            return "image/jpeg";
        if (header.Length >= 8 && header[..8].SequenceEqual(Png))
            return "image/png";
        if (header.Length >= 6 && (header[..6].SequenceEqual(Gif87a) || header[..6].SequenceEqual(Gif89a)))
            return "image/gif";
        if (header.Length >= 12 && header[..4].SequenceEqual(Riff) && header[8..12].SequenceEqual(Webp))
            return "image/webp";
        return null;
    }
}
