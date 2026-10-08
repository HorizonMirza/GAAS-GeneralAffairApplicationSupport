# Laporan Pembersihan Kode GAAS

Tanggal verifikasi: 9 Oktober 2026.

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
