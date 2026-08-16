# Alur Kerja Pengembangan

Proyek ini dikembangkan dengan bantuan Claude Code yang berjalan di sandbox terpisah (bukan langsung di komputer lokal user). Karena itu, setiap perubahan melalui siklus berikut:

1. **Revisi** — perubahan kode dilakukan di sandbox sesuai permintaan.
2. **Verifikasi** — sebelum dianggap selesai:
   - Backend: `dotnet build` (dan `dotnet run` untuk smoke-test manual/curl bila perlu).
   - Frontend: `npx tsc --noEmit` untuk cek tipe, lalu jalankan `npm run dev` dan cek lewat Playwright (screenshot/klik) untuk perubahan UI.
   - Kalau ada perubahan skema database, backend dijalankan ulang dengan `resetdb` supaya tabel & seed data konsisten dengan model terbaru.
3. **Paket perubahan** — folder `backend/` dan `frontend/` (minus `bin/`, `obj/`, `node_modules/`, `.next/`, dan file rahasia seperti `appsettings.json`, `appsettings.Development.json`, `.env.local`) di-zip untuk dikirim ke user.
4. **Terapkan di lokal** — user mengekstrak zip dan menyalin isinya ke folder proyek asli di komputernya (menimpa `backend/` dan `frontend/` miliknya).
5. **Commit & push** — user menjalankan `git add -A && git commit -m "..." && git push` dari komputernya sendiri (bukan dari sandbox, karena sandbox tidak punya akses push ke repo asli).
6. **Jalankan ulang server lokal**:
   - Backend: `cd backend && dotnet run --launch-profile http` (tambahkan `-- resetdb` hanya kalau ada perubahan skema/model).
   - Frontend: `cd frontend && npm run dev`.

## Kenapa Alur Ini?

Sandbox pengembangan tidak punya kredensial untuk push langsung ke repo GitHub milik user, dan tidak bisa mengakses database PostgreSQL lokal user. Jadi setiap perubahan harus "dikirim balik" dalam bentuk file, bukan langsung ter-sync otomatis.

## Rahasia yang Tidak Boleh Ikut Terkirim

- `backend/appsettings.json`, `backend/appsettings.Development.json` — connection string database & JWT secret.
- `frontend/.env.local` — konfigurasi environment frontend (URL API, dll).

Semua file ini sudah masuk `.gitignore` dan sengaja dikosongkan/dihapus dari setiap paket zip sebelum dikirim.
