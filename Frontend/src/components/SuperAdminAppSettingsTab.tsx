"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  Clock,
  Database,
  Download,
  Image as ImageIcon,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import ModalOverlay from "@/components/ModalOverlay";
import PasswordField from "@/components/PasswordField";
import DeleteWithPasswordModal from "@/components/DeleteWithPasswordModal";
import NotificationSoundSettingsCard from "@/components/NotificationSoundSettingsCard";
import type { AppSettings, Holiday } from "@/lib/types";

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Terjadi kesalahan";
}

// Super Admin-managed App Settings rendered in a modern Bento Grid Dashboard layout (Concept 4):
// Row 1: Nama Perusahaan & Logo Perusahaan (separated into independent cards)
// Row 2: Jam Operasional Fasilitas & Pengaturan Suara Notifikasi
// Row 3: Kalender Hari Libur (Full Width Table with Search & Add)
// Row 4: Backup Data Global (Full Width Administrative Archive)
export default function SuperAdminAppSettingsTab() {
  const { showToast } = useToast();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api.getAppSettings();
      setSettings(data);
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (busy || !settings) {
    return <div className="card"><div className="table-empty">Memuat data...</div></div>;
  }

  return (
    <div className="bento-settings-grid">
      <CompanyNameCard settings={settings} onSaved={setSettings} />
      <CompanyLogoCard settings={settings} onSaved={setSettings} />
      <OperatingHoursCard settings={settings} onSaved={setSettings} />
      <NotificationSoundSettingsCard />
      <HolidaysCard />
      <BackupCard />
    </div>
  );
}

// Bento Item 1: Nama / Identitas Perusahaan
function CompanyNameCard({ settings, onSaved }: { settings: AppSettings; onSaved: (s: AppSettings) => void }) {
  const { showToast } = useToast();

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [namePassword, setNamePassword] = useState("");
  const [nameFieldError, setNameFieldError] = useState("");
  const [namePasswordError, setNamePasswordError] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setCompanyName(settings.companyName);
  }, [settings.companyName]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const errs = { field: "", password: "" };
    if (!companyName.trim()) errs.field = "Nama perusahaan wajib diisi";
    if (!namePassword) errs.password = "Password wajib diisi";
    if (errs.field || errs.password) {
      setNameFieldError(errs.field);
      setNamePasswordError(errs.password);
      return;
    }
    setNameFieldError("");
    setNamePasswordError("");
    setSavingName(true);
    try {
      const updated = await api.updateAppSettings({
        companyName: companyName.trim(),
        operatingStart: settings.operatingStart,
        operatingEnd: settings.operatingEnd,
        password: namePassword,
      });
      onSaved(updated);
      setNamePassword("");
      showToast("Nama perusahaan berhasil disimpan");
    } catch (err) {
      const message = errorMessage(err);
      if (/password/i.test(message)) setNamePasswordError(message);
      else setNameFieldError(message);
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="bento-settings-card">
      <div className="bento-settings-header">
        <div className="bento-settings-header-left">
          <div className="bento-settings-icon-box">
            <Building2 width={18} height={18} />
          </div>
          <div className="bento-settings-title-wrap">
            <h3>Identitas Perusahaan</h3>
            <p className="bento-settings-desc">Nama instansi pada sidebar, halaman login, dan kop dokumen PDF</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveName} style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <div className="field full" style={{ marginBottom: 0 }}>
          <label htmlFor="app-settings-company-name">Nama Perusahaan</label>
          <input
            id="app-settings-company-name"
            type="text"
            placeholder="Contoh: PT Perusahaan Gas Negara"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          {nameFieldError && <div className="field-error-text">{nameFieldError}</div>}
        </div>
        <div className="field full" style={{ marginBottom: 0 }}>
          <PasswordField
            id="app-settings-name-password"
            label="Password Super Admin"
            placeholder="Masukkan Password"
            icon={<Lock width={15} height={15} />}
            value={namePassword}
            error={namePasswordError}
            onChange={(v) => {
              setNamePassword(v);
              if (namePasswordError) setNamePasswordError("");
            }}
          />
        </div>
        <button
          type="submit"
          className="btn btn-approve"
          style={{ width: "auto", alignSelf: "flex-start", marginTop: "auto" }}
          disabled={savingName}
        >
          {savingName ? "Menyimpan..." : "Simpan Nama Perusahaan"}
        </button>
      </form>
    </div>
  );
}

// Bento Item 2: Logo Perusahaan (Dipisah dari Identitas)
function CompanyLogoCard({ settings, onSaved }: { settings: AppSettings; onSaved: (s: AppSettings) => void }) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadPassword, setUploadPassword] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  async function handleUploadLogo(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Pilih file logo terlebih dahulu");
      return;
    }
    if (!uploadPassword) {
      setUploadError("Password wajib diisi");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const updated = await api.uploadAppLogo(selectedFile, uploadPassword);
      onSaved(updated);
      setSelectedFile(null);
      setUploadPassword("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast("Logo berhasil diunggah");
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleRevert(password: string) {
    const updated = await api.deleteAppLogo(password);
    onSaved(updated);
    setRevertOpen(false);
    showToast("Logo dikembalikan ke default");
  }

  return (
    <div className="bento-settings-card">
      <div className="bento-settings-header">
        <div className="bento-settings-header-left">
          <div className="bento-settings-icon-box">
            <ImageIcon width={18} height={18} />
          </div>
          <div className="bento-settings-title-wrap">
            <h3>Logo Perusahaan</h3>
            <p className="bento-settings-desc">Format JPG atau PNG transparan, ukuran file maksimal 5MB</p>
          </div>
        </div>
      </div>

      <div className="bento-logo-preview-box">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <img
            src={previewUrl ?? api.appLogoUrl(settings.updatedAt)}
            alt="Logo saat ini"
            className="bento-logo-img"
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedFile ? selectedFile.name : (settings.hasCustomLogo ? "Logo Kustom Aktif" : "Logo Default Sistem")}
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: 2 }}>
              {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : (settings.hasCustomLogo ? "Kustom diunggah" : "Bawaan sistem")}
            </div>
          </div>
        </div>
        {settings.hasCustomLogo && (
          <button
            type="button"
            className="card-icon-btn card-icon-btn-danger"
            style={{ padding: "6px 10px", fontSize: "0.76rem", height: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => setRevertOpen(true)}
            title="Kembalikan ke Default"
          >
            <RotateCcw width={13} height={13} /> Default
          </button>
        )}
      </div>

      <form onSubmit={handleUploadLogo} style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <div className="field full" style={{ marginBottom: 0 }}>
          <label htmlFor="app-settings-logo-file">Pilih File Logo Baru</label>
          <input
            id="app-settings-logo-file"
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="field full" style={{ marginBottom: 0 }}>
          <PasswordField
            id="app-settings-logo-password"
            label="Password Super Admin"
            placeholder="Masukkan Password"
            icon={<Lock width={15} height={15} />}
            value={uploadPassword}
            error={uploadError}
            onChange={(v) => {
              setUploadPassword(v);
              if (uploadError) setUploadError("");
            }}
          />
        </div>
        <button
          type="submit"
          className="btn btn-approve"
          style={{ width: "auto", alignSelf: "flex-start", marginTop: "auto" }}
          disabled={uploading}
        >
          <Upload width={16} height={16} /> {uploading ? "Mengunggah..." : "Unggah Logo"}
        </button>
      </form>

      <DeleteWithPasswordModal
        open={revertOpen}
        title="Kembalikan Logo ke Default"
        onConfirm={handleRevert}
        onClose={() => setRevertOpen(false)}
        passwordFieldId="app-settings-revert-logo-password"
      />
    </div>
  );
}

// Bento Item 3: Jam Operasional Kantor
function OperatingHoursCard({ settings, onSaved }: { settings: AppSettings; onSaved: (s: AppSettings) => void }) {
  const { showToast } = useToast();
  const [start, setStart] = useState(settings.operatingStart);
  const [end, setEnd] = useState(settings.operatingEnd);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStart(settings.operatingStart);
    setEnd(settings.operatingEnd);
  }, [settings.operatingStart, settings.operatingEnd]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Password wajib diisi");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const updated = await api.updateAppSettings({
        companyName: settings.companyName,
        operatingStart: start,
        operatingEnd: end,
        password,
      });
      onSaved(updated);
      setPassword("");
      showToast("Jam operasional berhasil disimpan");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bento-settings-card">
      <div className="bento-settings-header">
        <div className="bento-settings-header-left">
          <div className="bento-settings-icon-box">
            <Clock width={18} height={18} />
          </div>
          <div className="bento-settings-title-wrap">
            <h3>Jam Operasional</h3>
            <p className="bento-settings-desc">Rentang jam yang diizinkan untuk Booking Ruang Meeting & Kendaraan</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="app-settings-hours-start">Jam Mulai</label>
            <input
              id="app-settings-hours-start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="app-settings-hours-end">Jam Selesai</label>
            <input
              id="app-settings-hours-end"
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
        <div className="field full" style={{ marginBottom: 0 }}>
          <PasswordField
            id="app-settings-hours-password"
            label="Password Super Admin"
            placeholder="Masukkan Password"
            icon={<Lock width={15} height={15} />}
            value={password}
            error={error}
            onChange={(v) => {
              setPassword(v);
              if (error) setError("");
            }}
          />
        </div>
        <button
          type="submit"
          className="btn btn-approve"
          style={{ width: "auto", alignSelf: "flex-start", marginTop: "auto" }}
          disabled={saving}
        >
          {saving ? "Menyimpan..." : "Simpan Jam Operasional"}
        </button>
      </form>
    </div>
  );
}

// Bento Item 5: Kalender Hari Libur (Full Width)
interface HolidayFormState {
  date: string;
  label: string;
  password: string;
}

const EMPTY_HOLIDAY_FORM: HolidayFormState = { date: "", label: "", password: "" };

function HolidaysCard() {
  const { showToast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<HolidayFormState>(EMPTY_HOLIDAY_FORM);
  const [formErrors, setFormErrors] = useState<{ date?: string; label?: string; password?: string; general?: string }>({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api.listHolidays();
      setHolidays(data.holidays);
    } catch {
      setHolidays([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY_HOLIDAY_FORM);
    setFormErrors({});
    setFormOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof formErrors = {};
    if (!form.date) errs.date = "Tanggal wajib diisi";
    if (!form.label.trim()) errs.label = "Nama hari libur wajib diisi";
    if (!form.password) errs.password = "Password wajib diisi";
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});

    setSaving(true);
    try {
      await api.createHoliday({ date: form.date, label: form.label.trim(), password: form.password });
      showToast("Hari libur berhasil ditambahkan");
      setFormOpen(false);
      await load();
    } catch (err) {
      const message = errorMessage(err);
      if (/tanggal/i.test(message)) setFormErrors({ date: message });
      else if (/password/i.test(message)) setFormErrors({ password: message });
      else setFormErrors({ general: message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm(password: string) {
    if (!deleteTarget) return;
    await api.deleteHoliday(deleteTarget.id, password);
    showToast("Hari libur berhasil dihapus");
    setDeleteTarget(null);
    await load();
  }

  const query = search.trim().toLowerCase();
  const filteredHolidays = holidays.filter(
    (h) => h.label.toLowerCase().includes(query) || h.date.includes(query)
  );

  return (
    <div className="bento-settings-card">
      <div className="bento-settings-header">
        <div className="bento-settings-header-left">
          <div className="bento-settings-icon-box">
            <Calendar width={18} height={18} />
          </div>
          <div className="bento-settings-title-wrap">
            <h3>Kalender Hari Libur</h3>
            <p className="bento-settings-desc">
              Tanggal libur yang menonaktifkan pemesanan fasilitas gedung
            </p>
          </div>
        </div>
      </div>

      <div className="settings-table-toolbar" style={{ gap: 8, marginBottom: 12 }}>
        <div className="settings-table-toolbar-left" style={{ minWidth: 160 }}>
          <div className="settings-table-search">
            <Search width={16} height={16} />
            <input
              type="text"
              placeholder="Cari Hari Libur"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="settings-table-count-box">
            {filteredHolidays.length} Data
          </div>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openCreate}>
          <Plus width={16} height={16} /> Tambah
        </button>
      </div>

      <div className="table-wrap" style={{ flex: 1, minHeight: 160 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>No</th>
              <th style={{ width: 110 }}>Tanggal</th>
              <th>Nama Hari Libur</th>
              <th style={{ width: 50, textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={4} className="table-empty">Memuat data...</td></tr>
            ) : filteredHolidays.length === 0 ? (
              <tr><td colSpan={4} className="table-empty">Tidak Ada Data</td></tr>
            ) : (
              filteredHolidays.map((h, index) => (
                <tr key={h.id}>
                  <td>{index + 1}</td>
                  <td style={{ fontWeight: 600 }}>{h.date}</td>
                  <td>{h.label}</td>
                  <td style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="card-icon-btn card-icon-btn-danger"
                      aria-label="Hapus"
                      title="Hapus"
                      onClick={() => setDeleteTarget(h)}
                    >
                      <Trash2 width={16} height={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalOverlay open={formOpen} onClose={() => setFormOpen(false)} className={`modal-overlay modal-overlay-centered ${formOpen ? "" : "hidden"}`}>
        <div className="modal" style={{ maxWidth: 460 }}>
          <div className="modal-header">
            <h3>Tambah Hari Libur</h3>
            <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>&times;</button>
          </div>

          <div className={`alert-error ${formErrors.general ? "alert-error-visible" : ""}`}>
            <div className="alert-error-text"><strong>Error</strong><span>{formErrors.general}</span></div>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="holiday-form-date">Tanggal</label>
                <input id="holiday-form-date" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                {formErrors.date && <div className="field-error-text">{formErrors.date}</div>}
              </div>
              <div className="field full">
                <label htmlFor="holiday-form-label">Nama Hari Libur</label>
                <input id="holiday-form-label" type="text" placeholder="Contoh: Hari Kemerdekaan RI" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
                {formErrors.label && <div className="field-error-text">{formErrors.label}</div>}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <PasswordField
                id="holiday-form-password"
                label="Password Super Admin"
                placeholder="Masukkan Password"
                icon={<Lock width={15} height={15} />}
                value={form.password}
                error={formErrors.password}
                onChange={(v) => { setForm((f) => ({ ...f, password: v })); if (formErrors.password) setFormErrors((e) => ({ ...e, password: undefined })); }}
              />
            </div>

            <div className="modal-actions">
              <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Hari Libur"}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      <DeleteWithPasswordModal
        open={!!deleteTarget}
        title="Hapus Hari Libur"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
        passwordFieldId="app-settings-delete-holiday-password"
      >
        {deleteTarget && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="delete-holiday-date">Tanggal</label>
              <input id="delete-holiday-date" type="text" value={deleteTarget.date} disabled readOnly />
            </div>
            <div className="field full">
              <label htmlFor="delete-holiday-label">Nama Hari Libur</label>
              <input id="delete-holiday-label" type="text" value={deleteTarget.label} disabled readOnly />
            </div>
          </div>
        )}
      </DeleteWithPasswordModal>
    </div>
  );
}

// Bento Item 6: Backup Data Global (Side-by-side with HolidaysCard)
function BackupCard() {
  return (
    <div className="bento-settings-card">
      <div className="bento-settings-header">
        <div className="bento-settings-header-left">
          <div className="bento-settings-icon-box">
            <Database width={18} height={18} />
          </div>
          <div className="bento-settings-title-wrap">
            <h3>Backup Data Global</h3>
            <p className="bento-settings-desc">
              Arsip komprehensif seluruh modul dan database sistem
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.55, margin: 0 }}>
          Unduh satu file Excel (.xlsx) komprehensif berisi seluruh data sistem (Ekspedisi, Office Supplies,
          Maintenance, Arsip, Booking Ruang Meeting, Booking Kendaraan, Users, Organisasi, Master Data,
          Pengaturan Aplikasi, dan Riwayat Penghapusan) untuk kebutuhan arsip dan cadangan tahunan.
        </p>

        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-hover, #f8fafc)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            Cakupan Data Cadangan:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Ekspedisi", "Office Supplies", "Maintenance", "Arsip", "Ruang Meeting", "Kendaraan", "Users & Organisasi", "Master Data"].map((item) => (
              <span
                key={item}
                style={{
                  fontSize: "0.72rem",
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-approve"
          style={{ width: "auto", alignSelf: "flex-start", marginTop: "auto" }}
          onClick={() => window.open(api.globalExportUrl(), "_blank")}
        >
          <Download width={16} height={16} /> Unduh Backup (.xlsx)
        </button>
      </div>
    </div>
  );
}
