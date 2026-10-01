"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import CredentialsRevealModal, { type RevealedCredential } from "@/components/CredentialsRevealModal";
import type { OrgDirektoratNode, OrgDivisiNode } from "@/lib/types";
import {
  Building2,
  Layers,
  FolderTree,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Search,
  Check,
  X,
} from "lucide-react";

// Inline "type to rename" control shared across all levels
function InlineRename({
  initial,
  disabled,
  onSave,
  onCancel,
}: {
  initial: string;
  disabled?: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "2px 0",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        type="text"
        value={value}
        disabled={disabled}
        style={{
          flex: 1,
          height: 32,
          padding: "0 10px",
          fontSize: "0.82rem",
          borderRadius: 6,
          border: "1px solid var(--blue-500)",
          outline: "none",
          background: "var(--bg-surface)",
          color: "var(--text-primary)",
        }}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" && value.trim()) onSave(value.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        type="button"
        className="card-icon-btn"
        disabled={disabled || !value.trim()}
        onClick={() => onSave(value.trim())}
        title="Simpan"
        aria-label="Simpan"
      >
        <Check width={14} height={14} />
      </button>
      <button
        type="button"
        className="card-icon-btn"
        disabled={disabled}
        onClick={onCancel}
        title="Batal"
        aria-label="Batal"
      >
        <X width={14} height={14} />
      </button>
    </div>
  );
}

// Inline "+ Tambah ..." row inside a column
function InlineAdd({
  placeholder,
  withKode,
  disabled,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  withKode?: boolean;
  disabled?: boolean;
  onSubmit: (nama: string, kode: string) => void;
  onCancel: () => void;
}) {
  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        borderRadius: 8,
        border: "1px dashed var(--blue-400)",
        background: "var(--bg-surface)",
        marginBottom: 8,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        type="text"
        placeholder={placeholder}
        value={nama}
        disabled={disabled}
        style={{
          width: "100%",
          height: 32,
          padding: "0 10px",
          fontSize: "0.82rem",
          borderRadius: 6,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
          color: "var(--text-primary)",
        }}
        onChange={(e) => setNama(e.target.value)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && nama.trim() && (!withKode || kode.trim())) {
            onSubmit(nama.trim(), kode.trim());
          }
        }}
      />
      {withKode && (
        <input
          type="text"
          placeholder="Kode Satuan Kerja (contoh: CORSEC, EPCP)"
          value={kode}
          disabled={disabled}
          style={{
            width: "100%",
            height: 32,
            padding: "0 10px",
            fontSize: "0.82rem",
            borderRadius: 6,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
          }}
          onChange={(e) => setKode(e.target.value)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && nama.trim() && kode.trim()) {
              onSubmit(nama.trim(), kode.trim());
            }
          }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "auto", height: 30, padding: "0 12px", fontSize: "0.78rem" }}
          disabled={disabled}
          onClick={onCancel}
        >
          Batal
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "auto", height: 30, padding: "0 14px", fontSize: "0.78rem" }}
          disabled={disabled || !nama.trim() || (withKode && !kode.trim())}
          onClick={() => onSubmit(nama.trim(), kode.trim())}
        >
          Simpan
        </button>
      </div>
    </div>
  );
}

// Super Admin Organization Tab - Miller Columns (3-Column Drill-Down Explorer)
// Fully adapted to the native GAAS enterprise design system.
export default function SuperAdminOrgTab() {
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [tree, setTree] = useState<OrgDirektoratNode[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Selected column nodes (Miller navigation state)
  const [selectedDirektoratId, setSelectedDirektoratId] = useState<number | null>(null);
  const [selectedDivisiId, setSelectedDivisiId] = useState<number | null>(null);

  // Search filter across columns
  const [searchQuery, setSearchQuery] = useState("");

  // Adding flags
  const [addingDirektorat, setAddingDirektorat] = useState(false);
  const [addingDivisiUnder, setAddingDivisiUnder] = useState<number | null>(null);
  const [addingDepartemenUnder, setAddingDepartemenUnder] = useState<number | null>(null);

  // Renaming state
  const [renaming, setRenaming] = useState<{
    level: "direktorat" | "divisi" | "departemen";
    id: number;
  } | null>(null);

  // Newly generated account credentials modal
  const [credentials, setCredentials] = useState<{
    title: string;
    accounts: RevealedCredential[];
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getOrgTree();
      setTree(data.direktorat);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat struktur organisasi");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sync selected nodes when tree loads or changes
  useEffect(() => {
    if (!tree || tree.length === 0) {
      setSelectedDirektoratId(null);
      setSelectedDivisiId(null);
      return;
    }

    // Keep active selected Direktorat if valid, otherwise pick first
    const activeDir =
      tree.find((d) => d.id === selectedDirektoratId) || tree[0];
    if (activeDir.id !== selectedDirektoratId) {
      setSelectedDirektoratId(activeDir.id);
    }

    // Keep active selected Divisi if valid inside activeDir, otherwise pick first
    const activeDiv =
      activeDir.divisi.find((dv) => dv.id === selectedDivisiId) ||
      activeDir.divisi[0] ||
      null;
    if (activeDiv?.id !== selectedDivisiId) {
      setSelectedDivisiId(activeDiv ? activeDiv.id : null);
    }
  }, [tree, selectedDirektoratId, selectedDivisiId]);

  function errorMessage(err: unknown): string {
    return err instanceof ApiError
      ? err.message
      : err instanceof Error
      ? err.message
      : "Terjadi kesalahan";
  }

  // Active nodes lookup
  const currentDirektorat = useMemo(() => {
    if (!tree || tree.length === 0) return null;
    return tree.find((d) => d.id === selectedDirektoratId) || tree[0] || null;
  }, [tree, selectedDirektoratId]);

  const currentDivisi = useMemo(() => {
    if (!currentDirektorat || currentDirektorat.divisi.length === 0) return null;
    return (
      currentDirektorat.divisi.find((dv) => dv.id === selectedDivisiId) ||
      currentDirektorat.divisi[0] ||
      null
    );
  }, [currentDirektorat, selectedDivisiId]);

  // Overall statistics
  const stats = useMemo(() => {
    if (!tree) return { totalDir: 0, totalDiv: 0, totalDept: 0 };
    let totalDiv = 0;
    let totalDept = 0;
    for (const d of tree) {
      totalDiv += d.divisi.length;
      for (const dv of d.divisi) {
        totalDept += dv.departemen.length;
      }
    }
    return { totalDir: tree.length, totalDiv, totalDept };
  }, [tree]);

  // Handlers
  async function handleAddDirektorat(nama: string) {
    if (saving) return;
    setSaving(true);
    try {
      await api.createDirektorat(nama);
      setAddingDirektorat(false);
      showToast("Direktorat berhasil ditambahkan");
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameDirektorat(id: number, nama: string) {
    if (saving) return;
    setRenaming(null);
    setSaving(true);
    try {
      await api.renameDirektorat(id, nama);
      showToast("Direktorat berhasil diubah");
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteDirektorat(id: number, nama: string) {
    if (saving) return;
    confirm(`Hapus Direktorat "${nama}"? Semua divisi dan departemen di dalamnya akan terhapus.`, async () => {
      setSaving(true);
      try {
        await api.deleteDirektorat(id);
        showToast("Direktorat berhasil dihapus");
        if (selectedDirektoratId === id) {
          setSelectedDirektoratId(null);
          setSelectedDivisiId(null);
        }
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      } finally {
        setSaving(false);
      }
    });
  }

  async function handleAddDivisi(direktoratId: number, nama: string, kode: string) {
    if (saving) return;
    setSaving(true);
    try {
      const result = await api.createDivisi(direktoratId, nama, kode);
      setAddingDivisiUnder(null);
      setSelectedDivisiId(result.divisi.id);
      showToast("Divisi berhasil ditambahkan");
      if (result.accounts.length > 0) {
        setCredentials({
          title: `Akun Baru untuk Divisi "${nama}"`,
          accounts: result.accounts,
        });
      }
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameDivisi(divisi: OrgDivisiNode, nama: string) {
    if (saving) return;
    setRenaming(null);
    setSaving(true);
    try {
      await api.updateDivisi(divisi.id, nama, divisi.kodeSatuanKerja);
      showToast("Divisi berhasil diubah");
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteDivisi(id: number, nama: string) {
    if (saving) return;
    confirm(`Hapus Divisi "${nama}"? Semua departemen di dalamnya akan terhapus.`, async () => {
      setSaving(true);
      try {
        await api.deleteDivisi(id);
        showToast("Divisi berhasil dihapus");
        if (selectedDivisiId === id) {
          setSelectedDivisiId(null);
        }
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      } finally {
        setSaving(false);
      }
    });
  }

  async function handleAddDepartemen(divisiId: number, nama: string) {
    if (saving) return;
    setSaving(true);
    try {
      const result = await api.createDepartemen(divisiId, nama);
      setAddingDepartemenUnder(null);
      showToast("Departemen berhasil ditambahkan");
      if (result.accounts.length > 0) {
        setCredentials({
          title: `Akun Baru untuk Departemen "${nama}"`,
          accounts: result.accounts,
        });
      }
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRenameDepartemen(id: number, nama: string) {
    if (saving) return;
    setRenaming(null);
    setSaving(true);
    try {
      await api.renameDepartemen(id, nama);
      showToast("Departemen berhasil diubah");
      await load();
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteDepartemen(id: number, nama: string) {
    if (saving) return;
    confirm(`Hapus Departemen "${nama}"?`, async () => {
      setSaving(true);
      try {
        await api.deleteDepartemen(id);
        showToast("Departemen berhasil dihapus");
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      } finally {
        setSaving(false);
      }
    });
  }

  const queryLower = searchQuery.toLowerCase().trim();

  // Filtered lists
  const filteredDirektorat = useMemo(() => {
    if (!tree) return [];
    if (!queryLower) return tree;
    return tree.filter((d) => {
      const dirMatch = d.nama.toLowerCase().includes(queryLower);
      const divMatch = d.divisi.some(
        (dv) =>
          dv.nama.toLowerCase().includes(queryLower) ||
          dv.kodeSatuanKerja.toLowerCase().includes(queryLower) ||
          dv.departemen.some((dp) => dp.nama.toLowerCase().includes(queryLower))
      );
      return dirMatch || divMatch;
    });
  }, [tree, queryLower]);

  const filteredDivisi = useMemo(() => {
    if (!currentDirektorat) return [];
    if (!queryLower) return currentDirektorat.divisi;
    return currentDirektorat.divisi.filter(
      (dv) =>
        dv.nama.toLowerCase().includes(queryLower) ||
        dv.kodeSatuanKerja.toLowerCase().includes(queryLower) ||
        dv.departemen.some((dp) => dp.nama.toLowerCase().includes(queryLower))
    );
  }, [currentDirektorat, queryLower]);

  const filteredDepartemen = useMemo(() => {
    if (!currentDivisi) return [];
    if (!queryLower) return currentDivisi.departemen;
    return currentDivisi.departemen.filter((dp) =>
      dp.nama.toLowerCase().includes(queryLower)
    );
  }, [currentDivisi, queryLower]);

  return (
    <div className="card">
      {/* Standard GAAS Card Header */}
      <div className="card-header">
        <h3>Struktur Organisasi</h3>
      </div>

      {/* Navigasi Aktif (Breadcrumb) - di atas search, warna hitam semua */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "var(--bg-surface-alt)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          fontSize: "0.82rem",
          marginTop: 12,
          marginBottom: 14,
          flexWrap: "wrap",
          color: "var(--text-primary)",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Navigasi Aktif:</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {currentDirektorat ? currentDirektorat.nama : "Pilih Direktorat"}
        </span>
        <span style={{ color: "var(--text-primary)", opacity: 0.5 }}>/</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {currentDivisi ? `${currentDivisi.nama} (${currentDivisi.kodeSatuanKerja})` : "Pilih Divisi"}
        </span>
        <span style={{ color: "var(--text-primary)", opacity: 0.5 }}>/</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {currentDivisi ? `${currentDivisi.departemen.length} Departemen` : "0 Departemen"}
        </span>
      </div>

      {/* Toolbar: Search di Ujung Kiri dan Count Box di Ujung Kanan */}
      <div
        className="settings-table-toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div className="settings-table-search">
          <Search width={16} height={16} />
          <input
            type="text"
            placeholder="Cari direktorat, divisi, kode, atau departemen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="settings-table-count-box">
          {stats.totalDir} Direktorat &bull; {stats.totalDiv} Divisi &bull; {stats.totalDept} Departemen
        </div>
      </div>

      {error ? (
        <p className="text-secondary" style={{ color: "var(--badge-rejected-bg)" }}>{error}</p>
      ) : !tree ? (
        <p className="text-secondary">Memuat struktur organisasi...</p>
      ) : (
        /* The 3-Column Miller Columns Container */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
            alignItems: "stretch",
          }}
        >
          {/* ========================================================= */}
          {/* COLUMN 1: DIREKTORAT */}
          {/* ========================================================= */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderRadius: 12,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface-alt)",
              overflow: "hidden",
              minHeight: 440,
            }}
          >
            {/* Column Header */}
            <div
              style={{
                padding: "12px 14px",
                background: "var(--bg-surface-alt)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Building2 width={16} height={16} style={{ color: "var(--blue-500)" }} />
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                  Direktorat
                </span>
                <span
                  style={{
                    fontSize: "0.74rem",
                    padding: "1px 8px",
                    borderRadius: 10,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {filteredDirektorat.length}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "auto", height: 28, padding: "0 10px", fontSize: "0.75rem", gap: 4 }}
                disabled={saving}
                onClick={() => setAddingDirektorat(true)}
                title="Tambah Direktorat baru"
              >
                <Plus width={13} height={13} /> Tambah
              </button>
            </div>

            {/* Column List */}
            <div
              style={{
                padding: 10,
                flex: 1,
                overflowY: "auto",
                maxHeight: 520,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {addingDirektorat && (
                <InlineAdd
                  placeholder="Nama Direktorat baru"
                  disabled={saving}
                  onSubmit={(nama) => handleAddDirektorat(nama)}
                  onCancel={() => setAddingDirektorat(false)}
                />
              )}

              {filteredDirektorat.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                  {searchQuery ? "Tidak ditemukan" : "Belum ada Direktorat"}
                </div>
              ) : (
                filteredDirektorat.map((direktorat) => {
                  const isSelected = selectedDirektoratId === direktorat.id;
                  const isRenamingThis =
                    renaming?.level === "direktorat" && renaming.id === direktorat.id;

                  return (
                    <div
                      key={direktorat.id}
                      onClick={() => {
                        setSelectedDirektoratId(direktorat.id);
                        const firstDiv = direktorat.divisi[0] || null;
                        setSelectedDivisiId(firstDiv ? firstDiv.id : null);
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: isSelected
                          ? "1px solid var(--blue-500)"
                          : "1px solid var(--border-subtle)",
                        borderLeft: isSelected
                          ? "4px solid var(--blue-500)"
                          : "1px solid var(--border-subtle)",
                        background: isSelected
                          ? "var(--bg-surface)"
                          : "var(--bg-surface)",
                        boxShadow: isSelected ? "0 2px 8px rgba(28, 109, 255, 0.12)" : "none",
                        transition: "all 150ms ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      {isRenamingThis ? (
                        <InlineRename
                          initial={direktorat.nama}
                          disabled={saving}
                          onSave={(v) => handleRenameDirektorat(direktorat.id, v)}
                          onCancel={() => setRenaming(null)}
                        />
                      ) : (
                        <>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: isSelected ? 700 : 600,
                                fontSize: "0.84rem",
                                color: isSelected ? "var(--blue-500)" : "var(--text-primary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={direktorat.nama}
                            >
                              {direktorat.nama}
                            </div>
                            <span
                              className="text-secondary"
                              style={{
                                fontSize: "0.72rem",
                              }}
                            >
                              {direktorat.divisi.length} Divisi
                            </span>
                          </div>

                          {/* Actions */}
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 5 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="card-icon-btn"
                              title="Ubah nama"
                              aria-label="Ubah nama"
                              disabled={saving}
                              onClick={() =>
                                setRenaming({ level: "direktorat", id: direktorat.id })
                              }
                            >
                              <Pencil width={13} height={13} />
                            </button>
                            <button
                              type="button"
                              className="card-icon-btn card-icon-btn-danger"
                              title="Hapus"
                              aria-label="Hapus"
                              disabled={saving}
                              onClick={() =>
                                handleDeleteDirektorat(direktorat.id, direktorat.nama)
                              }
                            >
                              <Trash2 width={13} height={13} />
                            </button>
                            <ChevronRight
                              width={15}
                              height={15}
                              style={{
                                color: isSelected ? "var(--blue-500)" : "var(--text-secondary)",
                                opacity: isSelected ? 1 : 0.35,
                                marginLeft: 2,
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUMN 2: DIVISI */}
          {/* ========================================================= */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderRadius: 12,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface-alt)",
              overflow: "hidden",
              minHeight: 440,
            }}
          >
            {/* Column Header */}
            <div
              style={{
                padding: "12px 14px",
                background: "var(--bg-surface-alt)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Layers width={16} height={16} style={{ color: "var(--blue-500)" }} />
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                  Divisi
                </span>
                <span
                  style={{
                    fontSize: "0.74rem",
                    padding: "1px 8px",
                    borderRadius: 10,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {filteredDivisi.length}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  width: "auto",
                  height: 28,
                  padding: "0 10px",
                  fontSize: "0.75rem",
                  gap: 4,
                  opacity: currentDirektorat ? 1 : 0.5,
                }}
                disabled={saving || !currentDirektorat}
                onClick={() => {
                  if (currentDirektorat) setAddingDivisiUnder(currentDirektorat.id);
                }}
                title={currentDirektorat ? `Tambah Divisi di ${currentDirektorat.nama}` : "Pilih Direktorat dahulu"}
              >
                <Plus width={13} height={13} /> Tambah
              </button>
            </div>

            {/* Column List */}
            <div
              style={{
                padding: 10,
                flex: 1,
                overflowY: "auto",
                maxHeight: 520,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {addingDivisiUnder === currentDirektorat?.id && (
                <InlineAdd
                  placeholder="Nama Divisi baru"
                  withKode
                  disabled={saving}
                  onSubmit={(nama, kode) =>
                    handleAddDivisi(currentDirektorat.id, nama, kode)
                  }
                  onCancel={() => setAddingDivisiUnder(null)}
                />
              )}

              {!currentDirektorat ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                  Pilih Direktorat di kolom kiri
                </div>
              ) : filteredDivisi.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                  {searchQuery ? "Tidak ditemukan" : (
                    <div>
                      <p style={{ margin: "0 0 10px 0" }}>Belum ada Divisi di {currentDirektorat.nama}</p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: "auto", height: 30, padding: "0 12px", fontSize: "0.78rem" }}
                        disabled={saving}
                        onClick={() => setAddingDivisiUnder(currentDirektorat.id)}
                      >
                        <Plus width={13} height={13} /> Tambah Divisi Pertama
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredDivisi.map((divisi) => {
                  const isSelected = selectedDivisiId === divisi.id;
                  const isRenamingThis =
                    renaming?.level === "divisi" && renaming.id === divisi.id;

                  return (
                    <div
                      key={divisi.id}
                      onClick={() => setSelectedDivisiId(divisi.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: isSelected
                          ? "1px solid var(--blue-500)"
                          : "1px solid var(--border-subtle)",
                        borderLeft: isSelected
                          ? "4px solid var(--blue-500)"
                          : "1px solid var(--border-subtle)",
                        background: isSelected
                          ? "var(--bg-surface)"
                          : "var(--bg-surface)",
                        boxShadow: isSelected ? "0 2px 8px rgba(28, 109, 255, 0.12)" : "none",
                        transition: "all 150ms ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      {isRenamingThis ? (
                        <InlineRename
                          initial={divisi.nama}
                          disabled={saving}
                          onSave={(v) => handleRenameDivisi(divisi, v)}
                          onCancel={() => setRenaming(null)}
                        />
                      ) : (
                        <>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: isSelected ? 700 : 600,
                                fontSize: "0.84rem",
                                color: isSelected ? "var(--blue-500)" : "var(--text-primary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={divisi.nama}
                            >
                              {divisi.nama}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "var(--bg-surface-alt)",
                                  color: "var(--text-secondary)",
                                  border: "1px solid var(--border-subtle)",
                                  fontFamily: "monospace",
                                  fontWeight: 600,
                                }}
                              >
                                {divisi.kodeSatuanKerja}
                              </span>
                              <span
                                className="text-secondary"
                                style={{
                                  fontSize: "0.72rem",
                                }}
                              >
                                {divisi.departemen.length} Dept
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 5 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="card-icon-btn"
                              title="Ubah nama"
                              aria-label="Ubah nama"
                              disabled={saving}
                              onClick={() =>
                                setRenaming({ level: "divisi", id: divisi.id })
                              }
                            >
                              <Pencil width={13} height={13} />
                            </button>
                            <button
                              type="button"
                              className="card-icon-btn card-icon-btn-danger"
                              title="Hapus"
                              aria-label="Hapus"
                              disabled={saving}
                              onClick={() =>
                                handleDeleteDivisi(divisi.id, divisi.nama)
                              }
                            >
                              <Trash2 width={13} height={13} />
                            </button>
                            <ChevronRight
                              width={15}
                              height={15}
                              style={{
                                color: isSelected ? "var(--blue-500)" : "var(--text-secondary)",
                                opacity: isSelected ? 1 : 0.35,
                                marginLeft: 2,
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUMN 3: DEPARTEMEN */}
          {/* ========================================================= */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderRadius: 12,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-surface-alt)",
              overflow: "hidden",
              minHeight: 440,
            }}
          >
            {/* Column Header */}
            <div
              style={{
                padding: "12px 14px",
                background: "var(--bg-surface-alt)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <FolderTree width={16} height={16} style={{ color: "var(--blue-500)" }} />
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                  Departemen
                </span>
                <span
                  style={{
                    fontSize: "0.74rem",
                    padding: "1px 8px",
                    borderRadius: 10,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {filteredDepartemen.length}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  width: "auto",
                  height: 28,
                  padding: "0 10px",
                  fontSize: "0.75rem",
                  gap: 4,
                  opacity: currentDivisi ? 1 : 0.5,
                }}
                disabled={saving || !currentDivisi}
                onClick={() => {
                  if (currentDivisi) setAddingDepartemenUnder(currentDivisi.id);
                }}
                title={currentDivisi ? `Tambah Departemen di ${currentDivisi.nama}` : "Pilih Divisi dahulu"}
              >
                <Plus width={13} height={13} /> Tambah
              </button>
            </div>

            {/* Column List */}
            <div
              style={{
                padding: 10,
                flex: 1,
                overflowY: "auto",
                maxHeight: 520,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {addingDepartemenUnder === currentDivisi?.id && (
                <InlineAdd
                  placeholder="Nama Departemen baru"
                  disabled={saving}
                  onSubmit={(nama) =>
                    handleAddDepartemen(currentDivisi.id, nama)
                  }
                  onCancel={() => setAddingDepartemenUnder(null)}
                />
              )}

              {!currentDivisi ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                  Pilih Divisi di kolom tengah
                </div>
              ) : filteredDepartemen.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                  {searchQuery ? "Tidak ditemukan" : (
                    <div>
                      <p style={{ margin: "0 0 10px 0" }}>Belum ada Departemen di {currentDivisi.nama}</p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: "auto", height: 30, padding: "0 12px", fontSize: "0.78rem" }}
                        disabled={saving}
                        onClick={() => setAddingDepartemenUnder(currentDivisi.id)}
                      >
                        <Plus width={13} height={13} /> Tambah Departemen Pertama
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredDepartemen.map((departemen) => {
                  const isRenamingThis =
                    renaming?.level === "departemen" && renaming.id === departemen.id;

                  return (
                    <div
                      key={departemen.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border-subtle)",
                        background: "var(--bg-surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        transition: "all 150ms ease",
                      }}
                    >
                      {isRenamingThis ? (
                        <InlineRename
                          initial={departemen.nama}
                          disabled={saving}
                          onSave={(v) => handleRenameDepartemen(departemen.id, v)}
                          onCancel={() => setRenaming(null)}
                        />
                      ) : (
                        <>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                fontWeight: 500,
                                fontSize: "0.84rem",
                                color: "var(--text-primary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "block",
                              }}
                              title={departemen.nama}
                            >
                              {departemen.nama}
                            </span>
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <button
                              type="button"
                              className="card-icon-btn"
                              title="Ubah nama"
                              aria-label="Ubah nama"
                              disabled={saving}
                              onClick={() =>
                                setRenaming({ level: "departemen", id: departemen.id })
                              }
                            >
                              <Pencil width={13} height={13} />
                            </button>
                            <button
                              type="button"
                              className="card-icon-btn card-icon-btn-danger"
                              title="Hapus"
                              aria-label="Hapus"
                              disabled={saving}
                              onClick={() =>
                                handleDeleteDepartemen(departemen.id, departemen.nama)
                              }
                            >
                              <Trash2 width={13} height={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auto-created Credentials Reveal Modal */}
      <CredentialsRevealModal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title={credentials?.title || ""}
        accounts={credentials?.accounts || []}
      />
    </div>
  );
}
