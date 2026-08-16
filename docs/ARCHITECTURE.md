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
Controllers/   Endpoint HTTP per domain (Auth, Pengiriman, Chat, Invoice, Export, Profile)
Models/        Entity EF Core (User, Pengiriman, PengirimanLog, ChatMessage, ChatRead, Invoice, InvoiceLog, DivisiCounter, Enums)
Data/          AppDbContext (mapping tabel) + DbSeeder (akun & data awal)
Dtos/          Bentuk request/response API (terpisah dari entity)
Services/      JwtService (buat/verifikasi token), CurrentUserService (ambil user dari cookie), OrgTree (struktur Departemen/Divisi)
Program.cs     Bootstrap app: DI, CORS, Swagger, routing, switch resetdb/seed
```

- ORM: Entity Framework Core dengan provider `Npgsql.EntityFrameworkCore.PostgreSQL`.
- Export Excel via `ClosedXML`, export PDF via `QuestPDF`.
- Password di-hash dengan `BCrypt.Net-Next`.
- Tidak memakai EF Migrations — perubahan skema dilakukan manual di `DbSeeder`/`AppDbContext` lalu database di-reset lewat `dotnet run -- resetdb` (drop semua tabel + re-seed). Struktur tabel juga didokumentasikan di `database/schema.sql`.
- Konfigurasi rahasia (connection string, JWT secret) ada di `appsettings.Development.json`, **tidak** masuk git — dikelola manual per environment.

## Frontend (`frontend/`)

Next.js (App Router) + React + TypeScript.

```
src/app/page.tsx           Halaman login
src/app/(app)/             Halaman setelah login (route group, pakai layout bersama)
  dashboard/                 Ringkasan modul (dulu bernama "home")
  ekspedisi/overview/        Dashboard modul Expedition (antrian per role)
  ekspedisi/transaksi/       Tabel semua transaksi + filter/export
  profile/                    Profil & ganti password
  superadmin/                  Kelola data master (role SUPER_ADMIN)
  arsip/, booking-kendaraan/, booking-ruang-meeting/,
  perbaikan-sarana/, rumah-tangga/                Placeholder modul lain
src/components/            Komponen reusable (modal, badge, stepper, sidebar/AppShell, chat, dsb)
src/lib/                   api.ts (client HTTP ke backend), auth-context.tsx, types.ts, constants.ts, format.ts
```

- State auth global lewat `AuthContext` (`src/lib/auth-context.tsx`), membaca profil user dari backend saat load.
- Styling: CSS global (`globals.css`) dengan class utility custom (mis. `.card-icon-btn`, `.item-row-card-*` untuk border status), bukan pakai CSS framework.
- Tidak ada state management library eksternal (Redux/Zustand) — cukup React state + context untuk kebutuhan saat ini.

## Database

PostgreSQL. `database/schema.sql` adalah referensi struktur tabel (tidak dieksekusi otomatis — sumber kebenaran skema adalah `AppDbContext`/`DbSeeder` di backend). Reset skema dilakukan lewat `dotnet run -- resetdb`, **bukan** menjalankan `schema.sql` manual.

## Alur Request Contoh (approve dokumen)

1. Frontend memanggil `PATCH /api/pengiriman/{id}/approve-...` lewat `api.ts`, cookie JWT ikut otomatis.
2. `CurrentUserService` membaca identitas dari cookie, `ApiControllerBase` memvalidasi role yang diizinkan.
3. `PengirimanController` mengubah status, menulis baris baru ke `PengirimanLog` (riwayat approval), simpan ke database lewat `AppDbContext`.
4. Response dikembalikan, frontend memanggil ulang `load()` untuk refresh data & menampilkan toast.
