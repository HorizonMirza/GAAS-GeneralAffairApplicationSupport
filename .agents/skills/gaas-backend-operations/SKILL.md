---
name: gaas-backend-operations
description: >-
  Operational runbook for GAAS ASP.NET Core backend development, database management via
  EnsureCreated and raw SQL schema evolution, database seeding (DbSeeder.cs), CLI maintenance tools,
  file storage, and API routing. Use when modifying controllers, updating entities, performing database operations,
  or troubleshooting backend services.
---

# GAAS Backend Operations & Architecture Runbook

This skill documents the development, database architecture, and operational runbook for the GAAS backend service.

---

## 1. Service Overview & Launch Configuration

- **Framework**: ASP.NET Core 8 Web API (C#)
- **Project Directory**: `backend/`
- **Default Port**: `http://localhost:8000` (configured in `backend/Properties/launchSettings.json`)
- **Swagger Documentation**: `http://localhost:8000/swagger` (enabled in Development mode)
- **Start Command**:
  ```powershell
  cd backend
  dotnet run
  ```

---

## 2. Database Schema Management (Non-EF-Migration Pattern)

> [!IMPORTANT]
> **CRITICAL ARCHITECTURAL RULE**:
> This project does **NOT** use standard `dotnet ef migrations add` / `dotnet ef database update`.
> Instead, schema evolution is managed via **Non-Destructive Raw SQL Schema Evolution** inside `Program.cs`:

1. **Table Creation**: `migrateDb.Database.EnsureCreated()` creates all tables defined in `AppDbContext.cs` that do not yet exist.
2. **Column Backfills**: New columns are added incrementally and idempotently via raw SQL:
   ```csharp
   migrateDb.Database.ExecuteSqlRaw("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP");
   ```
3. **Additive-Only Philosophy**: Never drop or destructively alter existing columns. New columns must be nullable or provide default values so existing data survives restarts.
4. **Database Reset (Dev Only)**:
   ```powershell
   cd backend
   dotnet run -- resetdb
   ```
   *Wipes database tables and reseeds fresh master data from `DbSeeder.cs`.*

---

## 3. Data Seeder Pipeline (`backend/Data/DbSeeder.cs`)

All user accounts, roles, vehicles, and meeting rooms are seeded programmatically.

* **Master Organization**: Defined in `backend/Services/OrgTree.cs` (4 Direktorat, 17 Divisi, 30+ Departemen).
* **Document Numbering Pattern**:
  Format: `{seq:D4}.{KodeSatuanKerja}.{MM}.{yyyy}` (e.g. `0012.PGA.09.2026`).
  Managed by atomic database counters (`divisi_counters`, `room_booking_counters`, etc.) using `INSERT ... ON CONFLICT DO UPDATE RETURNING`.
* **Instant Session Revocation**: When a password is changed in `ProfileController`, `password_changed_at` is updated. Any JWT issued prior to that timestamp is immediately rejected by `CurrentUserService`.

---

## 4. Maintenance CLI Commands

The compiled backend executable exposes built-in maintenance routines runnable directly via CLI:

| Command | Purpose |
|---|---|
| `dotnet run -- bersihkan-file-yatim` | Audit/dry-run scan of orphaned files in `Uploads/` with no database record. |
| `dotnet run -- bersihkan-file-yatim --apply` | Permanently deletes orphaned files. |
| `dotnet run -- bersihkan-file-yatim --apply --min-umur-jam=72` | Deletes orphaned files older than 72 hours (grace period). |
| `dotnet run -- resetdb` | Drops and reseeds all tables (Development only). |

---

## 5. File Uploads & Security Safeguards

1. **Storage Path**: Physical files reside in `backend/Uploads/`.
2. **Magic Byte Validation (`SidikGambar.cs`)**: Uploaded images and invoice PDFs are verified by inspecting magic bytes (`%PDF-` for PDFs; JPEG/PNG/GIF/WebP magic signatures for images), preventing extension spoofing.
3. **Export Row Limiter (`BatasEkspor.cs`)**: All Excel (`ClosedXML`) and PDF (`QuestPDF`) exports enforce a hard ceiling of 5,000 rows to prevent Out-Of-Memory (OOM) crashes.
