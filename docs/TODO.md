# TODO / Ide yang Sudah Dibahas

Daftar ide/fitur yang sudah didiskusikan tapi sengaja ditunda. Ditulis supaya tidak hilang konteksnya kapan pun mau dilanjutkan.

## Modul Expedition

- [ ] **Lampiran foto/dokumen bukti pengiriman** — upload foto barang/tanda terima sebagai bukti di setiap tahap approval.
- [ ] **Notifikasi email** — kirim email saat dokumen butuh approval, di-reject, atau ada mention di chat.
- [ ] **Laporan/analitik** — rekap & visualisasi data pengiriman (belum dibahas detail workflow-nya).

## Autentikasi & Login

- [ ] **Login via Azure AD (SSO)** — ditunda karena butuh App Registration di Azure Portal milik user (Client ID, Tenant ID, Client Secret) yang belum dibuat. Panduan langkah-langkah sudah pernah diberikan; tinggal lanjutkan begitu App Registration siap. User yang login via Azure tapi belum terdaftar di sistem akan diarahkan ke halaman "belum terdaftar".
- [x] ~~Dark/light mode toggle di halaman login~~ — sudah ditanyakan, user memutuskan tidak perlu.

## Sudah Selesai (dipindah dari diskusi ke implementasi)

- [x] Rename "Home" → "Dashboard" (route, sidebar, breadcrumb, redirect).
- [x] Rename label modul placeholder ke Bahasa Inggris ringkas (Office Supplies, Vehicle Booking, Room Booking, Maintenance, Archive).
- [x] Restrukturisasi folder: `api/` → `backend/`, `web/` → `frontend/`, dokumentasi dipindah ke `docs/`.
- [x] Room Booking — kalender, deteksi konflik jadwal, series/recurring booking, export .ics.
- [x] Vehicle Booking — kalender ketersediaan kendaraan, alur approval sama dengan Room Booking.
- [x] Office Supplies — permintaan ATK dengan approval berjenjang, satu permintaan bisa berisi banyak baris barang.
- [x] Maintenance — laporan perbaikan sarana dengan kategori kerusakan & tingkat urgensi (urgensi tinggi diprioritaskan di daftar).
- [x] Archive — awalnya dibangun sebagai penyimpanan dokumen umum tanpa alur approval, lalu dirombak jadi modul permintaan pemindahan arsip fisik dengan alur approval sama seperti Room/Vehicle/Maintenance (tanpa KPU), ditambah halaman Catalog read-only untuk arsip yang sudah disetujui penuh (lihat [`ARCHITECTURE.md`](./ARCHITECTURE.md) bagian Archive).
- [x] Cetak slip PDF per dokumen untuk Ekspedisi dan Archive (modul lain sudah lebih dulu punya).
- [x] Total Akumulasi Biaya di overview Office Supplies.
- [x] Koreksi Harga — KPU bisa mengoreksi field biaya pasca-`COMPLETED` (Ekspedisi & Office Supplies), lewat ikon kunci/pensil + tombol Simpan di modal Detail.
- [x] Super Admin — kelola Organisasi (Direktorat/Divisi/Departemen: tambah/ubah nama/hapus) via `OrgAdminController`, struktur organisasi dipindah dari hardcoded ke tabel database (`org_direktorat`/`org_divisi`/`org_departemen`) dengan cache in-memory.
- [x] Super Admin — kelola User (buat/edit/reset password/nonaktifkan) via `UsersAdminController`, password baru/reset ditampilkan sekali lewat modal reveal, akun wajib ganti password di login pertama.
- [x] Super Admin — jejak audit khusus untuk data yang dihapus (tabel `deletion_log`, tanpa FK ke item asal), tampil sebagai sumber ke-8 di Riwayat Aktivitas.
- [x] Super Admin — tombol export PDF/Excel di seluruh tab (7 modul + Organisasi + User).
- [x] Super Admin — akses penuh ke seluruh modul: bisa create/approve/reject/edit di tahap mana pun tanpa dibatasi role-gate (bypass terpusat di `ApiControllerBase.RequireRoleAsync` + pengecualian di helper per-modul), tampilan sidebar disamakan dengan role lain (semua modul ter-expand + 1 menu "Super Admin" tambahan di bawah, dipisah garis).
- [x] Standarisasi posisi & jarak teks "Diajukan:" ke field Catatan di seluruh modal Detail/Koreksi/Reschedule, mengikuti pola Archive.

## Catatan

Item di file ini murni pencatatan ide — belum tentu jadi prioritas atau disetujui untuk dikerjakan. Konfirmasi ke pemilik produk sebelum mulai implementasi.
