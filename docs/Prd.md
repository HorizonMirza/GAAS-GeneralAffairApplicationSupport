# PRD — Sistem Pendataan Pengiriman Barang Kantor (PGM Solution)

## Latar Belakang

Kantor membutuhkan sistem untuk mencatat pengiriman barang (ekspedisi) yang melalui beberapa tahap verifikasi/approval berjenjang, menggantikan proses manual/berbasis kertas. Sistem ini adalah rumah bagi beberapa modul operasional kantor lain (lihat [Modul](#modul)) yang mengikuti pola approval yang sama.

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
| `APPROVAL_GA` | Approve/reject final di sisi GA (tahap 3, dan status akhir untuk modul selain Ekspedisi) |
| `KPU` | Approve final, cetak resi, isi biaya pengiriman — hanya di Ekspedisi (lihat [KPU_HIDDEN_CATEGORIES](../frontend/src/components/AppShell.tsx), KPU tidak melihat modul lain di sidebar) |
| `SUPER_ADMIN` | Kelola data master (lihat halaman Super Admin) |

## Alur Kerja (Ekspedisi)

1. Admin Departemen/Divisi input data barang → `DRAFT`, lalu submit → `SUBMITTED`.
2. Approval Departemen/Divisi memeriksa → `APPROVED_L1` atau `REJECTED_L1` (balik ke pengirim untuk revisi).
3. Admin GA cek fisik barang → `APPROVED_GA` atau `REJECTED_GA_APPROVAL`.
4. Approval GA memverifikasi → `APPROVED_GA_APPROVAL` atau `REJECTED_KPU`.
5. KPU melengkapi No. Resi/Berat/Asuransi/Subtotal/Total dan approve final → `COMPLETED`, atau reject.

Setiap penolakan mencatat `rejectReason` (opsional) dan mengembalikan dokumen ke pihak sebelumnya.

## Alur Kerja (Room Booking, Vehicle Booking, Office Supplies, Maintenance)

Keempat modul ini memakai rantai approval yang sama, satu tahap lebih pendek dari Ekspedisi (**tanpa tahap KPU** — berhenti di Approval GA):

1. Admin Departemen/Divisi input data → `DRAFT`, submit → `SUBMITTED`.
2. Approval Departemen/Divisi → `APPROVED_L1` atau `REJECTED_L1`.
3. Admin GA → `APPROVED_GA` atau `REJECTED_GA`.
4. Approval GA → `APPROVED_GA_APPROVAL` (status final/selesai) atau `REJECTED_GA_APPROVAL`.

Kalau pembuat data kebetulan sudah berperan sebagai Approval Departemen/Divisi, Admin GA, atau Approval GA, tahapnya sendiri dilewati otomatis saat submit. Item yang ditolak adalah jalan buntu (tidak ada revisi-lalu-resubmit seperti Ekspedisi) — pembuat hanya bisa menghapusnya dan membuat data baru.

Setiap modul punya nomor dokumen otomatis per divisi per bulan (`0001.<KodeSatuanKerja>.<MM>.<YYYY>`), riwayat approval per item, dan chat real-time (lihat [`ARCHITECTURE.md`](./ARCHITECTURE.md) bagian SignalR).

## Alur Kerja (Archive)

Tidak ada approval sama sekali — begitu dokumen diunggah, langsung tersimpan dan terlihat oleh semua unit (bukan hanya unit pengunggah). Siapa pun kecuali KPU boleh unggah; hanya pengunggah sendiri atau Admin/Approval GA/Super Admin yang boleh mengedit/menghapusnya.

## Fitur yang Sudah Ada

- Autentikasi berbasis username + password (JWT httpOnly cookie).
- CRUD data dengan validasi field & nomor dokumen otomatis per divisi/bulan, di setiap modul transaksional.
- Alur approval berjenjang (lihat bagian Alur Kerja di atas), dengan riwayat approval (log) per item.
- Chat real-time per item (SignalR) di setiap modul transaksional — diskusi antar pihak terkait, dengan mention & notifikasi belum-dibaca.
- Export data ke Excel & PDF, dengan filter (status/divisi/direktorat/pencarian) — Ekspedisi & Room Booking.
- Kalender ketersediaan (Room Booking, Vehicle Booking) dengan tampilan Harian/Mingguan/Bulanan.
- Halaman Super Admin untuk kelola data master.
- Dashboard ringkas per role dengan status antrian & jumlah dokumen.
- Tema terang/gelap pada aplikasi (di luar halaman login).

## Modul

Aplikasi (branding: **PGM Solution**) adalah platform multi-modul. Semua modul di sidebar sudah aktif (backend + frontend lengkap, bukan lagi placeholder):

| Modul | Status | Catatan |
|---|---|---|
| Expedition (pengiriman barang) | **Aktif** | Modul pertama/paling lengkap — satu-satunya dengan tahap KPU & export Excel/PDF |
| Room Booking | **Aktif** | Kalender, deteksi konflik jadwal, series/recurring booking |
| Vehicle Booking | **Aktif** | Kalender ketersediaan kendaraan |
| Office Supplies (permintaan ATK) | **Aktif** | Satu permintaan bisa berisi banyak baris barang |
| Maintenance (perbaikan sarana & prasarana) | **Aktif** | Kategori kerusakan & tingkat urgensi, laporan urgensi tinggi diprioritaskan di daftar |
| Archive (penyimpanan dokumen) | **Aktif** | Satu-satunya modul **tanpa** alur approval — unggah langsung tersimpan, terlihat semua unit |

## Ide/Kebutuhan yang Sudah Dibahas, Belum Diputuskan Jadwalnya

Lihat [`TODO.md`](./TODO.md) untuk daftar lengkap beserta konteksnya (lampiran bukti pengiriman, notifikasi email, integrasi login Azure AD, dsb).

## Di Luar Cakupan Saat Ini

- Pendaftaran akun mandiri (self sign-up) — semua akun dibuat manual lewat seed database.
