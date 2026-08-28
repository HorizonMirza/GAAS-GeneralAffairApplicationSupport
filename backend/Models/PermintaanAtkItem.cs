namespace PengirimanApi.Models;

// Satu baris barang di dalam sebuah permintaan ATK (pulpen 5 pcs, kertas A4 2 rim, dst).
public class PermintaanAtkItem
{
    public int Id { get; set; }
    public int PermintaanAtkId { get; set; }
    public string NamaBarang { get; set; } = null!;
    public int Jumlah { get; set; }
    public string Satuan { get; set; } = null!;

    public PermintaanAtk PermintaanAtk { get; set; } = null!;
}
