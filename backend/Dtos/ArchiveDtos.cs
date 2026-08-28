using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public class ArchiveDocumentOut
{
    public int Id { get; set; }
    public string NamaDokumen { get; set; } = null!;
    public ArchiveKategoriEnum Kategori { get; set; }
    public string OriginalFilename { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long FileSizeBytes { get; set; }
    public string? Catatan { get; set; }
    public string Divisi { get; set; } = null!;
    public string? Departemen { get; set; }
    public int UploadedBy { get; set; }
    // Null unless the query that produced this document included Pengunggah (see
    // ArchiveController.List) - actions that only touch one document by id skip that Include.
    public string? UploaderNama { get; set; }
    public RoleEnum UploadedByRole { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public static ArchiveDocumentOut From(ArchiveDocument a) => new()
    {
        Id = a.Id,
        NamaDokumen = a.NamaDokumen,
        Kategori = a.Kategori,
        OriginalFilename = a.OriginalFilename,
        ContentType = a.ContentType,
        FileSizeBytes = a.FileSizeBytes,
        Catatan = a.Catatan,
        Divisi = a.Divisi,
        Departemen = a.Departemen,
        UploadedBy = a.UploadedBy,
        UploaderNama = a.Pengunggah?.Nama,
        UploadedByRole = a.UploadedByRole,
        CreatedAt = a.CreatedAt,
        UpdatedAt = a.UpdatedAt,
    };
}

public class ArchiveDocumentListResponse
{
    public List<ArchiveDocumentOut> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int Limit { get; set; }
}
