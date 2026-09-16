using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PengirimanApi.Data;

namespace PengirimanApi.Services;

// Housekeeping for files on disk that nothing in the database points at any more.
//
// Two things left them behind. Until recently no delete path in Maintenance removed the images a
// laporan owned, so every deletion orphaned up to seven files; that is fixed, but the pile it
// already made is still there. And re-uploading a photo or drawing, or stepping an eksekusi back
// with eksekusi/reset, deliberately keeps the superseded file - a convention documented at those
// call sites, which this sweeps up afterwards rather than changing.
//
// Run via `dotnet run -- bersihkan-file-yatim`. Reports only; add `--apply` to actually delete.
public static class PembersihFileYatim
{
    private static readonly CultureInfo Indonesia = new("id-ID");

    // Never touch a file younger than this. An upload writes the file before the row that points
    // at it is committed, so a file created seconds ago can look orphaned while its request is
    // still in flight. A whole day of slack costs nothing on a sweep that runs at most monthly.
    public const int DefaultUmurMinimumJam = 24;

    private sealed class Cakupan
    {
        public required string Nama { get; init; }
        public required string Folder { get; init; }
        // Every path any DB row currently points at, as stored (a bare filename, not a full path).
        public required HashSet<string> Terpakai { get; init; }
    }

    private sealed class Hasil
    {
        public required string Nama { get; init; }
        public required string Folder { get; init; }
        public int FileDiDisk { get; set; }
        public int Terpakai { get; set; }
        public int TerlaluBaru { get; set; }
        public List<FileInfo> Yatim { get; } = new();
        public long BytesYatim => Yatim.Sum(f => f.Length);
    }

    public static async Task JalankanAsync(
        AppDbContext db,
        IConfiguration config,
        bool apply,
        int umurMinimumJam,
        TextWriter keluaran)
    {
        var batasWaktu = DateTime.UtcNow - TimeSpan.FromHours(umurMinimumJam);

        var cakupan = new[]
        {
            new Cakupan
            {
                Nama = "Maintenance (foto kerusakan, gambar rencana, foto selesai)",
                Folder = DirektoriUnggahan.Resolve(config, DirektoriUnggahan.KunciSarana, DirektoriUnggahan.DefaultSarana),
                Terpakai = Gabung(
                    await db.PerbaikanSaranaFotoKerusakans.Select(f => (string?)f.FilePath).ToListAsync(),
                    await db.PerbaikanSaranas.Select(p => p.GambarFilePath).ToListAsync(),
                    await db.PerbaikanSaranas.Select(p => p.FotoSelesaiFilePath).ToListAsync()),
            },
            new Cakupan
            {
                Nama = "Invoice (file terkini + setiap revisi di invoice_logs)",
                Folder = DirektoriUnggahan.Resolve(config, DirektoriUnggahan.KunciInvoice, DirektoriUnggahan.DefaultInvoice),
                Terpakai = Gabung(
                    await db.Invoices.Select(i => (string?)i.FilePath).ToListAsync(),
                    await db.InvoiceLogs.Select(l => l.FilePath).ToListAsync()),
            },
            new Cakupan
            {
                Nama = "Foto profil (foto akun + cover)",
                Folder = DirektoriUnggahan.Resolve(config, DirektoriUnggahan.KunciFotoProfil, DirektoriUnggahan.DefaultFotoProfil),
                Terpakai = Gabung(
                    await db.Users.Select(u => u.PhotoPath).ToListAsync(),
                    await db.Users.Select(u => u.CoverPhotoPath).ToListAsync()),
            },
        };

        keluaran.WriteLine();
        keluaran.WriteLine(apply
            ? "PEMBERSIHAN FILE YATIM - MODE HAPUS"
            : "PEMBERSIHAN FILE YATIM - MODE LAPORAN (tidak ada file yang dihapus)");
        keluaran.WriteLine($"File yang lebih baru dari {umurMinimumJam} jam dilewati.");
        keluaran.WriteLine(new string('-', 78));

        var semua = new List<Hasil>();
        foreach (var c in cakupan)
        {
            var hasil = new Hasil { Nama = c.Nama, Folder = c.Folder };
            semua.Add(hasil);

            if (!Directory.Exists(c.Folder))
            {
                keluaran.WriteLine($"\n{c.Nama}\n  {c.Folder}\n  Folder tidak ada - dilewati.");
                continue;
            }

            // Top level only, and only real files: a subfolder or symlink here is not something
            // this module wrote, so it is not this script's business to delete.
            foreach (var berkas in new DirectoryInfo(c.Folder).EnumerateFiles())
            {
                if (berkas.LinkTarget != null) continue;
                hasil.FileDiDisk++;
                if (c.Terpakai.Contains(berkas.Name)) { hasil.Terpakai++; continue; }
                if (berkas.CreationTimeUtc > batasWaktu || berkas.LastWriteTimeUtc > batasWaktu)
                {
                    hasil.TerlaluBaru++;
                    continue;
                }
                hasil.Yatim.Add(berkas);
            }

            keluaran.WriteLine();
            keluaran.WriteLine(c.Nama);
            keluaran.WriteLine($"  Folder        : {c.Folder}");
            keluaran.WriteLine($"  File di disk  : {N(hasil.FileDiDisk)}");
            keluaran.WriteLine($"  Masih dipakai : {N(hasil.Terpakai)} (dari {N(c.Terpakai.Count)} path terdaftar di database)");
            keluaran.WriteLine($"  Terlalu baru  : {N(hasil.TerlaluBaru)}");
            keluaran.WriteLine($"  Yatim         : {N(hasil.Yatim.Count)} ({Ukuran(hasil.BytesYatim)})");

            // A path in the database with no file behind it is the opposite problem - nothing to
            // delete, but worth saying out loud, because it means a detail page somewhere is
            // showing a broken image.
            var hilang = c.Terpakai.Count(p => !System.IO.File.Exists(Path.Combine(c.Folder, p)));
            if (hilang > 0)
                keluaran.WriteLine($"  PERHATIAN     : {N(hilang)} path terdaftar di database tapi filenya tidak ada di disk.");

            foreach (var f in hasil.Yatim.OrderByDescending(f => f.Length).Take(10))
                keluaran.WriteLine($"    - {f.Name}  {Ukuran(f.Length)}  {f.LastWriteTimeUtc:yyyy-MM-dd}");
            if (hasil.Yatim.Count > 10)
                keluaran.WriteLine($"    ... dan {N(hasil.Yatim.Count - 10)} file lainnya");
        }

        var totalYatim = semua.Sum(h => h.Yatim.Count);
        var totalBytes = semua.Sum(h => h.BytesYatim);

        keluaran.WriteLine();
        keluaran.WriteLine(new string('-', 78));
        keluaran.WriteLine($"Total yatim: {N(totalYatim)} file, {Ukuran(totalBytes)}");

        if (totalYatim == 0)
        {
            keluaran.WriteLine("Tidak ada yang perlu dibersihkan.");
            return;
        }

        if (!apply)
        {
            keluaran.WriteLine();
            keluaran.WriteLine("Belum ada yang dihapus. Periksa angka di atas - terutama \"Masih dipakai\",");
            keluaran.WriteLine("yang harus masuk akal dibanding jumlah data yang ada. Kalau sudah yakin:");
            keluaran.WriteLine("  dotnet run -- bersihkan-file-yatim --apply");
            return;
        }

        var terhapus = 0;
        var gagal = 0;
        foreach (var hasil in semua)
        {
            foreach (var berkas in hasil.Yatim)
            {
                try
                {
                    berkas.Delete();
                    terhapus++;
                }
                catch (Exception ex)
                {
                    // One unreadable file must not abandon the rest of the sweep.
                    gagal++;
                    keluaran.WriteLine($"  GAGAL menghapus {berkas.FullName}: {ex.Message}");
                }
            }
        }

        keluaran.WriteLine();
        keluaran.WriteLine($"Selesai. {N(terhapus)} file dihapus, {Ukuran(totalBytes)} dibebaskan." + (gagal > 0 ? $" {N(gagal)} gagal." : ""));
    }

    private static HashSet<string> Gabung(params List<string?>[] kumpulan) =>
        kumpulan.SelectMany(k => k)
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => p!.Trim())
            .ToHashSet(StringComparer.Ordinal);

    private static string N(int n) => n.ToString("N0", Indonesia);

    private static string Ukuran(long bytes)
    {
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{(bytes / 1024.0).ToString("N1", Indonesia)} KB";
        return $"{(bytes / 1024.0 / 1024.0).ToString("N1", Indonesia)} MB";
    }
}
