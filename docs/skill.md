# Skill & Konvensi Proyek

Ringkasan pengetahuan/stack yang perlu dipahami untuk berkontribusi ke proyek ini, plus konvensi kode yang sudah terbentuk supaya perubahan baru konsisten dengan yang lama.

## Stack yang Dipakai

- **Backend**: C# / ASP.NET Core 8 Web API, Entity Framework Core (provider Npgsql/PostgreSQL), JWT (`System.IdentityModel.Tokens.Jwt`), BCrypt untuk hash password, ClosedXML (Excel) & QuestPDF (PDF) untuk export.
- **Frontend**: TypeScript, Next.js (App Router, bukan Pages Router — lihat catatan breaking-changes di `frontend/AGENTS.md`), React 19, tanpa CSS framework (CSS global + class utility custom).
- **Database**: PostgreSQL, tanpa ORM migration tool — skema dikelola manual lewat `AppDbContext` + `DbSeeder`, direset via `dotnet run -- resetdb`.
- **Verifikasi**: Playwright (headless Chromium) untuk smoke-test UI setelah perubahan, `dotnet build`/`tsc --noEmit` untuk cek kompilasi sebelum dianggap selesai.

## Konvensi Kode

- **Auth**: JWT disimpan di httpOnly cookie, bukan localStorage/sessionStorage. Jangan ubah pola ini tanpa alasan kuat (risiko XSS).
- **Role check**: dilakukan di backend (`ApiControllerBase` + role enum), frontend hanya menyembunyikan UI sesuai role — jangan andalkan frontend sebagai satu-satunya lapisan otorisasi.
- **Status/role sebagai enum**: `backend/Models/Enums.cs` adalah sumber kebenaran; frontend punya salinan padanan di `src/lib/types.ts`/`constants.ts` yang harus disinkronkan manual saat enum berubah.
- **Komponen modal & UI bersama**: sebelum bikin modal/tombol baru, cek dulu apakah pola serupa sudah ada di `src/components/` (mis. `ConfirmProvider`/`useConfirm()` untuk konfirmasi, `ToastProvider` untuk notifikasi, `.card-icon-btn` untuk tombol ikon kotak seperti Chat/Aksi).
- **Riwayat/log**: setiap perubahan status dokumen dicatat ke tabel log (`PengirimanLog`) — pertahankan pola ini kalau menambah alur status baru.
- **Reject reason opsional**: alasan penolakan tidak wajib diisi di seluruh alur — jangan tambahkan validasi wajib tanpa diminta.
- **Bahasa UI**: label & pesan yang tampil ke pengguna pakai Bahasa Indonesia, kecuali nama modul yang sudah sengaja diganti ke Bahasa Inggris ringkas (lihat `Prd.md`).
- **Tidak ada 2-baris di label sidebar/menu** — pilih istilah singkat, karena `.nav-category-trigger` sengaja tidak dipotong dengan ellipsis.

## Alur Kerja Kontribusi

Lihat [`workflow.md`](./workflow.md) untuk siklus revisi → verifikasi → pengiriman perubahan yang dipakai sepanjang proyek ini.
