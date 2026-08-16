# TODO / Ide yang Sudah Dibahas

Daftar ide/fitur yang sudah didiskusikan tapi sengaja ditunda. Ditulis supaya tidak hilang konteksnya kapan pun mau dilanjutkan.

## Modul Expedition

- [ ] **Lampiran foto/dokumen bukti pengiriman** — upload foto barang/tanda terima sebagai bukti di setiap tahap approval.
- [ ] **Notifikasi email** — kirim email saat dokumen butuh approval, di-reject, atau ada mention di chat.
- [ ] **Laporan/analitik** — rekap & visualisasi data pengiriman (belum dibahas detail workflow-nya).

## Modul Lain (masih placeholder "Segera Hadir")

- [ ] Office Supplies — permintaan barang kantor (kopi, teh, ATK, dll), workflow & backend belum dibangun.
- [ ] Vehicle Booking — booking kendaraan kantor.
- [ ] Room Booking — booking ruang meeting.
- [ ] Maintenance — perbaikan sarana & prasarana.
- [ ] Archive — arsip dokumen.

## Autentikasi & Login

- [ ] **Login via Azure AD (SSO)** — ditunda karena butuh App Registration di Azure Portal milik user (Client ID, Tenant ID, Client Secret) yang belum dibuat. Panduan langkah-langkah sudah pernah diberikan; tinggal lanjutkan begitu App Registration siap. User yang login via Azure tapi belum terdaftar di sistem akan diarahkan ke halaman "belum terdaftar".
- [x] ~~Dark/light mode toggle di halaman login~~ — sudah ditanyakan, user memutuskan tidak perlu.

## Sudah Selesai (dipindah dari diskusi ke implementasi)

- [x] Rename "Home" → "Dashboard" (route, sidebar, breadcrumb, redirect).
- [x] Rename label modul placeholder ke Bahasa Inggris ringkas (Office Supplies, Vehicle Booking, Room Booking, Maintenance, Archive).
- [x] Restrukturisasi folder: `api/` → `backend/`, `web/` → `frontend/`, dokumentasi dipindah ke `docs/`.

## Catatan

Item di file ini murni pencatatan ide — belum tentu jadi prioritas atau disetujui untuk dikerjakan. Konfirmasi ke pemilik produk sebelum mulai implementasi.
