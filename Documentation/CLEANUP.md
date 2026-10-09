# Laporan Pembersihan Kode GAAS

Tanggal verifikasi: 9 Oktober 2026.

Catatan: bagian awal mencatat cleanup pada commit `38aa497`. Hasil pemeriksaan
terbaru ada pada bagian [Audit Ulang](#audit-ulang-setelah-38aa497) di bawah.

## Ringkasan

Pembersihan dilakukan pada 22 file frontend. Tidak ada file/folder utuh atau
dependensi yang dihapus: audit tidak menemukan bukti bahwa item tersebut sudah
tidak dipakai. Yang dihapus adalah bagian kode demo, parameter yang tidak dibaca,
state pendukungnya, dan CSS tanpa pemakai. Fitur dan layout aktif dipertahankan.

## Daftar Yang Dihapus

### 1. Sisa Galeri Foto Demo

- Empat deklarasi array `DEMO_ROOM_PHOTOS` / `DEMO_VEHICLE_PHOTOS`.
- Empat helper `roomPhotoUrls` / `vehiclePhotoUrls` yang menambahkan foto milik
  ruangan/kendaraan lain sebagai pengisi slideshow.
- Kontrak array `photoUrls` pada `RoomInfoModal`, diganti satu `photoUrl`.
- Komentar lama tentang slideshow dan fasilitas placeholder yang tidak lagi
  sesuai implementasi.

Lokasi: halaman overview Room Booking, overview Vehicle Booking, Super Admin,
dan `Frontend/src/components/RoomInfoModal.tsx`.

Alasan: modal hanya menampilkan foto pertama. Helper URL foto utama dan seluruh
aset foto tetap digunakan; hasil foto yang terlihat tidak berubah.

### 2. Parameter Komponen Yang Tidak Pernah Dibaca

| Komponen | Parameter yang dihapus |
|---|---|
| `RoomInfoModal` | `availability`, `availLabel`, beserta tipe `RoomInfoAvailability` |
| `BookingStatusBadge` | `rejectTarget`, `isRoom`, `isKendaraan` |
| `RoomBookingStepper` | `rejectTarget` |
| `ChatModal` | `createdByRole` |
| `AtkChatModal` | `createdByRole` |
| `SaranaChatModal` | `createdByRole` |
| `ArsipChatModal` | `createdByRole` |

Pemanggilan parameter tersebut ikut dihapus dari halaman overview/transaksi
enam modul, halaman Super Admin, dan pemanggil chat global. Perhitungan
ketersediaan yang sebelumnya hanya dikirim ke parameter modal yang diabaikan
juga dihapus. Indikator ketersediaan pada kartu tetap berfungsi.

Ini tidak menghapus `createdByRole` atau `rejectTarget` dari model transaksi,
API, database, atau komponen lain yang masih membutuhkannya. Logika approval,
akses pengguna, pembatalan, badge, dan langkah proses tidak diubah.

### 3. Data Pendukung Chat Yang Tidak Dipakai

- Field `createdByRole` pada state `ResolvedChat` di `GlobalChatModal`.
- Delapan pengisian field tersebut ketika membuka chat berbagai modul.
- Lima import tipe `Role` yang menjadi tidak diperlukan pada komponen chat.

Alasan: field tersebut hanya diteruskan ke parameter chat yang tidak dibaca.
Peserta chat tetap ditentukan oleh departemen dan aturan modul yang sama.

### 4. CSS Lama Tanpa Pemakai

Lima kelas berikut dihapus dari `Frontend/src/app/globals.css`:

- `.room-card-icon`
- `.room-info-photo` (termasuk aturan `:hover`)
- `.room-info-row-stack`
- `.room-info-slots`
- `.room-info-slot-chip`

Total enam aturan CSS. Kelas aktif seperti `.room-info-photo-icon` dan
`.room-info-row` dipertahankan.

## Yang Diperiksa Dan Dipertahankan

- Graf import 137 file TypeScript/TSX: tidak ditemukan file sumber terputus
  dari entrypoint aplikasi. File konvensi Next.js tetap dianggap entrypoint.
- Metode API frontend, referensi kelas/metode backend, dan dependensi paket.
- Aset yang dipanggil menggunakan nama dinamis; kelas badge/status dinamis;
  metode SignalR yang dipanggil melalui nama string.
- Database, upload pengguna, seed/master data, pengujian, konfigurasi lingkungan,
  Docker, Nginx, CI, dokumentasi, dan panduan agen.
- `node_modules`, `.next`, `bin`, dan `obj` merupakan keluaran instalasi/build,
  bukan bukti fitur demo yang ditinggalkan; tidak dihapus dalam perubahan ini.

Audit statis tidak dapat membuktikan seluruh kemungkinan pemakaian dinamis.
Item yang masih ambigu tidak dihapus hanya karena namanya terlihat lama/demo.

## Hasil Verifikasi

- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters --incremental false`: lulus.
- `npm run lint`: lulus.
- `npm run build`: lulus, 29 halaman statis berhasil dihasilkan.
- `dotnet test Backend/backend.Tests/PengirimanApi.Tests.csproj --no-restore --configuration Release`:
  52 lulus, 0 gagal, 0 dilewati; menggunakan database in-memory pengujian.
- 24 pemeriksaan browser pada ukuran 390x844, 575x767, dan 1559x975: lulus.
  Mencakup foto/modal Room Booking dan Vehicle Booking (halaman biasa dan
  Super Admin), serta modal chat Expedition, Office Supplies, Maintenance,
  dan Archive. Foto utama cocok dengan kartu, semua foto kartu termuat,
  modal muat secara horizontal, dan tidak ada exception JavaScript.
- Frontend `http://localhost:3000` dan backend `http://localhost:8000/api/health`:
  HTTP 200.

## Audit Ulang Setelah 38aa497

Audit ini dimulai dari working tree bersih pada `main`, commit `38aa497`.
Tidak ada perubahan pengguna yang ditimpa. Hasil audit ulang tidak dihitung
sebagai penghapusan ulang terhadap item pada bagian sebelumnya.

### Penghapusan Baru

| File | Item yang dihapus | Bukti dan alasan |
|---|---|---|
| `Backend/Services/WaktuWib.cs` | Overload `Pendek(DateTime? utc)` | Analisis simbol Roslyn terhadap kode backend dan tes menemukan nol pemanggil. Empat controller ekspor memakai overload `Pendek(DateTime utc)`, yang tetap dipertahankan. |
| `Frontend/src/app/globals.css` | Aturan `.overview-status-filter-field select`, komentar terkait, dan gambar panah SVG inline milik aturan itu | Seluruh 12 pemakai wrapper filter status memakai `SearchableSelect`, yang merender tombol, bukan elemen `select`. |
| `Frontend/src/app/globals.css` | Cabang selector responsif `.overview-status-filter-field select` dan `.overview-status-filter-field .filter-picker-trigger` | Tidak ada elemen yang cocok pada seluruh 12 pemakai, baik dropdown tertutup maupun terbuka. Aturan lebar untuk `.searchable-select-trigger` tetap dipertahankan. |

Total kode sumber berkurang bersih 20 baris. Tidak ada file/folder utuh, aset
file, paket npm, atau paket NuGet yang dihapus. Tidak ada perubahan lockfile.

File yang diubah pada audit ulang ini:

- `Backend/Services/WaktuWib.cs`
- `Frontend/src/app/globals.css`
- `Documentation/CLEANUP.md` (laporan ini)

### Cakupan Audit

- Graf import, export, API wrapper, dan parameter komponen pada 137 file
  TypeScript/TSX. Tidak ditemukan file sumber yang terputus dari entrypoint.
- Analisis simbol C# pada 142 berkas, termasuk tes dan satu berkas global using
  hasil build, dengan nol error resolusi/kompilasi. Kandidat hasil pencarian
  dipilah berdasarkan atribut route, override framework, dan pemanggilan dinamis.
- Selector kelas CSS diperiksa terhadap literal/identifier kode, bukan hanya
  teks komentar. Selector filter lama diperiksa lebih lanjut terhadap struktur
  komponen dan DOM browser.
- Manifest dependensi, import paket, konfigurasi Next/PostCSS/Tailwind, proyek
  .NET, CI, Docker, Nginx, seed, dan cara pembentukan URL aset diperiksa.
- Skrip audit, log, screenshot, dan hasil ekspor pengujian disimpan di luar
  repository, bukan ditambahkan sebagai kode aplikasi atau file demo baru.

### Item Yang Dipertahankan

| Item | Alasan |
|---|---|
| `ApproveKpuRequest.Total` | Tidak dibaca controller secara langsung, tetapi masih dikirim frontend dalam payload approval/koreksi harga dan termasuk kontrak API. Tidak dihapus tanpa perubahan kontrak yang disengaja. |
| Tipe frontend yang hanya dipakai lokal | Definisi tipe masih dipakai; ketiadaan import eksternal bukan alasan menghapus definisinya. |
| Action controller, metode SignalR, override EF/authentication | Dipanggil lewat routing, nama metode string, atau lifecycle framework, bukan selalu melalui panggilan C# langsung. |
| CSS badge/log dinamis dan token Tailwind | Kelas dibentuk dari status; token dipakai oleh utilitas Tailwind yang dihasilkan saat build. |
| 20 foto ruangan/kendaraan | URL dibentuk dari slug nama master data. Semuanya termuat saat pemeriksaan browser. |
| `Frontend/components.json` dan konfigurasi operasional lainnya | Konfigurasi tooling bukan modul runtime; tidak ada bukti bahwa workflow pemakainya telah ditinggalkan. |
| Global using pada `obj/` yang ditandai tidak diperlukan | Berkas hasil build milik SDK, bukan kode sumber yang perlu diedit manual. |
| Database, upload, seed, migration, tests, dan direktori hasil build | Dilindungi sesuai cakupan tugas; tidak dihapus atau direset. |

### Verifikasi Audit Ulang

- TypeScript dengan `--noUnusedLocals --noUnusedParameters`: lulus.
- Lint frontend: lulus.
- Build produksi frontend setelah perubahan CSS: lulus, 29 halaman statis.
- Build backend Release setelah penghapusan overload: lulus, 0 warning/error.
- Tes backend Release: 52 lulus, 0 gagal, 0 dilewati.
- Backend dimuat ulang menggunakan build Release terbaru pada port 8000.
- Delapan endpoint ekspor (Excel dan PDF pada empat modul pemakai formatter):
  HTTP 200 dengan signature file valid. Isi shared strings keempat workbook
  Excel memiliki timestamp dalam format `yyyy-MM-dd HH:mm`.
- 24 pemeriksaan foto/modal dan chat pada viewport 390x844, 575x767, 1559x975:
  lulus, tanpa exception JavaScript.
- 36 kombinasi filter Overview (enam modul, halaman biasa dan Super Admin,
  tiga viewport) diperiksa sebelum dan sesudah penghapusan CSS. Dropdown tetap
  terbuka; ukuran, padding, font, warna, radius, dan opsi identik. Selector lama
  tidak cocok dengan elemen mana pun, termasuk saat dropdown terbuka.
- `git diff --check`: lulus.

### Batas Verifikasi

Pemeriksaan browser memakai akun Super Admin lokal dan Chrome headless.
Ini bukan pengujian menyeluruh semua role, semua kondisi data, semua browser,
atau deployment Docker/produksi. Tidak ada transaksi yang dibuat/dihapus atau
approval yang dijalankan dalam smoke test. Membuka chat dapat memperbarui
penanda sudah dibaca melalui perilaku aplikasi normal.

Tidak ada klaim bahwa analisis statis dapat membuktikan seluruh kemungkinan
pemanggilan eksternal/dinamis. Item yang masih ambigu dipertahankan.
