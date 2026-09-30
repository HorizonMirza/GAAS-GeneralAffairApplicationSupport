"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  ChevronRight,
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
  Volume2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import ModalOverlay from "@/components/ModalOverlay";
import PasswordField from "@/components/PasswordField";
import DeleteWithPasswordModal from "@/components/DeleteWithPasswordModal";
import SearchableSelect from "@/components/SearchableSelect";
import { previewSound, setNotificationSoundIds, SOUND_PRESETS } from "@/lib/notificationSound";
import type { AppSettings, Holiday } from "@/lib/types";

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Terjadi kesalahan";
}

const SOUND_OPTIONS = Object.keys(SOUND_PRESETS);
const soundLabel = (id: string) => SOUND_PRESETS[id]?.label || id;

// Super Admin App Settings: Accordion 2.0 with Live Summary Badges (Concept 4)
// Collapsible panels matching GAAS module settings convention, all closed by default.
// Displays live summary badge on each item header so settings can be inspected at a glance.
export default function SuperAdminAppSettingsTab() {
  const { showToast } = useToast();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [busy, setBusy] = useState(true);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    <div className="settings-accordion">
      <CompanyNameAccordionItem
        settings={settings}
        onSaved={setSettings}
        isOpen={!!openItems["name"]}
        onToggle={() => toggleItem("name")}
      />
      <CompanyLogoAccordionItem
        settings={settings}
        onSaved={setSettings}
        isOpen={!!openItems["logo"]}
        onToggle={() => toggleItem("logo")}
      />
      <OperatingHoursAccordionItem
        settings={settings}
        onSaved={setSettings}
        isOpen={!!openItems["hours"]}
        onToggle={() => toggleItem("hours")}
      />
      <NotificationSoundAccordionItem
        isOpen={!!openItems["sound"]}
        onToggle={() => toggleItem("sound")}
      />
      <HolidaysAccordionItem
        isOpen={!!openItems["holidays"]}
        onToggle={() => toggleItem("holidays")}
      />
      <BackupAccordionItem
        isOpen={!!openItems["backup"]}
        onToggle={() => toggleItem("backup")}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Identitas Perusahaan
// ---------------------------------------------------------------------------
function CompanyNameAccordionItem({
  settings,
  onSaved,
  isOpen,
  onToggle,
}: {
  settings: AppSettings;
  onSaved: (s: AppSettings) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
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
    <div className={`settings-accordion-item ${isOpen ? "open" : ""}`}>
      <button type="button" className="settings-accordion-head" onClick={onToggle}>
        <div className="settings-accordion-head-left">
          <div className="settings-accordion-icon-box">
            <Building2 width={18} height={18} />
          </div>
          <div className="settings-accordion-info">
            <h3>Identitas Perusahaan</h3>
            <p className="settings-accordion-desc">Nama instansi pada sidebar, halaman login, dan kop dokumen PDF</p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-badge">{settings.companyName || "Belum diatur"}</span>
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <form onSubmit={handleSaveName} className="form-grid" style={{ maxWidth: 640 }}>
              <div className="field full">
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
              <div className="field full">
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
              <div className="field full">
                <button
                  type="submit"
                  className="btn btn-approve"
                  style={{ width: "auto" }}
                  disabled={savingName}
                >
                  {savingName ? "Menyimpan..." : "Simpan Nama Perusahaan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Logo Perusahaan
// ---------------------------------------------------------------------------
function CompanyLogoAccordionItem({
  settings,
  onSaved,
  isOpen,
  onToggle,
}: {
  settings: AppSettings;
  onSaved: (s: AppSettings) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
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
    <div className={`settings-accordion-item ${isOpen ? "open" : ""}`}>
      <button type="button" className="settings-accordion-head" onClick={onToggle}>
        <div className="settings-accordion-head-left">
          <div className="settings-accordion-icon-box">
            <ImageIcon width={18} height={18} />
          </div>
          <div className="settings-accordion-info">
            <h3>Logo Perusahaan</h3>
            <p className="settings-accordion-desc">Format JPG atau PNG transparan, ukuran file maksimal 5MB</p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-badge">
            {settings.hasCustomLogo ? "Logo Kustom Aktif" : "Logo Default Sistem"}
          </span>
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div style={{ maxWidth: 640 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "0.82rem", fontWeight: 600 }}>
                Logo Saat Ini
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--bg-hover, #f8fafc)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <img
                    src={previewUrl ?? api.appLogoUrl(settings.updatedAt)}
                    alt="Logo aktif"
                    style={{
                      maxWidth: 160,
                      maxHeight: 48,
                      width: "auto",
                      height: "auto",
                      background: "#ffffff",
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border-subtle)",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {selectedFile ? selectedFile.name : (settings.hasCustomLogo ? "Logo Kustom Diunggah" : "Logo Default Bawaan")}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: 2 }}>
                      {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : "Ditampilkan pada header aplikasi dan dokumen resmi"}
                    </div>
                  </div>
                </div>
                {settings.hasCustomLogo && (
                  <button
                    type="button"
                    className="card-icon-btn card-icon-btn-danger"
                    style={{ padding: "6px 12px", fontSize: "0.76rem", height: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                    onClick={() => setRevertOpen(true)}
                  >
                    <RotateCcw width={14} height={14} /> Kembalikan ke Default
                  </button>
                )}
              </div>

              <form onSubmit={handleUploadLogo} className="form-grid">
                <div className="field full">
                  <label htmlFor="app-settings-logo-file">Pilih File Logo Baru (JPG/PNG, maks 5MB)</label>
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
                    onChange={(v) => {
                      setUploadPassword(v);
                      if (uploadError) setUploadError("");
                    }}
                  />
                </div>
                <div className="field full">
                  <button
                    type="submit"
                    className="btn btn-approve"
                    style={{ width: "auto" }}
                    disabled={uploading}
                  >
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
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Jam Operasional
// ---------------------------------------------------------------------------
function OperatingHoursAccordionItem({
  settings,
  onSaved,
  isOpen,
  onToggle,
}: {
  settings: AppSettings;
  onSaved: (s: AppSettings) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
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
    <div className={`settings-accordion-item ${isOpen ? "open" : ""}`}>
      <button type="button" className="settings-accordion-head" onClick={onToggle}>
        <div className="settings-accordion-head-left">
          <div className="settings-accordion-icon-box">
            <Clock width={18} height={18} />
          </div>
          <div className="settings-accordion-info">
            <h3>Jam Operasional</h3>
            <p className="settings-accordion-desc">Rentang jam yang diizinkan untuk Booking Ruang Meeting & Kendaraan</p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-badge">
            {settings.operatingStart} - {settings.operatingEnd}
          </span>
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <form onSubmit={handleSubmit} className="form-grid" style={{ maxWidth: 640 }}>
              <div className="field">
                <label htmlFor="app-settings-hours-start">Jam Mulai</label>
                <input
                  id="app-settings-hours-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="app-settings-hours-end">Jam Selesai</label>
                <input
                  id="app-settings-hours-end"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
              <div className="field full">
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
              <div className="field full">
                <button
                  type="submit"
                  className="btn btn-approve"
                  style={{ width: "auto" }}
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Simpan Jam Operasional"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Pengaturan Suara Notifikasi
// ---------------------------------------------------------------------------
function NotificationSoundAccordionItem({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { showToast } = useToast();
  const [chatSoundId, setChatSoundId] = useState<string>("");
  const [activitySoundId, setActivitySoundId] = useState<string>("");
  const [saved, setSaved] = useState<{ chat: string; activity: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getNotificationSoundSettings()
      .then((s) => {
        setChatSoundId(s.chatSoundId);
        setActivitySoundId(s.activitySoundId);
        setSaved({ chat: s.chatSoundId, activity: s.activitySoundId });
      })
      .catch(() => showToast("Gagal memuat pengaturan suara notifikasi", "error"))
      .finally(() => setBusy(false));
  }, [showToast]);

  const dirty = !!saved && (saved.chat !== chatSoundId || saved.activity !== activitySoundId);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await api.updateNotificationSoundSettings({ chatSoundId, activitySoundId });
      setNotificationSoundIds(result);
      setSaved({ chat: result.chatSoundId, activity: result.activitySoundId });
      showToast("Pengaturan suara notifikasi disimpan");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const badgeText = busy
    ? "Memuat..."
    : `${soundLabel(chatSoundId)} / ${soundLabel(activitySoundId)}`;

  return (
    <div className={`settings-accordion-item ${isOpen ? "open" : ""}`}>
      <button type="button" className="settings-accordion-head" onClick={onToggle}>
        <div className="settings-accordion-head-left">
          <div className="settings-accordion-icon-box">
            <Volume2 width={18} height={18} />
          </div>
          <div className="settings-accordion-info">
            <h3>Pengaturan Suara Notifikasi</h3>
            <p className="settings-accordion-desc">Preset audio untuk pesan chat real-time dan notifikasi approval transaksi</p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-badge">{badgeText}</span>
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div style={{ maxWidth: 640 }}>
              <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Suara ini berlaku untuk semua pengguna. Klik tombol 🔊 di sebelah dropdown untuk mendengarkan nada pilihan Anda.
              </p>

              <div className="notification-sound-settings-row">
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label htmlFor="notif-sound-chat">Suara Chat</label>
                  <SearchableSelect
                    id="notif-sound-chat"
                    value={busy ? undefined : chatSoundId}
                    onChange={setChatSoundId}
                    options={SOUND_OPTIONS}
                    getLabel={soundLabel}
                    placeholder="Pilih suara chat"
                    disabled={busy}
                  />
                </div>
                <button
                  type="button"
                  className="icon-btn notification-sound-preview-btn"
                  aria-label="Dengarkan suara chat"
                  disabled={!chatSoundId}
                  onClick={() => previewSound(chatSoundId)}
                  title="Dengarkan suara chat"
                >
                  <Volume2 width={18} height={18} />
                </button>
              </div>

              <div className="notification-sound-settings-row">
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label htmlFor="notif-sound-activity">Suara Transaksi/Approval</label>
                  <SearchableSelect
                    id="notif-sound-activity"
                    value={busy ? undefined : activitySoundId}
                    onChange={setActivitySoundId}
                    options={SOUND_OPTIONS}
                    getLabel={soundLabel}
                    placeholder="Pilih suara approval"
                    disabled={busy}
                  />
                </div>
                <button
                  type="button"
                  className="icon-btn notification-sound-preview-btn"
                  aria-label="Dengarkan suara transaksi"
                  disabled={!activitySoundId}
                  onClick={() => previewSound(activitySoundId)}
                  title="Dengarkan suara transaksi"
                >
                  <Volume2 width={18} height={18} />
                </button>
              </div>

              <button
                type="button"
                className="btn btn-approve"
                style={{ width: "auto", marginTop: 8 }}
                disabled={busy || saving || !dirty}
                onClick={handleSave}
              >
                {saving ? "Menyimpan..." : "Simpan Suara Notifikasi"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Kalender Hari Libur
// ---------------------------------------------------------------------------
interface HolidayFormState {
  date: string;
  label: string;
  password: string;
}

const EMPTY_HOLIDAY_FORM: HolidayFormState = { date: "", label: "", password: "" };

function HolidaysAccordionItem({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
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
    <div className={`settings-accordion-item ${isOpen ? "open" : ""}`}>
      <button type="button" className="settings-accordion-head" onClick={onToggle}>
        <div className="settings-accordion-head-left">
          <div className="settings-accordion-icon-box">
            <Calendar width={18} height={18} />
          </div>
          <div className="settings-accordion-info">
            <h3>Kalender Hari Libur</h3>
            <p className="settings-accordion-desc">Tanggal libur nasional dan cuti kantor yang otomatis menonaktifkan pemesanan fasilitas gedung</p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-badge">
            {busy ? "Memuat..." : `${holidays.length} Hari Libur`}
          </span>
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div className="settings-table-toolbar">
              <div className="settings-table-toolbar-left">
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

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 64 }}>No</th>
                    <th style={{ width: 180 }}>Tanggal</th>
                    <th>Nama Hari Libur</th>
                    <th style={{ width: 80, textAlign: "right" }}>Aksi</th>
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
                      <input
                        id="holiday-form-date"
                        type="date"
                        required
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      />
                      {formErrors.date && <div className="field-error-text">{formErrors.date}</div>}
                    </div>
                    <div className="field full">
                      <label htmlFor="holiday-form-label">Nama Hari Libur</label>
                      <input
                        id="holiday-form-label"
                        type="text"
                        placeholder="Contoh: Hari Kemerdekaan RI"
                        value={form.label}
                        onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                      />
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
                      onChange={(v) => {
                        setForm((f) => ({ ...f, password: v }));
                        if (formErrors.password) setFormErrors((e) => ({ ...e, password: undefined }));
                      }}
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
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Backup Data Global
// ---------------------------------------------------------------------------
function BackupAccordionItem({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`settings-accordion-item ${isOpen ? "open" : ""}`}>
      <button type="button" className="settings-accordion-head" onClick={onToggle}>
        <div className="settings-accordion-head-left">
          <div className="settings-accordion-icon-box">
            <Database width={18} height={18} />
          </div>
          <div className="settings-accordion-info">
            <h3>Backup Data Global</h3>
            <p className="settings-accordion-desc">Unduh satu file Excel (.xlsx) komprehensif berisi seluruh modul dan database sistem</p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-badge">Format .xlsx</span>
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div style={{ maxWidth: 760 }}>
              <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: "0.82rem", lineHeight: 1.55 }}>
                Unduh satu file Excel (.xlsx) komprehensif berisi seluruh data sistem untuk kebutuhan arsip dan cadangan tahunan:
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 20,
                  padding: 14,
                  borderRadius: 10,
                  background: "var(--bg-hover, #f8fafc)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {[
                  "Ekspedisi",
                  "Office Supplies",
                  "Maintenance",
                  "Arsip Dokumen",
                  "Booking Ruang Meeting",
                  "Booking Kendaraan",
                  "Manajemen Pengguna (Users)",
                  "Struktur Organisasi",
                  "Master Data Sistem",
                  "Pengaturan Aplikasi",
                  "Riwayat Penghapusan Data",
                ].map((item) => (
                  <span
                    key={item}
                    style={{
                      fontSize: "0.74rem",
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    ✓ {item}
                  </span>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-approve"
                style={{ width: "auto" }}
                onClick={() => window.open(api.globalExportUrl(), "_blank")}
              >
                <Download width={16} height={16} /> Unduh Backup (.xlsx)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
