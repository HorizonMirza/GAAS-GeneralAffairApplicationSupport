namespace PengirimanApi.Models;

// Super Admin-managed lookup lists that used to be fixed C# enums (Kategori Kerusakan, Kategori
// Arsip, Kategori ATK, Tipe Booking, Asuransi, Pengemasan Tambahan) or free text with no catalog
// at all (Nama Barang ATK, Tahun Arsip) - see MasterDataCategories for the fixed set of Category
// values this table holds rows for. Key is what actually gets stored in the business table's own
// column (e.g. Pengiriman.AsuransiStatus); Label is only ever shown in the UI, so it can be
// renamed freely without touching any existing data. Extra is a second display-only value, only
// used by ATK_NAMA_BARANG today (the item's default Satuan).
public class MasterDataItem
{
    public int Id { get; set; }
    public string Category { get; set; } = null!;
    public string Key { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string? Extra { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
}

// The fixed set of lookup lists Super Admin can manage - each maps 1:1 to one column on one of
// the seven business tables (see MasterDataController's InUseChecks for exactly which one).
public static class MasterDataCategories
{
    public const string Asuransi = "ASURANSI";
    public const string Pengemasan = "PENGEMASAN";
    public const string TipeBooking = "TIPE_BOOKING";
    public const string AtkKategori = "ATK_KATEGORI";
    public const string AtkNamaBarang = "ATK_NAMA_BARANG";
    public const string KategoriKerusakan = "KATEGORI_KERUSAKAN";
    public const string ArchiveKategori = "ARCHIVE_KATEGORI";
    public const string ArsipTahun = "ARSIP_TAHUN";

    public static readonly string[] All =
    {
        Asuransi, Pengemasan, TipeBooking, AtkKategori, AtkNamaBarang, KategoriKerusakan, ArchiveKategori, ArsipTahun,
    };

    public static bool IsValid(string category) => All.Contains(category);
}
