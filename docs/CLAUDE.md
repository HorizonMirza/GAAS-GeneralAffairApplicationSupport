# Catatan untuk Claude/AI Assistant

Ringkasan konteks proyek ini untuk siapa pun (manusia atau AI) yang membantu pengembangan.

## Apa Ini

Aplikasi internal **PGM Solution** — modul aktifnya bernama **Expedition**, untuk pendataan & approval pengiriman barang kantor. Direncanakan jadi platform multi-modul (lihat [`Prd.md`](./Prd.md) bagian Modul); modul lain masih placeholder.

## Stack

Backend ASP.NET Core 8 (`backend/`) + Frontend Next.js/TypeScript (`frontend/`) + PostgreSQL. Detail lengkap di [`ARCHITECTURE.md`](./ARCHITECTURE.md), konvensi kode di [`skill.md`](./skill.md).

## Sebelum Membuat Perubahan

1. Baca [`skill.md`](./skill.md) untuk konvensi yang sudah ada (jangan duplikasi komponen/pola yang sudah ada).
2. Cek [`TODO.md`](./TODO.md) — kalau ide yang diminta user sudah pernah dibahas & ditunda, jangan asumsikan itu berarti disetujui untuk dikerjakan sekarang; konfirmasi dulu.
3. Ikuti siklus di [`workflow.md`](./workflow.md) — proyek ini dikembangkan di sandbox terpisah dari komputer user, jadi setiap perubahan perlu diverifikasi lalu dikirim sebagai paket, bukan langsung push ke repo user.

## Prinsip Komunikasi dengan User

User (pemilik proyek) tidak selalu berlatar belakang teknis. Jelaskan instruksi teknis (perintah terminal, dsb) selangkah demi selangkah, dan konfirmasi dulu sebelum melakukan aksi yang sulit dibalikkan (hapus folder/data, ubah skema database, dsb).

## Rahasia

Jangan pernah menaruh isi `appsettings.Development.json`, `appsettings.json`, atau `.env.local` ke dalam commit, chat, atau paket yang dikirim ke user — lihat [`workflow.md`](./workflow.md) bagian rahasia.
