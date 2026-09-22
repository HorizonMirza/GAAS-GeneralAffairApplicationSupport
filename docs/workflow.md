# Alur Kerja Pengembangan

Proyek ini dikembangkan dengan bantuan beberapa AI coding assistant yang masing-masing berjalan di sandbox terpisah, dengan akses langsung (via kredensial Git) ke repository GitHub milik user — saat ini Claude Code, Antigravity, dan Codex. Karena itu, setiap perubahan melalui siklus berikut:

1. **Revisi** — perubahan kode dilakukan di sandbox sesuai permintaan, setelah `git pull`/`git fetch` untuk memastikan sandbox bekerja dari state terbaru repo.
2. **Verifikasi** — sebelum dianggap selesai:
   - Backend: `dotnet build` (dan `dotnet run` untuk smoke-test manual/curl bila perlu).
   - Frontend: `npx tsc --noEmit` untuk cek tipe, lalu jalankan `npm run dev` dan cek lewat Playwright (screenshot/klik) untuk perubahan UI.
   - Kalau ada perubahan skema database, backend dijalankan ulang dengan `resetdb` supaya tabel & seed data konsisten dengan model terbaru, lalu data uji yang dipakai untuk verifikasi dibersihkan lagi sebelum commit.
3. **Commit & push** — perubahan di-commit dan di-push langsung dari sandbox ke branch yang sedang dikerjakan (biasanya `main`) lewat `git add`/`git commit`/`git push`. Tidak ada langkah "paket zip" atau "terapkan manual di lokal" — begitu di-push, perubahan sudah ada di repo GitHub yang sama dengan yang dipakai user.
4. **Sinkronkan lingkungan lokal user (kalau user menjalankan server sendiri di komputernya)**:
   - `git pull` di komputer user.
   - Backend: `cd backend && dotnet run --launch-profile http` (tambahkan `-- resetdb` hanya kalau ada perubahan skema/model, atau `-- seed` untuk mengisi ulang akun tanpa drop tabel).
   - Frontend: `cd frontend && npm install` (kalau ada perubahan dependency) lalu `npm run dev`.

## Penamaan Commit (Multi-Kontributor)

Repo ini dikerjakan 4 pihak, jadi setiap commit dari AI assistant diberi prefix di awal pesan supaya riwayat commit gampang dipilah siapa yang mengerjakan apa:

| Kontributor | Prefix | Contoh |
|---|---|---|
| User (manual) | *(tidak ada)* | `Fix typo di label Kategori` |
| Claude Code | `[CLAUDIA]` | `[CLAUDIA] Audit and perfect expedition module` |
| Antigravity | `[AGY]` | `[AGY] Audit and perfect expedition module` |
| Codex | `[NOVA]` | `[NOVA] Audit and perfect expedition module` |

Claude Code menambahkan `[CLAUDIA] ` di awal setiap commit message yang dibuatnya di repo ini (judul commit saja, bukan di body).

## Kenapa Alur Ini?

Sandbox pengembangan sudah dikonfigurasi dengan kredensial Git yang mengarah ke repository GitHub asli milik user, jadi perubahan bisa langsung ter-sync lewat `git push` tanpa perlu langkah manual "kirim file lalu user commit sendiri". Sandbox tidak mengakses database PostgreSQL milik user secara langsung — verifikasi backend/database dilakukan di database sandbox sendiri, terpisah dari database production/lokal user.

## Rahasia yang Tidak Boleh Ikut Ter-commit

- `backend/appsettings.json`, `backend/appsettings.Development.json` — connection string database & JWT secret.
- `frontend/.env.local` — konfigurasi environment frontend (URL API, dll).

Semua file ini sudah masuk `.gitignore`. Sebelum setiap commit, periksa `git status`/`git diff` untuk memastikan tidak ada file rahasia yang ikut ter-stage, meskipun namanya terlihat tidak mencurigakan.
