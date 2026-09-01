namespace PengirimanApi.Models;

// Satu baris arsip di dalam sebuah permintaan pemindahan (5 boks berkas kontrak 2018-2019, dst).
public class PermintaanArsipItem
{
    public int Id { get; set; }
    public int PermintaanArsipId { get; set; }
    public string NamaArsip { get; set; } = null!;
    public ArchiveKategoriEnum Kategori { get; set; }
    public string TahunArsip { get; set; } = null!;
    public int Jumlah { get; set; }
    public string Satuan { get; set; } = null!;

    public PermintaanArsip PermintaanArsip { get; set; } = null!;
}
