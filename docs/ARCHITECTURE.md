# Arsitektur

## Ringkasan

```
frontend (Next.js, browser)  <-- JWT httpOnly cookie -->  backend (ASP.NET Core Web API)  <-->  PostgreSQL
      :3000                                                     :8000
```

- Frontend dan backend berjalan sebagai dua proses terpisah saat development (`npm run dev` dan `dotnet run`), dihubungkan lewat HTTP + CORS (lihat `Cors:Origins` di `appsettings`).
- Autentikasi: login mengirim username/password ke `/api/auth/login`, backend membalas JWT dalam httpOnly cookie. Semua request berikutnya membawa cookie ini otomatis; tidak ada token disimpan di localStorage.
- Tidak ada API gateway/reverse proxy di lingkungan lokal — frontend memanggil backend langsung lewat `NEXT_PUBLIC_API_BASE_URL`.

## Backend (`backend/`)

ASP.NET Core 8 Web API, project `PengirimanApi`.

```
Controllers/   Endpoint HTTP per domain - satu controller "utama" + satu controller chat per modul transaksional:
                  Auth, Profile, Export                                    (lintas modul)
                  Pengiriman, Chat                                         (Ekspedisi, + Invoice untuk invoice-nya)
                  BookingRuang, BookingChat                                (Room Booking)
                  BookingKendaraan, BookingKendaraanChat                   (Vehicle Booking)
                  PermintaanAtk, PermintaanAtkChat                        (Office Supplies)
                  PerbaikanSarana, PerbaikanSaranaChat                    (Maintenance)
                  Archive                                                  (tanpa chat/approval - lihat di bawah)
Models/        Entity EF Core - satu grup per modul (item + Log + Counter nomor dokumen + ChatMessage/ChatRead),
                ditambah User/Enums yang dipakai lintas modul. Lihat isi folder untuk daftar lengkap.
Data/          AppDbContext (mapping tabel) + DbSeeder (akun & data awal)
Dtos/          Bentuk request/response API (terpisah dari entity) - satu file per modul
Hubs/          ChatHub (SignalR) - push real-time chat ke setiap modul transaksional, lihat bagian SignalR di bawah
Services/      JwtService (buat/verifikasi token), CurrentUserService (ambil user dari cookie),
                OrgTree (struktur Direktorat/Divisi/Departemen), MeetingRooms/Vehicles (data master ruang/kendaraan),
                BookingPdfService (PDF konfirmasi booking), IcsService (export kalender .ics)
Program.cs     Bootstrap app: DI, CORS, Swagger, SignalR hub mapping, routing, switch resetdb/seed
```

- ORM: Entity Framework Core dengan provider `Npgsql.EntityFrameworkCore.PostgreSQL`.
- Export Excel via `ClosedXML`, export PDF via `QuestPDF` (Ekspedisi export + PDF konfirmasi Room Booking).
- Password di-hash dengan `BCrypt.Net-Next`.
- Tidak memakai EF Migrations — perubahan skema dilakukan manual di `DbSeeder`/`AppDbContext` lalu database di-reset lewat `dotnet run -- resetdb` (drop semua tabel + re-seed), **atau** lewat blok `CREATE TABLE IF NOT EXISTS ...` non-destruktif di `Program.cs` yang jalan tiap startup (dipakai untuk menambah tabel modul baru tanpa reset data lama - lihat modul Room Booking dst. sebagai contoh). Struktur tabel di database yang sebenarnya berjalan **selalu** dibaca dari `AppDbContext.OnModelCreating` + blok `CREATE TABLE` di `Program.cs`, bukan dari file di `database/` (lihat catatan di bagian Database).
- Konfigurasi rahasia (connection string, JWT secret) ada di `appsettings.Development.json`, **tidak** masuk git — dikelola manual per environment.

## Pola Modul Transaksional (Room Booking, Vehicle Booking, Office Supplies, Maintenance)

Keempat modul ini (dan Ekspedisi) berbagi satu pola arsitektur yang sama - kalau menambah modul baru, contek salah satu dari ini dulu:

- **Status**: `BookingStatusEnum` (`DRAFT → SUBMITTED → APPROVED_L1/REJECTED_L1 → APPROVED_GA/REJECTED_GA → APPROVED_GA_APPROVAL/REJECTED_GA_APPROVAL`) - beda dari `StatusEnum` milik Ekspedisi yang punya tahap KPU tambahan.
- **Nomor dokumen otomatis**: satu tabel counter per modul (`RoomBookingCounter`, `KendaraanBookingCounter`, `AtkCounter`, `SaranaCounter`), keyed `(divisi, year, month)`, di-increment lewat `INSERT ... ON CONFLICT DO UPDATE` (race-safe) di endpoint `next-nomor`.
- **Origin roles**: `ADMIN_DEPARTEMEN`, `APPROVAL_DEPARTEMEN`, `ADMIN_DIVISI`, `APPROVAL_DIVISI`, `ADMIN_GA`, `APPROVAL_GA` boleh membuat data; kalau Admin/Approval GA yang input, datanya distempel unit GA sendiri ("Procurement and General Affair" / "Asset Management and General Affair"), bukan unit asal mereka (karena akun GA tidak terhubung ke Divisi/Departemen manapun).
- **Reject = jalan buntu**: tidak seperti Ekspedisi, item yang ditolak di modul-modul ini tidak bisa direvisi & resubmit - hanya bisa dihapus oleh pembuat atau Admin/Approval GA.
- **Chat + mention**: setiap modul punya `{Modul}ChatController` + tabel `{Modul}ChatMessage`/`{Modul}ChatRead` sendiri, di-push real-time lewat `ChatHub` (lihat bagian SignalR).
- **Frontend**: `constants.ts` punya helper `is{Modul}EditableByOrigin`, `is{Modul}DeletableByOrigin`, `is{Modul}GaActionable`, `{modul}OriginActorLabel` yang masing-masing mirror aturan backend-nya persis (dikomentari di source-nya).

Archive **tidak** mengikuti pola ini - lihat bagian tersendiri di bawah.

## Archive (pengecualian pola di atas)

Satu-satunya modul tanpa status/approval: upload langsung tersimpan (`ArchiveController`), terlihat oleh semua unit (bukan dibatasi per divisi seperti modul lain), dan tidak punya chat/log riwayat. Yang boleh mengedit/menghapus: pengunggah sendiri, atau Admin/Approval GA/Super Admin. Mendukung banyak jenis file (PDF/Word/Excel/PowerPoint/gambar/ZIP, maks 20 MB), disimpan di `uploads/archive/` dengan nama file acak (GUID) - pola penyimpanan filenya sama dengan Invoice (`uploads/invoices/`).

## SignalR (chat real-time)

`ChatHub` (`backend/Hubs/ChatHub.cs`, di-map di `Program.cs` sebagai `/hubs/chat`) mem-broadcast pesan chat baru ke klien yang sedang membuka thread yang sama, menggantikan polling. Satu koneksi bisa join banyak "grup" (satu grup = satu item, mis. `pengiriman-chat-{id}`, `booking-chat-{id}`, `kendaraan-chat-{id}`, `atk-chat-{id}`, `sarana-chat-{id}`) lewat method `Join{Modul}Chat`/`Leave{Modul}Chat`, dipanggil dari frontend saat modal chat dibuka/ditutup (`frontend/src/lib/chatHub.ts`). Tidak ada middleware `[Authorize]` di aplikasi ini (lihat `CurrentUserService`), jadi setiap `Join{Modul}Chat` memvalidasi akses secara manual lewat method `CanAccess{Modul}` yang sama dengan yang dipakai controller REST-nya (`ApiControllerBase`), supaya aturan visibilitas tidak bisa dilewati lewat WebSocket.

## Frontend (`frontend/`)

Next.js (App Router) + React + TypeScript.

```
src/app/page.tsx                       Halaman login
src/app/(app)/                         Halaman setelah login (route group, pakai layout bersama)
  dashboard/                             Ringkasan lintas modul (dulu bernama "home")
  profile/                               Profil & ganti password
  superadmin/                            Kelola data master (role SUPER_ADMIN)
  ekspedisi/overview/, transaksi/,
    invoice-history/                     Expedition - dashboard, tabel transaksi, riwayat invoice (KPU)
  booking-ruang-meeting/overview/,
    calendar/, transaksi/, laporan/       Room Booking - + kalender & laporan utilisasi ruang
  booking-kendaraan/overview/,
    calendar/, transaksi/                 Vehicle Booking - + kalender ketersediaan kendaraan
  office-supplies/overview/, transaksi/  Office Supplies (permintaan ATK)
  maintenance/overview/, transaksi/      Maintenance (laporan perbaikan sarana)
  arsip/                                  Archive - halaman tunggal (tanpa Overview terpisah, tidak ada approval)
src/components/                        Komponen reusable (modal, badge, stepper, sidebar/AppShell, chat, dsb) -
                                          modal & row-menu umumnya berpasangan per modul (mis. Room{X}, Vehicle{X},
                                          Atk{X}, Sarana{X}), lihat pola di bagian "Pola Modul Transaksional" di atas
src/lib/                               api.ts (client HTTP ke backend, termasuk chatHub.ts untuk SignalR),
                                          auth-context.tsx, types.ts, constants.ts, format.ts
```

- State auth global lewat `AuthContext` (`src/lib/auth-context.tsx`), membaca profil user dari backend saat load.
- Styling: CSS global (`globals.css`) dengan class utility custom (mis. `.card-icon-btn`, `.item-row-card-*` untuk border status), bukan pakai CSS framework.
- Tidak ada state management library eksternal (Redux/Zustand) — cukup React state + context untuk kebutuhan saat ini.

## Database

PostgreSQL. Sumber kebenaran skema adalah `AppDbContext.OnModelCreating` + blok `CREATE TABLE IF NOT EXISTS`/`ALTER TABLE` di `Program.cs` (jalan otomatis tiap startup, non-destruktif) — **bukan** file mana pun di `database/`.

`database/pengiriman_barang_postgres.sql` adalah dump `pg_dump` dari database user di titik waktu yang jauh lebih lama (hanya berisi 4 tabel: `users`, `pengiriman`, `pengiriman_logs`, `invoices` — dari sebelum fitur chat, semua modul booking, ATK, Maintenance, dan Archive ada). File ini **sudah sangat usang** dan tidak dipakai/dieksekusi oleh aplikasi; kalau butuh melihat skema aktual, baca `AppDbContext.cs` langsung, atau jalankan `pg_dump` baru dari database yang sudah di-`resetdb`.

Reset skema penuh dilakukan lewat `dotnet run -- resetdb` (drop semua tabel lalu re-seed) — dipakai kalau ada perubahan pada tabel yang sudah lama ada. Menambah tabel modul baru ke database yang sudah berjalan cukup lewat blok `CREATE TABLE IF NOT EXISTS` di `Program.cs` (lihat pola di modul Room Booking/Vehicle Booking/ATK/Maintenance/Archive), tanpa perlu reset data lama.

## Alur Request Contoh (approve dokumen)

1. Frontend memanggil `PATCH /api/pengiriman/{id}/approve-...` lewat `api.ts`, cookie JWT ikut otomatis.
2. `CurrentUserService` membaca identitas dari cookie, `ApiControllerBase` memvalidasi role yang diizinkan.
3. `PengirimanController` mengubah status, menulis baris baru ke `PengirimanLog` (riwayat approval), simpan ke database lewat `AppDbContext`.
4. Response dikembalikan, frontend memanggil ulang `load()` untuk refresh data & menampilkan toast.

Alur yang sama berlaku di modul lain (`BookingRuangController`, `BookingKendaraanController`, `PermintaanAtkController`, `PerbaikanSaranaController`) — hanya nama controller/tabel log yang berbeda, mekanismenya identik.
