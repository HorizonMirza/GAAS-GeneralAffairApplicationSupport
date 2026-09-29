"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Lock, Plus, Trash2, Upload } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import ModalOverlay from "@/components/ModalOverlay";
import PasswordField from "@/components/PasswordField";
import DeleteWithPasswordModal from "@/components/DeleteWithPasswordModal";
import type { AppSettings, Holiday } from "@/lib/types";

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Terjadi kesalahan";
}

// Super Admin-managed company branding (name + logo, shown in the sidebar, login page and every
// PDF export - see useAppSettings) and Room/Vehicle Booking's operating hours + holiday calendar
// (see AppSettingsCache/BookingRuangController/BookingKendaraanController). Three independent
// cards, each its own password-gated save, same convention as SuperAdminMasterDataTab.
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BrandingCard settings={settings} onSaved={setSettings} />
      <OperatingHoursCard settings={settings} onSaved={setSettings} />
      <HolidaysCard />
      <BackupCard />
    </div>
  );
}

function BackupCard() {
  return (
    <div className="card">
      <div className="card-header"><h3>Backup Data</h3></div>
      <p style={{ marginTop: -8, marginBottom: 16, color: "var(--text-muted, #666)", fontSize: 13 }}>
        Unduh satu file Excel berisi seluruh data sistem (Ekspedisi, Office Supplies, Maintenance,
        Arsip, Booking Ruang Meeting, Booking Kendaraan, Users, Organisasi, Master Data,
        Pengaturan Aplikasi, dan Riwayat Penghapusan) - untuk kebutuhan arsip/backup tahunan.
      </p>
      <button
        type="button"
        className="btn btn-approve"
        style={{ width: "auto" }}
        onClick={() => window.open(api.globalExportUrl(), "_blank")}
      >
        <Download width={16} height={16} /> Unduh Backup (.xlsx)
      </button>
    </div>
  );
}

function BrandingCard({ settings, onSaved }: { settings: AppSettings; onSaved: (s: AppSettings) => void }) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [namePassword, setNamePassword] = useState("");
  const [nameFieldError, setNameFieldError] = useState("");
  const [namePasswordError, setNamePasswordError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadPassword, setUploadPassword] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [revertOpen, setRevertOpen] = useState(false);

  useEffect(() => {
    setCompanyName(settings.companyName);
  }, [settings.companyName]);

  useEffect(() => {
    if (!selectedFile) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const errs = { field: "", password: "" };
    if (!companyName.trim()) errs.field = "Nama perusahaan wajib diisi";
    if (!namePassword) errs.password = "Password wajib diisi";
    if (errs.field || errs.password) { setNameFieldError(errs.field); setNamePasswordError(errs.password); return; }
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

  async function handleUploadLogo(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) { setUploadError("Pilih file logo terlebih dahulu"); return; }
    if (!uploadPassword) { setUploadError("Password wajib diisi"); return; }
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
    <div className="card">
      <div className="card-header"><h3>Nama & Logo Perusahaan</h3></div>

      <form onSubmit={handleSaveName} className="form-grid" style={{ marginBottom: 20 }}>
        <div className="field full">
          <label htmlFor="app-settings-company-name">Nama Perusahaan</label>
          <input
            id="app-settings-company-name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          {nameFieldError && <div className="field-error-text">{nameFieldError}</div>}
        </div>
        <div className="field full">
          <PasswordField
            id="app-settings-name-password"
            label="Password Super Admin"
            placeholder="Masukkan Password"
            icon={<Lock width={15} height={15} />}
            value={namePassword}
            error={namePasswordError}
            onChange={(v) => { setNamePassword(v); if (namePasswordError) setNamePasswordError(""); }}
          />
        </div>
        <div className="field full">
          <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={savingName}>
            {savingName ? "Menyimpan..." : "Simpan Nama Perusahaan"}
          </button>
        </div>
      </form>

      <div style={{ borderTop: "1px solid var(--border-color, #e5e7eb)", paddingTop: 16 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>Logo</label>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          <img
            src={previewUrl ?? api.appLogoUrl(settings.updatedAt)}
            alt="Logo saat ini"
            style={{ maxWidth: 200, maxHeight: 64, width: "auto", height: "auto", background: "#f5f5f5", padding: 8, borderRadius: 6 }}
          />
          {settings.hasCustomLogo && (
            <button type="button" className="card-icon-btn card-icon-btn-danger" onClick={() => setRevertOpen(true)}>
              Kembalikan ke Default
            </button>
          )}
        </div>

        <form onSubmit={handleUploadLogo} className="form-grid">
          <div className="field full">
            <label htmlFor="app-settings-logo-file">File Logo Baru (JPG/PNG, maks 5MB)</label>
            <input
              id="app-settings-logo-file"
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="field full">
            <PasswordField
              id="app-settings-logo-password"
              label="Password Super Admin"
              placeholder="Masukkan Password"
              icon={<Lock width={15} height={15} />}
              value={uploadPassword}
              error={uploadError}
              onChange={(v) => { setUploadPassword(v); if (uploadError) setUploadError(""); }}
            />
          </div>
          <div className="field full">
            <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={uploading}>
              <Upload width={16} height={16} /> {uploading ? "Mengunggah..." : "Unggah Logo"}
            </button>
          </div>
        </form>
      </div>

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
    if (!password) { setError("Password wajib diisi"); return; }
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
    <div className="card">
      <div className="card-header"><h3>Jam Operasional</h3></div>
      <p style={{ marginTop: -8, marginBottom: 16, color: "var(--text-muted, #666)", fontSize: 13 }}>
        Rentang jam yang diizinkan untuk Booking Ruang Meeting dan Booking Kendaraan.
      </p>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="field">
          <label htmlFor="app-settings-hours-start">Jam Mulai</label>
          <input id="app-settings-hours-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="app-settings-hours-end">Jam Selesai</label>
          <input id="app-settings-hours-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="field full">
          <PasswordField
            id="app-settings-hours-password"
            label="Password Super Admin"
            placeholder="Masukkan Password"
            icon={<Lock width={15} height={15} />}
            value={password}
            error={error}
            onChange={(v) => { setPassword(v); if (error) setError(""); }}
          />
        </div>
        <div className="field full">
          <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Jam Operasional"}
          </button>
        </div>
      </form>
    </div>
  );
}

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
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
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

  return (
    <div className="card">
      <div className="card-header" style={{ justifyContent: "space-between" }}>
        <h3>Hari Libur</h3>
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openCreate}>
          <Plus width={16} height={16} /> Tambah Hari Libur
        </button>
      </div>
      <p style={{ marginTop: -8, marginBottom: 16, color: "var(--text-muted, #666)", fontSize: 13 }}>
        Tanggal yang tercantum di sini tidak bisa dipilih saat Booking Ruang Meeting atau Booking Kendaraan.
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>No</th><th>Tanggal</th><th>Nama Hari Libur</th><th></th></tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={4} className="table-empty">Memuat data...</td></tr>
            ) : holidays.length === 0 ? (
              <tr><td colSpan={4} className="table-empty">Tidak Ada Data</td></tr>
            ) : (
              holidays.map((h, index) => (
                <tr key={h.id}>
                  <td>{index + 1}</td>
                  <td>{h.date}</td>
                  <td>{h.label}</td>
                  <td style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" className="card-icon-btn card-icon-btn-danger" aria-label="Hapus" title="Hapus" onClick={() => setDeleteTarget(h)}>
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
                {saving ? "Menyimpan..." : "Save"}
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
