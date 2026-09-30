# GAAS — General Affair Application System

![CI](https://github.com/HorizonMirza/GAAS-GeneralAffairApplicationSupport/actions/workflows/ci.yml/badge.svg)

Aplikasi internal multi-modul untuk operasional kantor **PGN Solution**: Expedition (pengiriman barang), Room Booking, Vehicle Booking, Office Supplies (permintaan ATK), Maintenance (perbaikan sarana), dan Archive (permintaan pemindahan arsip) — dengan alur approval berjenjang sesuai struktur organisasi.

## Stack

| Layer | Teknologi |
|---|---|
| Backend | ASP.NET Core 8 Web API (C#) + Entity Framework Core |
| Frontend | Next.js (React + TypeScript, App Router) |
| Database | PostgreSQL |
| Auth | JWT (httpOnly cookie) + role-based access |

## Struktur Proyek

```
Backend/         ASP.NET Core Web API (Controllers, Models, Data, Dtos, Services, Hubs)
Frontend/        Next.js app (src/app, src/components, src/lib)
Database/        dump referensi struktur tabel PostgreSQL (usang, bukan sumber kebenaran)
Documentation/   dokumentasi proyek
```

## Dokumentasi

Semua dokumentasi detail ada di [`Documentation/`](./Documentation):

| Dokumen | Isi |
|---|---|
| [`Documentation/README.md`](./Documentation/README.md) | Setup lokal, arsitektur singkat, alur status dokumen, daftar role — **mulai dari sini**. |
| [`Documentation/PRD.md`](./Documentation/PRD.md) | Kebutuhan produk & daftar modul. |
| [`Documentation/ARCHITECTURE.md`](./Documentation/ARCHITECTURE.md) | Detail teknis backend & frontend. |
| [`Documentation/SKILL.md`](./Documentation/SKILL.md) | Stack & konvensi kode untuk kontribusi. |
| [`Documentation/WORKFLOW.md`](./Documentation/WORKFLOW.md) | Alur kerja pengembangan (revisi → verifikasi → commit & push). |
| [`Documentation/TODO.md`](./Documentation/TODO.md) | Ide/fitur yang sudah dibahas tapi belum dikerjakan. |
| [`Documentation/DEPLOYMENT.md`](./Documentation/DEPLOYMENT.md) | Panduan deployment produksi di server kantor SIG (Docker & Nginx). |

## Pengujian

Jalankan automated test backend dari root repository:

```powershell
dotnet test Backend/backend.Tests/PengirimanApi.Tests.csproj
```

GitHub Actions menjalankan test backend dan build frontend secara otomatis pada setiap push ke
`main` serta setiap pull request menuju `main` (lihat badge CI di atas).

## Status

Proyek internal PGN Solution — tidak untuk didistribusikan di luar organisasi.
