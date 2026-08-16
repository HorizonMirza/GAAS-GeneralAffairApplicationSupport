# PGM Solution — Sistem Pendataan Pengiriman Barang Kantor

Aplikasi internal untuk mencatat, memverifikasi, dan menyetujui pengiriman barang kantor (ekspedisi), dengan alur approval berjenjang sesuai struktur organisasi (Departemen/Divisi → Admin GA → KPU).

## Arsitektur

| Layer | Teknologi |
|---|---|
| Backend | ASP.NET Core 8 Web API (C#) + Entity Framework Core |
| Frontend | Next.js (React + TypeScript, App Router) |
| Database | PostgreSQL |
| Auth | JWT (httpOnly cookie) + role-based access |

Detail lebih dalam ada di [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Struktur Proyek

```
backend/    ASP.NET Core Web API (Controllers, Models, Data, Dtos, Services)
frontend/   Next.js app (src/app, src/components, src/lib)
database/   schema.sql referensi struktur tabel PostgreSQL
docs/       dokumentasi proyek (file ini dan lainnya)
```

## Menjalankan Secara Lokal

### 1. Database (PostgreSQL)

Buat database dan user sesuai `backend/appsettings.Example.json`, lalu salin jadi `backend/appsettings.Development.json` dan sesuaikan connection string + JWT secret. File ini **tidak** boleh masuk git (sudah ada di `.gitignore`).

### 2. Backend

```bash
cd backend
dotnet run --launch-profile http
```

- API berjalan di `http://localhost:8000`, dokumentasi Swagger di `http://localhost:8000/swagger`.
- Jalankan dengan argumen tambahan `resetdb` (`dotnet run --launch-profile http -- resetdb`) untuk drop semua tabel + re-seed akun — **hanya dipakai saat ada perubahan struktur database (migration/schema)**.
- Argumen `seed` (tanpa drop) untuk mengisi ulang data akun tanpa menghapus tabel.

### 3. Frontend

```bash
cd frontend
npm install   # sekali saja / saat ada perubahan dependency
npm run dev
```

Buka `http://localhost:3000`. Pastikan `frontend/.env.local` berisi `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api`.

## Alur Status Dokumen (Ekspedisi)

```
DRAFT -> SUBMITTED
  -> APPROVED_L1 / REJECTED_L1        (approval Departemen atau Divisi, tergantung asal dokumen)
  -> APPROVED_GA / REJECTED_GA_APPROVAL   (Admin GA cek fisik barang)
  -> APPROVED_GA_APPROVAL / REJECTED_KPU  (Approval GA)
  -> COMPLETED                        (KPU approve final, isi No Resi/Berat/Asuransi/Subtotal/Total)
```

Reject di tiap tahap mengembalikan dokumen ke pihak sebelumnya untuk direvisi lalu resubmit.

## Peran (Role)

`ADMIN_DEPARTEMEN`, `APPROVAL_DEPARTEMEN`, `ADMIN_DIVISI`, `APPROVAL_DIVISI`, `ADMIN_GA`, `APPROVAL_GA`, `KPU`, `SUPER_ADMIN`. Tidak ada pendaftaran akun mandiri — semua akun dibuat lewat seed (`backend/Data/DbSeeder.cs`).

## Dokumen Lain

- [`Prd.md`](./Prd.md) — kebutuhan produk & daftar modul.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — detail teknis backend & frontend.
- [`workflow.md`](./workflow.md) — alur kerja pengembangan (revisi → verifikasi → pengiriman perubahan).
- [`TODO.md`](./TODO.md) — ide/fitur yang sudah dibahas tapi belum dikerjakan.
- [`skill.md`](./skill.md) — ringkasan stack & konvensi kode yang perlu dipahami untuk berkontribusi.
