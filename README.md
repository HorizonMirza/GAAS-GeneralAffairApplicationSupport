# GAAS — General Affair Application System

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
backend/    ASP.NET Core Web API (Controllers, Models, Data, Dtos, Services, Hubs)
frontend/   Next.js app (src/app, src/components, src/lib)
database/   dump referensi struktur tabel PostgreSQL (usang, bukan sumber kebenaran)
docs/       dokumentasi proyek
```

## Dokumentasi

Semua dokumentasi detail ada di [`docs/`](./docs):

- [`docs/README.md`](./docs/README.md) — setup lokal, arsitektur singkat, alur status dokumen, daftar role.
- [`docs/Prd.md`](./docs/Prd.md) — kebutuhan produk & daftar modul.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — detail teknis backend & frontend.
- [`docs/skill.md`](./docs/skill.md) — stack & konvensi kode untuk kontribusi.
- [`docs/workflow.md`](./docs/workflow.md) — alur kerja pengembangan (revisi → verifikasi → commit & push).
- [`docs/TODO.md`](./docs/TODO.md) — ide/fitur yang sudah dibahas tapi belum dikerjakan.

Mulai dari [`docs/README.md`](./docs/README.md) untuk instruksi menjalankan proyek secara lokal.

## Status

Proyek internal PGN Solution — tidak untuk didistribusikan di luar organisasi.
