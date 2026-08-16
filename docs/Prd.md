# PRD — Sistem Pendataan Pengiriman Barang Kantor (PGM Solution)

## Latar Belakang

Kantor membutuhkan sistem untuk mencatat pengiriman barang (ekspedisi) yang melalui beberapa tahap verifikasi/approval berjenjang, menggantikan proses manual/berbasis kertas. Sistem ini juga direncanakan menjadi rumah bagi beberapa modul operasional kantor lain di masa depan.

## Tujuan

- Mempercepat & menstandarkan proses input, verifikasi fisik, dan approval pengiriman barang.
- Memberi visibilitas status dokumen secara real-time ke semua pihak terkait (pengirim, Admin GA, KPU).
- Menyediakan jejak audit (riwayat approval, catatan reject) untuk setiap dokumen.
- Menjadi platform terpusat ("PGM Solution") untuk modul-modul kantor lain (lihat [Modul](#modul)).

## Peran Pengguna

| Role | Deskripsi |
|---|---|
| `ADMIN_DEPARTEMEN` | Input data pengiriman atas nama Departemen |
| `APPROVAL_DEPARTEMEN` | Approve/reject dokumen dari Departemen (tahap 1) |
| `ADMIN_DIVISI` | Input data pengiriman atas nama Divisi |
| `APPROVAL_DIVISI` | Approve/reject dokumen dari Divisi (tahap 1) |
| `ADMIN_GA` | Cek fisik barang, approve/reject (tahap 2) |
| `APPROVAL_GA` | Approve/reject final di sisi GA (tahap 3) |
| `KPU` | Approve final, cetak resi, isi biaya pengiriman (tahap akhir) |
| `SUPER_ADMIN` | Kelola data master (lihat halaman Super Admin) |

## Alur Kerja (Ekspedisi)

1. Admin Departemen/Divisi input data barang → `DRAFT`, lalu submit → `SUBMITTED`.
2. Approval Departemen/Divisi memeriksa → `APPROVED_L1` atau `REJECTED_L1` (balik ke pengirim untuk revisi).
3. Admin GA cek fisik barang → `APPROVED_GA` atau `REJECTED_GA_APPROVAL`.
4. Approval GA memverifikasi → `APPROVED_GA_APPROVAL` atau `REJECTED_KPU`.
5. KPU melengkapi No. Resi/Berat/Asuransi/Subtotal/Total dan approve final → `COMPLETED`, atau reject.

Setiap penolakan mencatat `rejectReason` (opsional) dan mengembalikan dokumen ke pihak sebelumnya.

## Fitur yang Sudah Ada

- Autentikasi berbasis username + password (JWT httpOnly cookie).
- CRUD data pengiriman barang dengan validasi field & nomor transmittal otomatis.
- Alur approval berjenjang sesuai tabel di atas, dengan riwayat approval (log) per dokumen.
- Chat per dokumen (diskusi antar pihak terkait, dengan mention & notifikasi belum-dibaca).
- Export data ke Excel & PDF, dengan filter (status/divisi/direktorat/pencarian).
- Halaman Super Admin untuk kelola data master.
- Dashboard ringkas per role dengan status antrian & jumlah dokumen.
- Tema terang/gelap pada aplikasi (di luar halaman login).

## Modul

Aplikasi (branding: **PGM Solution**) dirancang sebagai platform multi-modul. Status saat ini:

| Modul | Status |
|---|---|
| Expedition (pengiriman barang) | **Aktif** — modul utama yang sudah selesai dibangun |
| Office Supplies (permintaan barang kantor — kopi, teh, ATK, dll) | Placeholder ("Segera Hadir") |
| Vehicle Booking | Placeholder |
| Room Booking | Placeholder |
| Maintenance (perbaikan sarana & prasarana) | Placeholder |
| Archive | Placeholder |

## Ide/Kebutuhan yang Sudah Dibahas, Belum Diputuskan Jadwalnya

Lihat [`TODO.md`](./TODO.md) untuk daftar lengkap beserta konteksnya (lampiran bukti pengiriman, notifikasi email, integrasi login Azure AD, dsb).

## Di Luar Cakupan Saat Ini

- Pendaftaran akun mandiri (self sign-up) — semua akun dibuat manual lewat seed database.
- Modul selain Expedition belum punya alur kerja/backend, baru placeholder UI.
