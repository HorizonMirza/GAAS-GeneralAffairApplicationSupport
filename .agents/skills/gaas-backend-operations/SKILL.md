---
name: gaas-backend-operations
description: >-
  Operational runbook for GAAS ASP.NET Core backend development, Entity Framework Core migrations,
  database seeding (DbSeeder.cs), CLI maintenance tools, file storage, and API routing.
  Use when modifying controllers, updating EF Core entities, performing database operations, or troubleshooting backend services.
---

# GAAS Backend Operations & Architecture Guide

This skill documents the development and operational runbook for the GAAS backend service.

## 1. Service Overview & Launch Configuration

- **Framework**: ASP.NET Core Web API (C#)
- **Default Port**: `http://localhost:8000` (configured in `backend/Properties/launchSettings.json`)
- **Swagger Documentation**: Accessible at `http://localhost:8000/swagger` in Development mode.
- **Starting the Server**:
  ```bash
  cd backend
  dotnet run
  ```

## 2. Database & Entity Framework Core

- **DbContext**: Configured in `backend/Data/AppDbContext.cs`.
- **Database Migrations**:
  ```bash
  dotnet ef migrations add <MigrationName>
  dotnet ef database update
  ```
- **Seeder Pipeline (`backend/Data/DbSeeder.cs`)**:
  - Automatically seeds default master roles, divisions, departments, vehicle fleets, meeting rooms, and test users.
  - Password hashes are stored securely; accounts use seeded credentials defined in `DbSeeder.cs`.

## 3. Maintenance CLI Tools

The backend executable includes built-in command-line maintenance commands:

| Command | Purpose |
|---|---|
| `dotnet run -- bersihkan-file-yatim` | Performs a dry-run audit of orphaned uploaded files without deleting them. |
| `dotnet run -- bersihkan-file-yatim --apply` | Permanently deletes orphaned files that have no matching database record. |
| `dotnet run -- bersihkan-file-yatim --apply --min-umur-jam=72` | Deletes orphaned files older than 72 hours (grace period). |

## 4. File Upload & Media Storage

- Uploaded files (receipts, delivery notes, room photos, transmittal PDFs) are stored under the backend's `Uploads/` directory.
- File extensions are strictly validated to prevent execution of unapproved file formats.
- Physical uploads are mapped to virtual URLs served via static file middleware.
