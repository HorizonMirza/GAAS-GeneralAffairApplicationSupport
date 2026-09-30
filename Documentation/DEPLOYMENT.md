# Panduan Deployment Produksi GAAS — Server Kantor SIG

Dokumen ini adalah panduan resmi dan langkah-langkah teknis untuk melakukan deployment aplikasi **GAAS (General Affair Application System)** di lingkungan server internal kantor **SIG (Semen Indonesia Group) / PGN Solution**.

---

## 1. Arsitektur Deployment Container

Aplikasi dikemas menggunakan **Docker & Docker Compose** untuk memastikan portabilitas tinggi, isolasi dependensi, dan kemudahan pemeliharaan tanpa mengotori server *host*.

```
                                [ Pengguna / Intranet Kantor SIG ]
                                                │
                                    Port 80 / 8080 (HTTP/HTTPS)
                                                ▼
                        ┌───────────────────────────────────────────────┐
                        │              Nginx Reverse Proxy              │
                        │           (Container: gaas-nginx)             │
                        └───────┬───────────────────────────────┬───────┘
                                │                               │
                     /api/ & /hubs/chat (WebSocket)            / (Web UI)
                                │                               │
                                ▼                               ▼
                ┌───────────────────────────────┐   ┌───────────────────────┐
                │         Backend API           │   │       Frontend        │
                │     (.NET 8 Web API)          │   │  (Next.js Standalone) │
                │  Container: gaas-backend      │   │Container:gaas-frontend│
                └───────────────┬───────────────┘   └───────────────────────┘
                                │
                        Port 5432 (Internal)
                                ▼
                ┌───────────────────────────────┐
                │     Database PostgreSQL 16    │
                │   (Container: gaas-postgres)  │
                └───────────────┬───────────────┘
                                │
                        Volume Persisten:
                   • gaas_pgdata (Data DB)
                   • gaas_uploads (File PDF, Bukti, Foto)
```

### Keunggulan Arsitektur Ini:
1. **Single Port Access**: Seluruh Frontend, REST API, dan SignalR WebSockets (`/hubs/chat`) diakses melalui satu port via Nginx. Tidak ada masalah CORS, tidak ada pemecahan port di firewall kantor.
2. **Next.js Standalone Build**: Ukuran kontainer frontend sangat ringan (~150MB) dan hemat RAM karena hanya menyertakan dependensi runtime produksi.
3. **Penyimpanan Persisten**: Seluruh data transaksi, database, dan file lampiran disimpan di Docker Named Volumes sehingga aman saat kontainer di-restart atau di-update.

---

## 2. Prasyarat Server Kantor SIG

### Spesifikasi Minimum Hardware:
- **Processor**: 2 vCPU / Core (Rekomendasi: 4 vCPU)
- **RAM**: 4 GB (Rekomendasi: 8 GB untuk beban operasional lancar)
- **Disk Space**: Minimal 50 GB SSD (untuk OS, Docker Image, Data PostgreSQL, dan folder upload file invoice/arsip)

### Sistem Operasi yang Didukung:
- Linux: Ubuntu Server 22.04/24.04 LTS, Red Hat Enterprise Linux (RHEL) 8/9, Rocky Linux 9, atau Debian 12.
- Windows Server 2019/2022 (dengan Docker Desktop / WSL2).

### Software yang Wajib Terpasang:
1. **Git**
2. **Docker Engine** (versi 24.0+)
3. **Docker Compose** (versi v2.20+)

*Verifikasi instalasi di terminal server:*
```bash
docker --version
docker compose version
```

---

## 3. Langkah-Langkah Deployment (Step-by-Step)

### Langkah 1: Clone Repository ke Server Kantor
Masuk ke direktori aplikasi di server (misal `/opt` atau direktori home user):
```bash
cd /opt
git clone https://github.com/HorizonMirza/GAAS-GeneralAffairApplicationSupport.git gaas
cd gaas
```

### Langkah 2: Buat File Konfigurasi Lingkungan (`.env`)
Salin file template `.env.production.example` menjadi `.env`:
```bash
cp .env.production.example .env
```

Buka dan sesuaikan file `.env` menggunakan editor teks (misal `nano`):
```bash
nano .env
```

**Konfigurasi Penting yang Wajib Diisi:**
```ini
# Port yang dibuka ke jaringan kantor (misal 80 atau 8080)
PORT=80

# Kredensial Database PostgreSQL (Ganti dengan kata sandi kuat!)
DB_NAME=pengiriman_barang
DB_USER=pengiriman_app
DB_PASSWORD=PasswordDatabaseSangatKuatDanRahasiaSIG2026!

# Kunci JWT (Wajib minimal 64 karakter acak untuk keamanan)
JWT_SECRET=buat_kunci_acak_panjang_minimal_64_karakter_misal_kombinasi_huruf_angka_simbol

# Masa aktif token login (480 menit = 8 jam kerja)
JWT_EXPIRE_MINUTES=480

# Domain atau IP Server Kantor SIG (pisahkan koma jika lebih dari satu)
CORS_ORIGINS=http://localhost,http://10.x.x.x,http://gaas.sig.id

# Endpoint API Publik (tetap /api karena menggunakan Nginx reverse proxy)
NEXT_PUBLIC_API_BASE_URL=/api
```

### Langkah 3: Build & Jalankan Kontainer
Jalankan perintah berikut untuk meng-compile image dan menjalankan seluruh service di background:
```bash
docker compose up -d --build
```

### Langkah 4: Verifikasi Status Service
Periksa apakah seluruh 4 kontainer berjalan normal (`Up` / `healthy`):
```bash
docker compose ps
```

*Output normal:*
```
NAME            IMAGE               COMMAND                  SERVICE    STATUS
gaas-postgres   postgres:16-alpine  "docker-entrypoint.s…"   postgres   Up (healthy)
gaas-backend    gaas-backend        "dotnet PengirimanAp…"   backend    Up
gaas-frontend   gaas-frontend       "docker-entrypoint.s…"   frontend   Up
gaas-nginx      nginx:1.27-alpine   "/docker-entrypoint.…"   nginx      Up
```

Pantau log startup backend untuk memastikan database auto-seeding selesai:
```bash
docker compose logs -f backend
```

---

## 4. Inisialisasi Database & Akun Awal

- **Skema Otomatis**: Saat backend pertama kali dijalankan, sistem secara otomatis mengeksekusi `EnsureCreated()` dan migrasi tabel 54 model ke database PostgreSQL di dalam kontainer.
- **Akun Bawaan (Default Accounts)**:
  Sistem secara otomatis membuat akun bawaan untuk pengujian awal:
  - **Super Admin**: `Super Admin GAAS` (Role: `SUPER_ADMIN`)
  - **Admin GA**: `Admin General Affair 1`
  - **Approval GA**: `Approval General Affair 1`
  - *Catatan*: Kredensial default bawaan sistem langsung dapat digunakan, dan akun baru dapat ditambahkan melalui menu **Super Admin > User Management**.

---

## 5. Prosedur Pemeliharaan & Operasional Harian

### Melihat Log Realtime:
```bash
# Log seluruh service
docker compose logs -f

# Log backend saja (melihat error API atau transaksi)
docker compose logs -f backend

# Log Nginx (melihat traffic request masuk)
docker compose logs -f nginx
```

### Backup Database PostgreSQL:
Jalankan perintah berikut untuk mengekspor database ke file `.sql` cadangan:
```bash
# Buat direktori backup jika belum ada
mkdir -p /opt/backups

# Ekspor database
docker exec -t gaas-postgres pg_dump -U pengiriman_app pengiriman_barang > /opt/backups/gaas_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database dari File Backup:
```bash
docker exec -i gaas-postgres psql -U pengiriman_app pengiriman_barang < /opt/backups/nama_file_backup.sql
```

### Update Versi Aplikasi (Saat Ada Pembaruan di GitHub):
Jika ada fitur baru atau perbaikan bug yang di-push ke GitHub:
```bash
cd /opt/gaas
git pull origin main
docker compose up -d --build
```
*Data database dan file lampiran tidak akan hilang karena tersimpan di persistent volume.*

### Menghentikan dan Menjalankan Kembali:
```bash
# Menghentikan aplikasi sementara
docker compose down

# Menjalankan kembali
docker compose up -d
```

---

## 6. Integrasi HTTPS / SSL di Server Kantor SIG

Jika server kantor SIG menggunakan SSL/HTTPS perusahaan:

### Opsi A: Terminasi SSL di Reverse Proxy / F5 / Load Balancer Kantor (Paling Umum)
Jika kantor SIG memiliki Load Balancer / Gateway yang menangani sertifikat SSL (`https://gaas.sig.id`), lalu meneruskan traffic HTTP port 80 ke server VM GAAS:
- Tidak perlu mengubah konfigurasi Nginx GAAS.
- Cukup pastikan header `X-Forwarded-Proto https` diteruskan oleh Load Balancer kantor.
- Di file `.env`, tambahkan URL HTTPS ke `CORS_ORIGINS`:
  ```ini
  CORS_ORIGINS=https://gaas.sig.id,http://gaas.sig.id
  ```

### Opsi B: Memasang Sertifikat SSL Langsung di Nginx GAAS
Jika ingin Nginx GAAS menangani sertifikat SSL internal secara langsung:
1. Simpan sertifikat `.crt` dan private key `.key` di folder `nginx/ssl/`.
2. Ubah `nginx/nginx.conf` untuk mendengarkan port 443 dengan `ssl_certificate` dan `ssl_certificate_key`.
3. Buka port 443 pada `docker-compose.yml` di service `nginx`.

---

## 7. Troubleshooting Masalah Umum di Server Kantor

| Gejala Masalah | Penyebab Umum | Solusi |
|---|---|---|
| Halaman web tidak bisa diakses dari PC user kantor | Port belum dibuka di firewall OS server (UFW / firewalld) | Buka port di firewall: <br>`sudo ufw allow 80/tcp` atau <br>`sudo firewall-cmd --add-port=80/tcp --permanent && sudo firewall-cmd --reload` |
| Upload file gambar / invoice gagal dengan error 413 | Ukuran file melebihi batas request | `nginx.conf` sudah diset `client_max_body_size 50M;`. Pastikan file di bawah 50 MB. |
| Fitur Chat / Notifikasi Realtime tidak update otomatis | WebSocket terblokir oleh proxy perusahaan | Pastikan Nginx mengizinkan header `Upgrade` dan `Connection "upgrade"` (sudah terpasang di `nginx/nginx.conf`). |
| Database tidak mau start | Password di `.env` berubah setelah volume database sudah terbuat | Jika ingin mengubah password database lama, ubah langsung lewat `psql` di dalam kontainer, jangan hapus volume `gaas_pgdata` kecuali memang ingin reset total. |
