using Microsoft.AspNetCore.Http;
using PengirimanApi.Services;

namespace PengirimanApi.Tests;

public class ChatImageStorageTests
{
    private static IFormFile CreateMockFormFile(byte[] content, string fileName, string contentType)
    {
        var stream = new MemoryStream(content);
        return new FormFile(stream, 0, content.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    [Fact]
    public async Task Valid_png_file_passes_validation()
    {
        var pngHeader = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D };
        var file = CreateMockFormFile(pngHeader, "test.png", "image/png");

        var (ok, detectedType, error) = await ChatImageStorage.ValidateAsync(file);

        Assert.True(ok);
        Assert.Equal("image/png", detectedType);
        Assert.Null(error);
    }

    [Fact]
    public async Task Valid_jpeg_file_passes_validation()
    {
        var jpegHeader = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01 };
        var file = CreateMockFormFile(jpegHeader, "photo.jpg", "image/jpeg");

        var (ok, detectedType, error) = await ChatImageStorage.ValidateAsync(file);

        Assert.True(ok);
        Assert.Equal("image/jpeg", detectedType);
        Assert.Null(error);
    }

    [Fact]
    public async Task Fake_image_claiming_image_png_is_rejected_by_magic_bytes()
    {
        // Text/HTML/Executable content disguised as image/png
        var maliciousContent = System.Text.Encoding.UTF8.GetBytes("<?php echo 'malicious'; ?>");
        var file = CreateMockFormFile(maliciousContent, "shell.png", "image/png");

        var (ok, detectedType, error) = await ChatImageStorage.ValidateAsync(file);

        Assert.False(ok);
        Assert.Null(detectedType);
        Assert.Contains("bukan gambar yang didukung", error);
    }

    [Fact]
    public async Task Empty_file_is_rejected()
    {
        var file = CreateMockFormFile(Array.Empty<byte>(), "empty.png", "image/png");

        var (ok, _, error) = await ChatImageStorage.ValidateAsync(file);

        Assert.False(ok);
        Assert.Equal("File gambar wajib diunggah", error);
    }

    [Fact]
    public async Task SaveAsync_throws_exception_on_invalid_magic_bytes()
    {
        var fakeBytes = System.Text.Encoding.UTF8.GetBytes("MZ executable header dummy test");
        var file = CreateMockFormFile(fakeBytes, "program.exe", "image/png");

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await ChatImageStorage.SaveAsync(file, Path.GetTempPath());
        });
    }
}
