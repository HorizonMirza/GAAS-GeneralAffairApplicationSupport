"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Download,
  Image as ImageIcon,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  Volume2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import ModalOverlay from "@/components/ModalOverlay";
import PasswordField from "@/components/PasswordField";
import DeleteWithPasswordModal from "@/components/DeleteWithPasswordModal";
import SearchableSelect from "@/components/SearchableSelect";
import { previewSound, setNotificationSoundIds, SOUND_PRESETS } from "@/lib/notificationSound";
import DateFilterPicker from "@/components/DateFilterPicker";
import { formatDate, todayLocalDate } from "@/lib/format";
import type { AppSettings, Holiday } from "@/lib/types";

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Terjadi kesalahan";
}

const SOUND_OPTIONS = Object.keys(SOUND_PRESETS);
const soundLabel = (id: string) => SOUND_PRESETS[id]?.label || id;

function formatDateTimeWib(isoStr?: string): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

// Super Admin App Settings: Accordion 2.0 with Full History Tables (matching Gambar 4):
// 1. Clean accordion headers with only the chevron arrow (badges from Gambar 1 removed).
// 2. Subtitles customized with uniform standard template language ("Kelola ... untuk operasional ...").
// 3. Every section contains a standard GAAS data table with Search, Count box, "+ Tambah" button,
//    change history tracking (how many times it was changed), and Edit / Delete buttons.
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
      <CompanyNameTableAccordionItem
        settings={settings}
        onSaved={setSettings}
        isOpen={!!openItems["name"]}
        onToggle={() => toggleItem("name")}
      />
      <CompanyLogoTableAccordionItem
        settings={settings}
        onSaved={setSettings}
        isOpen={!!openItems["logo"]}
        onToggle={() => toggleItem("logo")}
      />
      <OperatingHoursTableAccordionItem
        settings={settings}
        onSaved={setSettings}
        isOpen={!!openItems["hours"]}
        onToggle={() => toggleItem("hours")}
      />
      <NotificationSoundTableAccordionItem
        settings={settings}
        isOpen={!!openItems["sound"]}
        onToggle={() => toggleItem("sound")}
      />
      <HolidaysTableAccordionItem
        isOpen={!!openItems["holidays"]}
        onToggle={() => toggleItem("holidays")}
      />
      <BackupTableAccordionItem
        isOpen={!!openItems["backup"]}
        onToggle={() => toggleItem("backup")}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Identitas Perusahaan (Tabel Riwayat & Pengaturan)
// ---------------------------------------------------------------------------
interface CompanyNameHistoryRecord {
  id: string;
  name: string;
  status: "Aktif" | "Riwayat";
  updatedAt: string;
  changeCount: number;
}

function CompanyNameTableAccordionItem({
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
  const [history, setHistory] = useState<CompanyNameHistoryRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("gaas_company_name_history");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [
      {
        id: "init",
        name: settings.companyName,
        status: "Aktif",
        updatedAt: settings.updatedAt,
        changeCount: 1,
      },
    ];
  });

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; password?: string; general?: string }>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyNameHistoryRecord | null>(null);

  // Sync with current settings if name changed externally
  useEffect(() => {
    setHistory((prev) => {
      const active = prev.find((h) => h.status === "Aktif");
      if (active && active.name === settings.companyName) return prev;
      const updated: CompanyNameHistoryRecord[] = [
        {
          id: String(Date.now()),
          name: settings.companyName,
          status: "Aktif",
          updatedAt: settings.updatedAt || new Date().toISOString(),
          changeCount: prev.length + 1,
        },
        ...prev.map((h) => ({ ...h, status: "Riwayat" as const })),
      ];
      try {
        localStorage.setItem("gaas_company_name_history", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [settings.companyName, settings.updatedAt]);

  const filteredHistory = history.filter((h) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const statusText = h.status === "Aktif" ? "aktif" : "non aktif riwayat";
    return h.name.toLowerCase().includes(q) || statusText.includes(q);
  });

  function openChange() {
    setFormName(settings.companyName);
    setFormPassword("");
    setFormErrors({});
    setFormOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof formErrors = {};
    if (!formName.trim()) errs.name = "Nama perusahaan wajib diisi";
    if (!formPassword) errs.password = "Password wajib diisi";
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});

    setSaving(true);
    try {
      const updated = await api.updateAppSettings({
        companyName: formName.trim(),
        operatingStart: settings.operatingStart,
        operatingEnd: settings.operatingEnd,
        password: formPassword,
      });
      onSaved(updated);

      const nextHistory: CompanyNameHistoryRecord[] = [
        {
          id: String(Date.now()),
          name: formName.trim(),
          status: "Aktif",
          updatedAt: new Date().toISOString(),
          changeCount: history.length + 1,
        },
        ...history.map((h) => ({ ...h, status: "Riwayat" as const })),
      ];
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_company_name_history", JSON.stringify(nextHistory));
      } catch {}

      showToast("Nama perusahaan berhasil diperbarui");
      setFormOpen(false);
    } catch (err) {
      const message = errorMessage(err);
      if (/password/i.test(message)) setFormErrors({ password: message });
      else setFormErrors({ general: message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm(password: string) {
    if (!deleteTarget) return;

    if (deleteTarget.status === "Aktif") {
      // Revert to default
      const defaultName = "PGN Solution";
      const updated = await api.updateAppSettings({
        companyName: defaultName,
        operatingStart: settings.operatingStart,
        operatingEnd: settings.operatingEnd,
        password,
      });
      onSaved(updated);
      const nextHistory = history.filter((h) => h.id !== deleteTarget.id);
      if (nextHistory.length === 0 || !nextHistory.some((h) => h.status === "Aktif")) {
        nextHistory.unshift({
          id: String(Date.now()),
          name: defaultName,
          status: "Aktif",
          updatedAt: new Date().toISOString(),
          changeCount: history.length + 1,
        });
      }
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_company_name_history", JSON.stringify(nextHistory));
      } catch {}
      showToast("Nama perusahaan dikembalikan ke default");
    } else {
      const nextHistory = history.filter((h) => h.id !== deleteTarget.id);
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_company_name_history", JSON.stringify(nextHistory));
      } catch {}
      showToast("Riwayat perubahan berhasil dihapus");
    }
    setDeleteTarget(null);
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
            <p className="settings-accordion-desc">
              Kelola nama resmi perusahaan dan identitas instansi untuk operasional aplikasi GAAS
            </p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div className="card">
              <div className="card-header settings-table-toolbar">
                <div className="settings-table-toolbar-left">
                  <div className="settings-table-search">
                    <Search width={15} height={15} />
                    <input
                      type="text"
                      placeholder="Cari Nama Perusahaan"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="settings-table-count-box">
                    {filteredHistory.length} Data
                  </div>
                </div>
                <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openChange}>
                  <Pencil width={16} height={16} /> Ubah
                </button>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>No</th>
                      <th>Nama Perusahaan</th>
                      <th style={{ width: 140 }}>Status</th>
                      <th style={{ width: 180 }}>Terakhir Diubah</th>
                      <th style={{ width: 80, textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan={5} className="table-empty">Tidak Ada Data</td></tr>
                    ) : (
                      filteredHistory.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.name}</td>
                          <td>
                            {item.status === "Aktif" ? (
                              <span className="badge badge-approved">Aktif</span>
                            ) : (
                              <span className="badge badge-rejected">Non Aktif</span>
                            )}
                          </td>
                          <td>{formatDateTimeWib(item.updatedAt)}</td>
                          <td style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="card-icon-btn card-icon-btn-danger"
                              aria-label="Delete"
                              title={item.status === "Aktif" ? "Kembalikan ke Default" : "Delete Riwayat"}
                              onClick={() => setDeleteTarget(item)}
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
            </div>

            <ModalOverlay open={formOpen} onClose={() => setFormOpen(false)} className={`modal-overlay modal-overlay-centered ${formOpen ? "" : "hidden"}`}>
              <div className="modal" style={{ maxWidth: 460 }}>
                <div className="modal-header">
                  <h3>Ubah Nama Perusahaan</h3>
                  <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>&times;</button>
                </div>

                <div className={`alert-error ${formErrors.general ? "alert-error-visible" : ""}`}>
                  <div className="alert-error-text"><strong>Error</strong><span>{formErrors.general}</span></div>
                </div>

                <form onSubmit={handleFormSubmit}>
                  <div className="form-grid">
                    <div className="field full">
                      <label htmlFor="modal-company-name">Nama Perusahaan</label>
                      <input
                        id="modal-company-name"
                        type="text"
                        required
                        placeholder="Contoh: PT Perusahaan Gas Negara"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                      {formErrors.name && <div className="field-error-text">{formErrors.name}</div>}
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <PasswordField
                      id="modal-company-password"
                      label="Password Super Admin"
                      placeholder="Masukkan Password"
                      icon={<Lock width={15} height={15} />}
                      value={formPassword}
                      error={formErrors.password}
                      onChange={(v) => {
                        setFormPassword(v);
                        if (formErrors.password) setFormErrors((e) => ({ ...e, password: undefined }));
                      }}
                    />
                  </div>

                  <div className="modal-actions">
                    <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </ModalOverlay>

            <DeleteWithPasswordModal
              open={!!deleteTarget}
              title={deleteTarget?.status === "Aktif" ? "Kembalikan Nama ke Default (PGN Solution)" : "Delete Riwayat"}
              onConfirm={handleDeleteConfirm}
              onClose={() => setDeleteTarget(null)}
              passwordFieldId="modal-delete-company-password"
            >
              {deleteTarget && (
                <div className="form-grid">
                  <div className="field full">
                    <label>Nama Perusahaan</label>
                    <input type="text" value={deleteTarget.name} disabled readOnly />
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
// 2. Logo Perusahaan (Tabel Riwayat & Pengaturan)
// ---------------------------------------------------------------------------
interface LogoHistoryRecord {
  id: string;
  type: string;
  filename: string;
  status: "Aktif" | "Riwayat";
  updatedAt: string;
  changeCount: number;
  previewUrl?: string;
}

const DEFAULT_SYSTEM_LOGO_URL = "/assets/logo-pgn-solution.png?v=white";

function getLogoSrc(item: LogoHistoryRecord, currentUpdatedAt?: string, hasCustomLogo?: boolean): string {
  // 1. Default system logo ALWAYS returns the white static default asset (Gambar 3)
  if (
    item.type.includes("Default") ||
    item.filename.toLowerCase().includes("pgn") ||
    item.filename.toLowerCase().includes("pgm")
  ) {
    return DEFAULT_SYSTEM_LOGO_URL;
  }
  // 2. Custom logo with saved previewUrl (thumbnail data URL or stored URL)
  if (item.previewUrl) {
    return item.previewUrl;
  }
  // 3. Active custom logo fallback
  if (item.status === "Aktif" && hasCustomLogo) {
    return api.appLogoUrl(currentUpdatedAt);
  }
  return DEFAULT_SYSTEM_LOGO_URL;
}

async function createThumbnailDataUrl(file: File, maxDim = 320): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const canvas = document.createElement("canvas");
          let w = img.width || maxDim;
          let h = img.height || maxDim;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png", 0.85));
            return;
          }
        } catch {}
        resolve("");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve("");
      };
      img.src = url;
    } catch {
      resolve("");
    }
  });
}

function CompanyLogoTableAccordionItem({
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

  const [history, setHistory] = useState<LogoHistoryRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("gaas_logo_history");
        if (raw) {
          const parsed: LogoHistoryRecord[] = JSON.parse(raw);
          // Migrate old records: fix typos and guarantee default logos point to /assets/logo-pgn-solution.png
          return parsed.map((h) => {
            const isDefault =
              h.type.includes("Default") ||
              h.filename.toLowerCase().includes("pgn") ||
              h.filename.toLowerCase().includes("pgm");
            return {
              ...h,
              filename: isDefault ? "logo-pgn-solution.png" : h.filename,
              type: isDefault ? "Logo Default Sistem" : h.type,
              previewUrl: isDefault ? DEFAULT_SYSTEM_LOGO_URL : h.previewUrl,
            };
          });
        }
      } catch {}
    }
    return [
      {
        id: "logo-init",
        type: settings.hasCustomLogo ? "Logo Kustom (PNG/JPG)" : "Logo Default Sistem",
        filename: settings.hasCustomLogo ? "logo_custom.png" : "logo-pgn-solution.png",
        status: "Aktif",
        updatedAt: settings.updatedAt,
        changeCount: 1,
        previewUrl: settings.hasCustomLogo ? api.appLogoUrl(settings.updatedAt) : DEFAULT_SYSTEM_LOGO_URL,
      },
    ];
  });

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formPassword, setFormPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LogoHistoryRecord | null>(null);
  const [previewItem, setPreviewItem] = useState<{ url: string; filename: string; type: string } | null>(null);

  const filteredHistory = history.filter((h) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const statusText = h.status === "Aktif" ? "aktif" : "non aktif riwayat";
    return h.filename.toLowerCase().includes(q) || h.type.toLowerCase().includes(q) || statusText.includes(q);
  });

  const [dragging, setDragging] = useState(false);

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFileChange(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!/\.(jpe?g|png)$/i.test(file.name)) {
      setFormError("Format file harus berupa PNG atau JPG");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Ukuran file maksimal 5 MB");
      return;
    }
    setFormError("");
    setSelectedFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
    }
  }

  function openUpload() {
    setSelectedFile(null);
    setFormPassword("");
    setFormError("");
    setDragging(false);
    setFormOpen(true);
  }

  async function handleUploadLogo(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setFormError("Pilih file logo terlebih dahulu");
      return;
    }
    if (!formPassword) {
      setFormError("Password wajib diisi");
      return;
    }
    setFormError("");
    setUploading(true);
    try {
      const thumbUrl = await createThumbnailDataUrl(selectedFile);
      const updated = await api.uploadAppLogo(selectedFile, formPassword);
      onSaved(updated);

      const nextHistory: LogoHistoryRecord[] = [
        {
          id: String(Date.now()),
          type: "Logo Kustom (PNG/JPG)",
          filename: selectedFile.name,
          status: "Aktif",
          updatedAt: new Date().toISOString(),
          changeCount: history.length + 1,
          previewUrl: thumbUrl || api.appLogoUrl(updated.updatedAt),
        },
        ...history.map((h) => ({ ...h, status: "Riwayat" as const })),
      ];
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_logo_history", JSON.stringify(nextHistory));
      } catch {}

      showToast("Logo berhasil diunggah");
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteConfirm(password: string) {
    if (!deleteTarget) return;

    if (deleteTarget.status === "Aktif") {
      const updated = await api.deleteAppLogo(password);
      onSaved(updated);
      const nextHistory: LogoHistoryRecord[] = [
        {
          id: String(Date.now()),
          type: "Logo Default Sistem",
          filename: "logo-pgn-solution.png",
          status: "Aktif" as const,
          updatedAt: new Date().toISOString(),
          changeCount: history.length + 1,
          previewUrl: DEFAULT_SYSTEM_LOGO_URL,
        },
        ...history.map((h) => ({ ...h, status: "Riwayat" as const })),
      ];
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_logo_history", JSON.stringify(nextHistory));
      } catch {}
      showToast("Logo dikembalikan ke default");
    } else {
      const nextHistory = history.filter((h) => h.id !== deleteTarget.id);
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_logo_history", JSON.stringify(nextHistory));
      } catch {}
      showToast("Riwayat logo berhasil dihapus");
    }
    setDeleteTarget(null);
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
            <p className="settings-accordion-desc">
              Kelola logo resmi instansi dan kop dokumen untuk operasional aplikasi GAAS
            </p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div className="card">
              <div className="card-header settings-table-toolbar">
                <div className="settings-table-toolbar-left">
                  <div className="settings-table-search">
                    <Search width={15} height={15} />
                    <input
                      type="text"
                      placeholder="Cari Logo"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="settings-table-count-box">
                    {filteredHistory.length} Data
                  </div>
                </div>
                <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openUpload}>
                  <Pencil width={16} height={16} /> Ubah
                </button>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>No</th>
                      <th style={{ width: 100 }}>Preview</th>
                      <th>Tipe Logo</th>
                      <th>Nama File</th>
                      <th style={{ width: 140 }}>Status</th>
                      <th style={{ width: 180 }}>Terakhir Diubah</th>
                      <th style={{ width: 80, textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan={7} className="table-empty">Tidak Ada Data</td></tr>
                    ) : (
                      filteredHistory.map((item, index) => {
                        const itemSrc = getLogoSrc(item, settings.updatedAt, settings.hasCustomLogo);
                        const isDefaultLogo = item.type.includes("Default") || item.filename.toLowerCase().includes("pgn");
                        return (
                          <tr key={item.id}>
                            <td>{index + 1}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewItem({
                                    url: itemSrc,
                                    filename: item.filename,
                                    type: item.type,
                                  })
                                }
                                title="Klik untuk melihat preview logo"
                                style={{
                                  background: isDefaultLogo ? "var(--gradient-navy, #0f285a)" : "#ffffff",
                                  border: isDefaultLogo ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid var(--border-subtle)",
                                  borderRadius: 6,
                                  padding: "3px 8px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = "var(--primary-color, #1c6dff)";
                                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(28, 109, 255, 0.15)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = isDefaultLogo ? "rgba(255, 255, 255, 0.2)" : "var(--border-subtle)";
                                  e.currentTarget.style.boxShadow = "none";
                                }}
                              >
                                <img
                                  src={itemSrc}
                                  alt={`Preview ${item.filename}`}
                                  style={{
                                    maxWidth: 72,
                                    maxHeight: 28,
                                    width: "auto",
                                    height: "auto",
                                    display: "block",
                                    objectFit: "contain",
                                  }}
                                />
                              </button>
                            </td>
                            <td>{item.type}</td>
                            <td>{item.filename}</td>
                            <td>
                              {item.status === "Aktif" ? (
                                <span className="badge badge-approved">Aktif</span>
                              ) : (
                                <span className="badge badge-rejected">Non Aktif</span>
                              )}
                            </td>
                            <td>{formatDateTimeWib(item.updatedAt)}</td>
                            <td style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="card-icon-btn card-icon-btn-danger"
                                aria-label="Delete"
                                title={item.status === "Aktif" ? "Kembalikan ke Default" : "Delete Riwayat"}
                                onClick={() => setDeleteTarget(item)}
                              >
                                <Trash2 width={16} height={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <ModalOverlay open={!!previewItem} onClose={() => setPreviewItem(null)} className={`modal-overlay modal-overlay-centered ${previewItem ? "" : "hidden"}`}>
              {previewItem && (() => {
                const isDefault = previewItem.type.includes("Default") || previewItem.filename.toLowerCase().includes("pgn");
                return (
                  <div className="modal" style={{ maxWidth: 540 }}>
                    <div className="modal-header">
                      <h3>Preview Logo Perusahaan</h3>
                      <button type="button" className="modal-close" onClick={() => setPreviewItem(null)}>&times;</button>
                    </div>
                    <div style={{ padding: 24, textAlign: "center" }}>
                      <div
                        style={{
                          background: isDefault ? "var(--gradient-navy, #0f285a)" : "#ffffff",
                          padding: 32,
                          borderRadius: 8,
                          border: isDefault ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid var(--border-subtle)",
                          boxShadow: isDefault ? "inset 0 1px 3px rgba(0, 0, 0, 0.2)" : undefined,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 200,
                        }}
                      >
                        {previewItem.url ? (
                          <img
                            src={previewItem.url}
                            alt={previewItem.filename || "Preview Logo Perusahaan"}
                            style={{ maxWidth: "100%", maxHeight: 260, objectFit: "contain" }}
                          />
                        ) : null}
                      </div>
                      <p style={{ marginTop: 12, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        {previewItem.filename} &bull; {previewItem.type}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </ModalOverlay>

            <ModalOverlay open={formOpen} onClose={() => setFormOpen(false)} className={`modal-overlay modal-overlay-centered ${formOpen ? "" : "hidden"}`}>
              <div className="modal" style={{ maxWidth: 460 }}>
                <div className="modal-header">
                  <h3>Ubah Logo Perusahaan</h3>
                  <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>&times;</button>
                </div>

                <div className={`alert-error ${formError ? "alert-error-visible" : ""}`}>
                  <div className="alert-error-text"><strong>Error</strong><span>{formError}</span></div>
                </div>

                <form onSubmit={handleUploadLogo}>
                  <div className="field">
                    <label htmlFor="modal-logo-file">File Logo (PNG / JPG)</label>
                    <div
                      className={`file-dropzone${dragging ? " file-dropzone-dragging" : ""}`}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <UploadCloud width={32} height={32} />
                      <div className="photo-drop-title">Pilih file atau Drag and Drop disini.</div>
                      <div className="photo-drop-caption">Format PNG, JPG, Max 5 MB</div>
                      <input
                        type="file"
                        id="modal-logo-file"
                        ref={fileInputRef}
                        accept=".jpg,.jpeg,.png,image/png,image/jpeg"
                        className="file-dropzone-input"
                        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      />
                    </div>
                    {selectedFile && (
                      <div className="photo-drop-list">
                        <div className="photo-drop-item">
                          <span className="photo-drop-item-index">1.</span>
                          <div className="photo-drop-item-thumb">
                            <ImageIcon width={18} height={18} />
                          </div>
                          <div className="photo-drop-item-info">
                            <span className="photo-drop-item-name">{selectedFile.name}</span>
                            <span className="photo-drop-item-size">{formatFileSize(selectedFile.size)}</span>
                          </div>
                          <CheckCircle2 width={18} height={18} className="photo-drop-item-check" />
                          <button
                            type="button"
                            className="photo-drop-item-remove"
                            aria-label="Delete file"
                            onClick={() => {
                              setSelectedFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                          >
                            <Trash2 width={14} height={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <PasswordField
                      id="modal-logo-password"
                      label="Password Super Admin"
                      placeholder="Masukkan Password"
                      icon={<Lock width={15} height={15} />}
                      value={formPassword}
                      onChange={(v) => {
                        setFormPassword(v);
                        if (formError) setFormError("");
                      }}
                    />
                  </div>

                  <div className="modal-actions" style={{ marginTop: 18 }}>
                    <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={uploading}>
                      {uploading ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </ModalOverlay>

            <DeleteWithPasswordModal
              open={!!deleteTarget}
              title={deleteTarget?.status === "Aktif" ? "Kembalikan Logo ke Default Sistem" : "Delete Riwayat Logo"}
              onConfirm={handleDeleteConfirm}
              onClose={() => setDeleteTarget(null)}
              passwordFieldId="modal-delete-logo-password"
            >
              {deleteTarget && (
                <div className="form-grid">
                  <div className="field full">
                    <label>Tipe Logo</label>
                    <input type="text" value={deleteTarget.type} disabled readOnly />
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
// 3. Jam Operasional (Tabel Riwayat & Pengaturan)
// ---------------------------------------------------------------------------
const OPERATING_HOUR_OPTIONS = [
  "05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
  "21:00", "22:00", "23:00"
];

interface OperatingHoursHistoryRecord {
  id: string;
  start: string;
  end: string;
  status: "Aktif" | "Riwayat";
  updatedAt: string;
  changeCount: number;
}

function OperatingHoursTableAccordionItem({
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
  const [history, setHistory] = useState<OperatingHoursHistoryRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("gaas_hours_history");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [
      {
        id: "hours-init",
        start: settings.operatingStart,
        end: settings.operatingEnd,
        status: "Aktif",
        updatedAt: settings.updatedAt,
        changeCount: 1,
      },
    ];
  });

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formStart, setFormStart] = useState(settings.operatingStart);
  const [formEnd, setFormEnd] = useState(settings.operatingEnd);
  const [formPassword, setFormPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OperatingHoursHistoryRecord | null>(null);

  const startOptions = useMemo(() => {
    const list = [...OPERATING_HOUR_OPTIONS.slice(0, -1)];
    if (formStart && !list.includes(formStart)) {
      list.push(formStart);
      list.sort();
    }
    return list;
  }, [formStart]);

  const endOptions = useMemo(() => {
    const list = OPERATING_HOUR_OPTIONS.filter((h) => h > formStart);
    if (formEnd && !list.includes(formEnd)) {
      list.push(formEnd);
      list.sort();
    }
    return list;
  }, [formStart, formEnd]);

  const filteredHistory = history.filter((h) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const statusText = h.status === "Aktif" ? "aktif" : "non aktif riwayat";
    return `${h.start} - ${h.end}`.toLowerCase().includes(q) || statusText.includes(q);
  });

  function openChange() {
    setFormStart(settings.operatingStart);
    setFormEnd(settings.operatingEnd);
    setFormPassword("");
    setFormError("");
    setFormOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formPassword) {
      setFormError("Password wajib diisi");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const updated = await api.updateAppSettings({
        companyName: settings.companyName,
        operatingStart: formStart,
        operatingEnd: formEnd,
        password: formPassword,
      });
      onSaved(updated);

      const nextHistory: OperatingHoursHistoryRecord[] = [
        {
          id: String(Date.now()),
          start: formStart,
          end: formEnd,
          status: "Aktif",
          updatedAt: new Date().toISOString(),
          changeCount: history.length + 1,
        },
        ...history.map((h) => ({ ...h, status: "Riwayat" as const })),
      ];
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_hours_history", JSON.stringify(nextHistory));
      } catch {}

      showToast("Jam operasional berhasil disimpan");
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm(password: string) {
    if (!deleteTarget) return;

    if (deleteTarget.status === "Aktif") {
      const defaultStart = "07:00";
      const defaultEnd = "18:00";
      const updated = await api.updateAppSettings({
        companyName: settings.companyName,
        operatingStart: defaultStart,
        operatingEnd: defaultEnd,
        password,
      });
      onSaved(updated);
      const nextHistory = [
        {
          id: String(Date.now()),
          start: defaultStart,
          end: defaultEnd,
          status: "Aktif" as const,
          updatedAt: new Date().toISOString(),
          changeCount: history.length + 1,
        },
        ...history.filter((h) => h.id !== deleteTarget.id),
      ];
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_hours_history", JSON.stringify(nextHistory));
      } catch {}
      showToast("Jam operasional dikembalikan ke default (07:00 - 18:00)");
    } else {
      const nextHistory = history.filter((h) => h.id !== deleteTarget.id);
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_hours_history", JSON.stringify(nextHistory));
      } catch {}
      showToast("Riwayat jam operasional berhasil dihapus");
    }
    setDeleteTarget(null);
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
            <p className="settings-accordion-desc">
              Kelola batasan jam operasional reservasi Ruang Meeting dan Kendaraan
            </p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div className="card">
              <div className="card-header settings-table-toolbar">
                <div className="settings-table-toolbar-left">
                  <div className="settings-table-search">
                    <Search width={15} height={15} />
                    <input
                      type="text"
                      placeholder="Cari Jam Operasional"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="settings-table-count-box">
                    {filteredHistory.length} Data
                  </div>
                </div>
                <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openChange}>
                  <Pencil width={16} height={16} /> Ubah
                </button>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>No</th>
                      <th>Jam Mulai</th>
                      <th>Jam Selesai</th>
                      <th>Rentang Waktu</th>
                      <th style={{ width: 140 }}>Status</th>
                      <th style={{ width: 180 }}>Terakhir Diubah</th>
                      <th style={{ width: 80, textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan={7} className="table-empty">Tidak Ada Data</td></tr>
                    ) : (
                      filteredHistory.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.start}</td>
                          <td>{item.end}</td>
                          <td>{item.start} - {item.end} WIB</td>
                          <td>
                            {item.status === "Aktif" ? (
                              <span className="badge badge-approved">Aktif</span>
                            ) : (
                              <span className="badge badge-rejected">Non Aktif</span>
                            )}
                          </td>
                          <td>{formatDateTimeWib(item.updatedAt)}</td>
                          <td style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="card-icon-btn card-icon-btn-danger"
                              aria-label="Delete"
                              title={item.status === "Aktif" ? "Kembalikan ke Default" : "Delete Riwayat"}
                              onClick={() => setDeleteTarget(item)}
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
            </div>

            <ModalOverlay open={formOpen} onClose={() => setFormOpen(false)} className={`modal-overlay modal-overlay-centered ${formOpen ? "" : "hidden"}`}>
              <div className="modal" style={{ maxWidth: 460 }}>
                <div className="modal-header">
                  <h3>Ubah Jam Operasional</h3>
                  <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>&times;</button>
                </div>

                <div className={`alert-error ${formError ? "alert-error-visible" : ""}`}>
                  <div className="alert-error-text"><strong>Error</strong><span>{formError}</span></div>
                </div>

                <form onSubmit={handleFormSubmit}>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="modal-hours-start">Jam Mulai</label>
                      <SearchableSelect
                        id="modal-hours-start"
                        value={formStart}
                        onChange={(val) => {
                          setFormStart(val);
                          if (formError) setFormError("");
                          if (formEnd && val >= formEnd) {
                            const next = OPERATING_HOUR_OPTIONS.find((h) => h > val);
                            if (next) setFormEnd(next);
                          }
                        }}
                        options={startOptions}
                        placeholder="Pilih Jam Mulai"
                        searchable={false}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="modal-hours-end">Jam Selesai</label>
                      <SearchableSelect
                        id="modal-hours-end"
                        value={formEnd}
                        onChange={(val) => {
                          setFormEnd(val);
                          if (formError) setFormError("");
                        }}
                        options={endOptions}
                        placeholder="Pilih Jam Selesai"
                        searchable={false}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <PasswordField
                      id="modal-hours-password"
                      label="Password Super Admin"
                      placeholder="Masukkan Password"
                      icon={<Lock width={15} height={15} />}
                      value={formPassword}
                      onChange={(v) => {
                        setFormPassword(v);
                        if (formError) setFormError("");
                      }}
                    />
                  </div>

                  <div className="modal-actions">
                    <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </ModalOverlay>

            <DeleteWithPasswordModal
              open={!!deleteTarget}
              title={deleteTarget?.status === "Aktif" ? "Kembalikan Jam Operasional ke Default (07:00 - 18:00)" : "Delete Riwayat Jam Operasional"}
              onConfirm={handleDeleteConfirm}
              onClose={() => setDeleteTarget(null)}
              passwordFieldId="modal-delete-hours-password"
            >
              {deleteTarget && (
                <div className="form-grid">
                  <div className="field full">
                    <label>Rentang Jam</label>
                    <input type="text" value={`${deleteTarget.start} - ${deleteTarget.end} WIB`} disabled readOnly />
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
// 4. Pengaturan Suara Notifikasi (Tabel Riwayat & Pengaturan)
// ---------------------------------------------------------------------------
interface SoundHistoryRecord {
  id: string;
  chatSoundId: string;
  activitySoundId: string;
  status: "Aktif" | "Riwayat";
  updatedAt: string;
  changeCount: number;
}

function NotificationSoundTableAccordionItem({
  settings,
  isOpen,
  onToggle,
}: {
  settings: AppSettings;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { showToast } = useToast();
  const [chatSoundId, setChatSoundId] = useState<string>("");
  const [activitySoundId, setActivitySoundId] = useState<string>("");
  const [history, setHistory] = useState<SoundHistoryRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("gaas_sound_history");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  });

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formChat, setFormChat] = useState("digital");
  const [formActivity, setFormActivity] = useState("chime");
  const [formPassword, setFormPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SoundHistoryRecord | null>(null);

  useEffect(() => {
    api.getNotificationSoundSettings()
      .then((s) => {
        setChatSoundId(s.chatSoundId);
        setActivitySoundId(s.activitySoundId);
        setFormChat(s.chatSoundId);
        setFormActivity(s.activitySoundId);

        setHistory((prev) => {
          if (prev.length === 0) {
            return [
              {
                id: "sound-init",
                chatSoundId: s.chatSoundId,
                activitySoundId: s.activitySoundId,
                status: "Aktif",
                updatedAt: new Date().toISOString(),
                changeCount: 1,
              },
            ];
          }
          return prev;
        });
      })
      .catch(() => showToast("Gagal memuat pengaturan suara notifikasi", "error"));
  }, [showToast]);

  const filteredHistory = history.filter((h) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const statusText = h.status === "Aktif" ? "aktif" : "non aktif riwayat";
    return (
      soundLabel(h.chatSoundId).toLowerCase().includes(q) ||
      soundLabel(h.activitySoundId).toLowerCase().includes(q) ||
      statusText.includes(q)
    );
  });

  function openEditModal() {
    setFormChat(chatSoundId || "digital");
    setFormActivity(activitySoundId || "chime");
    setFormPassword("");
    setFormError("");
    setFormOpen(true);
  }

  async function handleSaveSounds(e: React.FormEvent) {
    e.preventDefault();
    if (!formPassword) {
      setFormError("Password wajib diisi");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      // Validasi password Super Admin menggunakan updateAppSettings
      await api.updateAppSettings({
        companyName: settings.companyName,
        operatingStart: settings.operatingStart,
        operatingEnd: settings.operatingEnd,
        password: formPassword,
      });

      const result = await api.updateNotificationSoundSettings({
        chatSoundId: formChat,
        activitySoundId: formActivity,
      });
      setNotificationSoundIds(result);
      setChatSoundId(result.chatSoundId);
      setActivitySoundId(result.activitySoundId);

      const nextHistory: SoundHistoryRecord[] = [
        {
          id: String(Date.now()),
          chatSoundId: formChat,
          activitySoundId: formActivity,
          status: "Aktif",
          updatedAt: new Date().toISOString(),
          changeCount: history.length + 1,
        },
        ...history.map((h) => ({ ...h, status: "Riwayat" as const })),
      ];
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_sound_history", JSON.stringify(nextHistory));
      } catch {}

      showToast("Pengaturan suara notifikasi disimpan");
      setFormOpen(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm(password: string) {
    if (!deleteTarget) return;

    // Validasi password Super Admin
    await api.updateAppSettings({
      companyName: settings.companyName,
      operatingStart: settings.operatingStart,
      operatingEnd: settings.operatingEnd,
      password,
    });

    if (deleteTarget.status === "Aktif") {
      const defaultChat = "digital";
      const defaultActivity = "chime";
      const result = await api.updateNotificationSoundSettings({
        chatSoundId: defaultChat,
        activitySoundId: defaultActivity,
      });
      setNotificationSoundIds(result);
      setChatSoundId(defaultChat);
      setActivitySoundId(defaultActivity);

      const nextHistory = [
        {
          id: String(Date.now()),
          chatSoundId: defaultChat,
          activitySoundId: defaultActivity,
          status: "Aktif" as const,
          updatedAt: new Date().toISOString(),
          changeCount: history.length + 1,
        },
        ...history.filter((h) => h.id !== deleteTarget.id),
      ];
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_sound_history", JSON.stringify(nextHistory));
      } catch {}
      showToast("Suara notifikasi dikembalikan ke default (Digital / Chime)");
    } else {
      const nextHistory = history.filter((h) => h.id !== deleteTarget.id);
      setHistory(nextHistory);
      try {
        localStorage.setItem("gaas_sound_history", JSON.stringify(nextHistory));
      } catch {}
      showToast("Riwayat suara notifikasi berhasil dihapus");
    }
    setDeleteTarget(null);
  }

  return (
    <div className={`settings-accordion-item ${isOpen ? "open" : ""}`}>
      <button type="button" className="settings-accordion-head" onClick={onToggle}>
        <div className="settings-accordion-head-left">
          <div className="settings-accordion-icon-box">
            <Volume2 width={18} height={18} />
          </div>
          <div className="settings-accordion-info">
            <h3>Pengaturan Suara Notifikasi</h3>
            <p className="settings-accordion-desc">
              Kelola preset nada dering pesan chat dan notifikasi approval seluruh sistem
            </p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div className="card">
              <div className="card-header settings-table-toolbar">
                <div className="settings-table-toolbar-left">
                  <div className="settings-table-search">
                    <Search width={15} height={15} />
                    <input
                      type="text"
                      placeholder="Cari Suara Notifikasi"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="settings-table-count-box">
                    {filteredHistory.length} Data
                  </div>
                </div>
                <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openEditModal}>
                  <Pencil width={16} height={16} /> Ubah
                </button>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>No</th>
                      <th>Suara Chat</th>
                      <th>Suara Transaksi / Approval</th>
                      <th style={{ width: 140 }}>Status</th>
                      <th style={{ width: 180 }}>Terakhir Diubah</th>
                      <th style={{ width: 80, textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan={6} className="table-empty">Tidak Ada Data</td></tr>
                    ) : (
                      filteredHistory.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span>{soundLabel(item.chatSoundId)}</span>
                              <button
                                type="button"
                                className="card-icon-btn"
                                style={{ width: 26, height: 26 }}
                                onClick={() => previewSound(item.chatSoundId)}
                                title="Dengarkan Suara Chat"
                              >
                                <Volume2 width={14} height={14} />
                              </button>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span>{soundLabel(item.activitySoundId)}</span>
                              <button
                                type="button"
                                className="card-icon-btn"
                                style={{ width: 26, height: 26 }}
                                onClick={() => previewSound(item.activitySoundId)}
                                title="Dengarkan Suara Approval"
                              >
                                <Volume2 width={14} height={14} />
                              </button>
                            </div>
                          </td>
                          <td>
                            {item.status === "Aktif" ? (
                              <span className="badge badge-approved">Aktif</span>
                            ) : (
                              <span className="badge badge-rejected">Non Aktif</span>
                            )}
                          </td>
                          <td>{formatDateTimeWib(item.updatedAt)}</td>
                          <td style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="card-icon-btn card-icon-btn-danger"
                              aria-label="Delete"
                              title={item.status === "Aktif" ? "Kembalikan ke Default" : "Delete Riwayat"}
                              onClick={() => setDeleteTarget(item)}
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
            </div>

            <ModalOverlay open={formOpen} onClose={() => setFormOpen(false)} className={`modal-overlay modal-overlay-centered ${formOpen ? "" : "hidden"}`}>
              <div className="modal" style={{ maxWidth: 460 }}>
                <div className="modal-header">
                  <h3>Ubah Suara Notifikasi</h3>
                  <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>&times;</button>
                </div>

                <div className={`alert-error ${formError ? "alert-error-visible" : ""}`}>
                  <div className="alert-error-text"><strong>Error</strong><span>{formError}</span></div>
                </div>

                <form onSubmit={handleSaveSounds}>
                  <div className="form-grid">
                    <div className="field full">
                      <label htmlFor="modal-sound-chat">Suara Chat</label>
                      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                        <div style={{ flex: 1 }}>
                          <SearchableSelect
                            id="modal-sound-chat"
                            value={formChat}
                            onChange={setFormChat}
                            options={SOUND_OPTIONS}
                            getLabel={soundLabel}
                            placeholder="Pilih suara chat"
                          />
                        </div>
                        <button
                          type="button"
                          className="icon-btn"
                          style={{
                            alignSelf: "stretch",
                            width: 44,
                            height: "auto",
                            borderRadius: 10,
                            border: "1px solid var(--border-subtle)",
                            background: "var(--bg-surface)",
                            boxShadow: "0 1px 3px rgba(15, 40, 90, 0.06)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            cursor: "pointer",
                            color: "var(--text-secondary)",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => previewSound(formChat)}
                          title="Dengarkan suara chat"
                        >
                          <Volume2 width={18} height={18} />
                        </button>
                      </div>
                    </div>

                    <div className="field full">
                      <label htmlFor="modal-sound-activity">Suara Transaksi / Approval</label>
                      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                        <div style={{ flex: 1 }}>
                          <SearchableSelect
                            id="modal-sound-activity"
                            value={formActivity}
                            onChange={setFormActivity}
                            options={SOUND_OPTIONS}
                            getLabel={soundLabel}
                            placeholder="Pilih suara approval"
                          />
                        </div>
                        <button
                          type="button"
                          className="icon-btn"
                          style={{
                            alignSelf: "stretch",
                            width: 44,
                            height: "auto",
                            borderRadius: 10,
                            border: "1px solid var(--border-subtle)",
                            background: "var(--bg-surface)",
                            boxShadow: "0 1px 3px rgba(15, 40, 90, 0.06)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            cursor: "pointer",
                            color: "var(--text-secondary)",
                            transition: "all 0.15s ease",
                          }}
                          onClick={() => previewSound(formActivity)}
                          title="Dengarkan suara approval"
                        >
                          <Volume2 width={18} height={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <PasswordField
                      id="modal-sound-password"
                      label="Password Super Admin"
                      placeholder="Masukkan Password"
                      icon={<Lock width={15} height={15} />}
                      value={formPassword}
                      onChange={(v) => {
                        setFormPassword(v);
                        if (formError) setFormError("");
                      }}
                    />
                  </div>

                  <div className="modal-actions" style={{ marginTop: 20 }}>
                    <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </ModalOverlay>

            <DeleteWithPasswordModal
              open={!!deleteTarget}
              title={deleteTarget?.status === "Aktif" ? "Kembalikan Suara ke Default (Digital / Chime)" : "Delete Riwayat Suara"}
              onConfirm={handleDeleteConfirm}
              onClose={() => setDeleteTarget(null)}
              passwordFieldId="modal-delete-sound-password"
            >
              {deleteTarget && (
                <div className="form-grid">
                  <div className="field full">
                    <label>Suara Notifikasi</label>
                    <input
                      type="text"
                      value={`${soundLabel(deleteTarget.chatSoundId)} & ${soundLabel(deleteTarget.activitySoundId)}`}
                      disabled
                      readOnly
                    />
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
// 5. Kalender Hari Libur (Tabel & Edit/Delete Modals)
// ---------------------------------------------------------------------------
interface HolidayFormState {
  date: string;
  label: string;
  password: string;
}

const EMPTY_HOLIDAY_FORM: HolidayFormState = { date: "", label: "", password: "" };

function HolidaysTableAccordionItem({
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
  const [editTarget, setEditTarget] = useState<Holiday | null>(null);
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
    setEditTarget(null);
    setForm({ date: todayLocalDate(), label: "", password: "" });
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(h: Holiday) {
    setEditTarget(h);
    setForm({ date: h.date, label: h.label, password: "" });
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
      if (editTarget) {
        // Delete old holiday then create updated one
        await api.deleteHoliday(editTarget.id, form.password);
        await api.createHoliday({ date: form.date, label: form.label.trim(), password: form.password });
        showToast("Hari libur berhasil diperbarui");
      } else {
        await api.createHoliday({ date: form.date, label: form.label.trim(), password: form.password });
        showToast("Hari libur berhasil ditambahkan");
      }
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
            <p className="settings-accordion-desc">
              Kelola daftar hari libur nasional dan cuti bersama untuk pemesanan fasilitas
            </p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div className="card">
              <div className="card-header settings-table-toolbar">
                <div className="settings-table-toolbar-left">
                  <div className="settings-table-search">
                    <Search width={15} height={15} />
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
                      <th style={{ width: 80, textAlign: "right" }}></th>
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
                          <td>{formatDate(h.date)}</td>
                          <td>{h.label}</td>
                          <td style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="card-icon-btn"
                              aria-label="Edit Hari Libur"
                              title="Edit Hari Libur"
                              onClick={() => openEdit(h)}
                            >
                              <Pencil width={16} height={16} />
                            </button>
                            <button
                              type="button"
                              className="card-icon-btn card-icon-btn-danger"
                              aria-label="Delete"
                              title="Delete"
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
            </div>

            <ModalOverlay open={formOpen} onClose={() => setFormOpen(false)} className={`modal-overlay modal-overlay-centered ${formOpen ? "" : "hidden"}`}>
              <div className="modal" style={{ maxWidth: 460 }}>
                <div className="modal-header">
                  <h3>{editTarget ? "Edit Hari Libur" : "Tambah Hari Libur"}</h3>
                  <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>&times;</button>
                </div>

                <div className={`alert-error ${formErrors.general ? "alert-error-visible" : ""}`}>
                  <div className="alert-error-text"><strong>Error</strong><span>{formErrors.general}</span></div>
                </div>

                <form onSubmit={handleFormSubmit}>
                  <div className="form-grid">
                    <div className="field full">
                      <label htmlFor="holiday-form-date">Tanggal</label>
                      <DateFilterPicker
                        id="holiday-form-date"
                        value={form.date}
                        onChange={(val) => {
                          setForm((f) => ({ ...f, date: val }));
                          if (formErrors.date) setFormErrors((e) => ({ ...e, date: undefined }));
                        }}
                        clearable={false}
                        placeholder="Pilih Tanggal"
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
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              </div>
            </ModalOverlay>

            <DeleteWithPasswordModal
              open={!!deleteTarget}
              title="Delete Hari Libur"
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
// 6. Backup Data Global (Tabel Riwayat & Ekspor)
// ---------------------------------------------------------------------------
interface BackupHistoryRecord {
  id: string;
  filename: string;
  scope: string;
  status: string;
  exportedAt: string;
}

function BackupTableAccordionItem({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { showToast } = useToast();
  const [history, setHistory] = useState<BackupHistoryRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("gaas_backup_history");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item, idx) => ({
              ...item,
              status: idx === 0 ? "Aktif" : (item.status === "Aktif" ? "Aktif" : "Non Aktif"),
            }));
          }
        }
      } catch {}
    }
    return [
      {
        id: "backup-initial",
        filename: "GAAS_Master_Backup.xlsx",
        scope: "Seluruh Database (11 Modul & Log)",
        status: "Aktif",
        exportedAt: new Date().toISOString(),
      },
    ];
  });

  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BackupHistoryRecord | null>(null);

  const filteredHistory = history.filter((h) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const statusText = h.status === "Non Aktif" ? "non aktif" : "aktif";
    return (
      h.filename.toLowerCase().includes(q) ||
      h.scope.toLowerCase().includes(q) ||
      statusText.includes(q)
    );
  });

  function handleTriggerDownload() {
    const filename = `GAAS_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const newEntry: BackupHistoryRecord = {
      id: String(Date.now()),
      filename,
      scope: "Seluruh Database (11 Modul & Log)",
      status: "Aktif",
      exportedAt: new Date().toISOString(),
    };
    const nextHistory = [newEntry, ...history.map((h) => ({ ...h, status: "Non Aktif" as const }))];
    setHistory(nextHistory);
    try {
      localStorage.setItem("gaas_backup_history", JSON.stringify(nextHistory));
    } catch {}

    window.open(api.globalExportUrl(), "_blank");
    showToast("Mengunduh file backup database...");
  }

  function handleDelete(record: BackupHistoryRecord) {
    const nextHistory = history.filter((h) => h.id !== record.id);
    setHistory(nextHistory);
    try {
      localStorage.setItem("gaas_backup_history", JSON.stringify(nextHistory));
    } catch {}
    showToast("Baris riwayat backup dihapus");
    setDeleteTarget(null);
  }

  return (
    <div className={`settings-accordion-item ${isOpen ? "open" : ""}`}>
      <button type="button" className="settings-accordion-head" onClick={onToggle}>
        <div className="settings-accordion-head-left">
          <div className="settings-accordion-icon-box">
            <Database width={18} height={18} />
          </div>
          <div className="settings-accordion-info">
            <h3>Backup Data Global</h3>
            <p className="settings-accordion-desc">
              Kelola pencadangan arsip seluruh database transaksi dan data master sistem GAAS
            </p>
          </div>
        </div>
        <div className="settings-accordion-head-right">
          <span className="settings-accordion-chevron-wrap">
            <ChevronRight width={18} height={18} />
          </span>
        </div>
      </button>

      <div className="settings-accordion-collapse">
        <div className="settings-accordion-collapse-inner">
          <div className="settings-accordion-body" style={{ paddingTop: 16 }}>
            <div className="card">
              <div className="card-header settings-table-toolbar">
                <div className="settings-table-toolbar-left">
                  <div className="settings-table-search">
                    <Search width={15} height={15} />
                    <input
                      type="text"
                      placeholder="Cari Riwayat Backup"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="settings-table-count-box">
                    {filteredHistory.length} Data
                  </div>
                </div>
                <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={handleTriggerDownload}>
                  <Download width={16} height={16} /> Cadangkan
                </button>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 64 }}>No</th>
                      <th>Nama File Cadangan</th>
                      <th>Cakupan Modul</th>
                      <th style={{ width: 160 }}>Status</th>
                      <th style={{ width: 180 }}>Waktu Ekspor</th>
                      <th style={{ width: 80, textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan={6} className="table-empty">Tidak Ada Data</td></tr>
                    ) : (
                      filteredHistory.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.filename}</td>
                          <td>{item.scope}</td>
                          <td>
                            {item.status === "Non Aktif" ? (
                              <span className="badge badge-rejected">Non Aktif</span>
                            ) : (
                              <span className="badge badge-approved">Aktif</span>
                            )}
                          </td>
                          <td>{formatDateTimeWib(item.exportedAt)}</td>
                          <td style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="card-icon-btn card-icon-btn-danger"
                              aria-label="Delete"
                              title="Delete Riwayat"
                              onClick={() => setDeleteTarget(item)}
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
            </div>

            <ModalOverlay open={!!deleteTarget} onClose={() => setDeleteTarget(null)} className={`modal-overlay modal-overlay-centered ${deleteTarget ? "" : "hidden"}`}>
              <div className="modal" style={{ maxWidth: 440 }}>
                <div className="modal-header">
                  <h3>Delete Riwayat Ekspor</h3>
                  <button type="button" className="modal-close" onClick={() => setDeleteTarget(null)}>&times;</button>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 16px" }}>
                  Apakah Anda yakin ingin menghapus baris catatan cadangan <strong>{deleteTarget?.filename}</strong> dari daftar?
                </p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                    Batal
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
                    Delete Baris
                  </button>
                </div>
              </div>
            </ModalOverlay>
          </div>
        </div>
      </div>
    </div>
  );
}
