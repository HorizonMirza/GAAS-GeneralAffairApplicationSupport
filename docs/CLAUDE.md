# Catatan untuk Claude/AI Assistant

Ringkasan konteks proyek ini untuk siapa pun (manusia atau AI) yang membantu pengembangan.

## Apa Ini

Aplikasi internal **GAAS** (General Affair Application System, dibangun untuk **PGN Solution**) — platform multi-modul untuk operasional kantor. Enam modul sudah aktif dengan backend + frontend penuh: **Expedition** (pengiriman barang, modul pertama/paling lengkap — satu-satunya dengan reject yang bisa direvisi & dikirim ulang), **Room Booking**, **Vehicle Booking**, **Office Supplies** (permintaan ATK — satu-satunya modul selain Ekspedisi yang punya tahap KPU), **Maintenance** (laporan perbaikan sarana), dan **Archive** (permintaan pemindahan arsip fisik — bukan penyimpanan file, ikut alur approval yang sama seperti Room/Vehicle/Maintenance, tanpa KPU). Detail per modul di [`Prd.md`](./Prd.md) bagian Modul.

## Stack

Backend ASP.NET Core 8 (`backend/`) + Frontend Next.js/TypeScript (`frontend/`) + PostgreSQL. Detail lengkap di [`ARCHITECTURE.md`](./ARCHITECTURE.md), konvensi kode di [`skill.md`](./skill.md).

## Sebelum Membuat Perubahan

1. Baca [`skill.md`](./skill.md) untuk konvensi yang sudah ada (jangan duplikasi komponen/pola yang sudah ada).
2. Cek [`TODO.md`](./TODO.md) — kalau ide yang diminta user sudah pernah dibahas & ditunda, jangan asumsikan itu berarti disetujui untuk dikerjakan sekarang; konfirmasi dulu.
3. Ikuti siklus di [`workflow.md`](./workflow.md) — proyek ini dikembangkan di sandbox terpisah dari komputer user, tapi sandbox punya akses `git push` langsung ke repo GitHub user, jadi setiap perubahan diverifikasi lalu di-commit & push langsung dari sandbox (bukan dikirim sebagai paket zip).

## Prinsip Komunikasi dengan User

User (pemilik proyek) tidak selalu berlatar belakang teknis. Jelaskan instruksi teknis (perintah terminal, dsb) selangkah demi selangkah, dan konfirmasi dulu sebelum melakukan aksi yang sulit dibalikkan (hapus folder/data, ubah skema database, dsb).

## Rahasia

Jangan pernah menaruh isi `appsettings.Development.json`, `appsettings.json`, atau `.env.local` ke dalam commit atau chat — lihat [`workflow.md`](./workflow.md) bagian rahasia.
