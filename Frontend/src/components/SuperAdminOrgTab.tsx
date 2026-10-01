"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import ModalOverlay from "@/components/ModalOverlay";
import PasswordField from "@/components/PasswordField";
import DeleteWithPasswordModal from "@/components/DeleteWithPasswordModal";
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
  Lock,
} from "lucide-react";

interface FormModalState {
  mode: "create" | "edit";
  level: "direktorat" | "divisi" | "departemen";
  id?: number;
  parentId?: number;
  parentName?: string;
  nama: string;
  kodeSatuanKerja?: string;
}

interface DeleteTargetState {
  level: "direktorat" | "divisi" | "departemen";
  id: number;
  nama: string;
  subCount?: number;
}

interface FormErrors {
  nama?: string;
  kode?: string;
  password?: string;
  general?: string;
}

function routeApiError(message: string): FormErrors {
  if (/password/i.test(message)) return { password: message };
  if (/nama/i.test(message)) return { nama: message };
  if (/kode/i.test(message)) return { kode: message };
  return { general: message };
}

// Super Admin Organization Tab - Miller Columns (3-Column Drill-Down Explorer)
// Fully adapted to the native GAAS enterprise design system with password verification.
export default function SuperAdminOrgTab() {
  const { showToast } = useToast();

  const [tree, setTree] = useState<OrgDirektoratNode[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Selected column nodes (Miller navigation state)
  const [selectedDirektoratId, setSelectedDirektoratId] = useState<number | null>(null);
  const [selectedDivisiId, setSelectedDivisiId] = useState<number | null>(null);

  // Search filter across columns
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit Modal State
  const [formModal, setFormModal] = useState<FormModalState | null>(null);
  const [formPassword, setFormPassword] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetState | null>(null);

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

    const activeDir =
      tree.find((d) => d.id === selectedDirektoratId) || tree[0];
    if (activeDir.id !== selectedDirektoratId) {
      setSelectedDirektoratId(activeDir.id);
    }

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

  // Modal Openers
  function openCreateDirektorat() {
    setFormModal({ mode: "create", level: "direktorat", nama: "" });
    setFormPassword("");
    setFormErrors({});
  }

  function openEditDirektorat(dir: OrgDirektoratNode) {
    setFormModal({ mode: "edit", level: "direktorat", id: dir.id, nama: dir.nama });
    setFormPassword("");
    setFormErrors({});
  }

  function openCreateDivisi() {
    if (!currentDirektorat) return;
    setFormModal({
      mode: "create",
      level: "divisi",
      parentId: currentDirektorat.id,
      parentName: currentDirektorat.nama,
      nama: "",
      kodeSatuanKerja: "",
    });
    setFormPassword("");
    setFormErrors({});
  }

  function openEditDivisi(div: OrgDivisiNode) {
    setFormModal({
      mode: "edit",
      level: "divisi",
      id: div.id,
      nama: div.nama,
      kodeSatuanKerja: div.kodeSatuanKerja,
    });
    setFormPassword("");
    setFormErrors({});
  }

  function openCreateDepartemen() {
    if (!currentDivisi) return;
    setFormModal({
      mode: "create",
      level: "departemen",
      parentId: currentDivisi.id,
      parentName: currentDivisi.nama,
      nama: "",
    });
    setFormPassword("");
    setFormErrors({});
  }

  function openEditDepartemen(dept: { id: number; nama: string }) {
    setFormModal({
      mode: "edit",
      level: "departemen",
      id: dept.id,
      nama: dept.nama,
    });
    setFormPassword("");
    setFormErrors({});
  }

  // Handle Form Submit (Add / Edit) with Password
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formModal || saving) return;

    setFormErrors({});
    const trimmedNama = formModal.nama.trim();
    const trimmedKode = (formModal.kodeSatuanKerja || "").trim();

    if (!trimmedNama) {
      setFormErrors({ nama: "Nama wajib diisi" });
      return;
    }
    if (formModal.level === "divisi" && !trimmedKode) {
      setFormErrors({ kode: "Kode satuan kerja wajib diisi" });
      return;
    }
    if (!formPassword) {
      setFormErrors({ password: "Password Super Admin wajib diisi" });
      return;
    }

    setSaving(true);
    try {
      if (formModal.level === "direktorat") {
        if (formModal.mode === "create") {
          const res = await api.createDirektorat(trimmedNama, formPassword);
          showToast("Direktorat berhasil ditambahkan");
          setSelectedDirektoratId(res.id);
        } else if (formModal.id) {
          await api.renameDirektorat(formModal.id, trimmedNama, formPassword);
          showToast("Direktorat berhasil diubah");
        }
      } else if (formModal.level === "divisi") {
        if (formModal.mode === "create" && formModal.parentId) {
          const res = await api.createDivisi(formModal.parentId, trimmedNama, trimmedKode, formPassword);
          showToast("Divisi berhasil ditambahkan");
          setSelectedDivisiId(res.divisi.id);
          if (res.accounts.length > 0) {
            setCredentials({
              title: `Akun Baru untuk Divisi "${trimmedNama}"`,
              accounts: res.accounts,
            });
          }
        } else if (formModal.id) {
          await api.updateDivisi(formModal.id, trimmedNama, trimmedKode, formPassword);
          showToast("Divisi berhasil diubah");
        }
      } else if (formModal.level === "departemen") {
        if (formModal.mode === "create" && formModal.parentId) {
          const res = await api.createDepartemen(formModal.parentId, trimmedNama, formPassword);
          showToast("Departemen berhasil ditambahkan");
          if (res.accounts.length > 0) {
            setCredentials({
              title: `Akun Baru untuk Departemen "${trimmedNama}"`,
              accounts: res.accounts,
            });
          }
        } else if (formModal.id) {
          await api.renameDepartemen(formModal.id, trimmedNama, formPassword);
          showToast("Departemen berhasil diubah");
        }
      }

      setFormModal(null);
      await load();
    } catch (err) {
      setFormErrors(routeApiError(errorMessage(err)));
    } finally {
      setSaving(false);
    }
  }

  // Handle Delete with Password Confirmation
  async function handleDeleteConfirm(password: string) {
    if (!deleteTarget) return;

    if (deleteTarget.level === "direktorat") {
      await api.deleteDirektorat(deleteTarget.id, password);
      showToast("Direktorat berhasil dihapus");
      if (selectedDirektoratId === deleteTarget.id) {
        setSelectedDirektoratId(null);
        setSelectedDivisiId(null);
      }
    } else if (deleteTarget.level === "divisi") {
      await api.deleteDivisi(deleteTarget.id, password);
      showToast("Divisi berhasil dihapus");
      if (selectedDivisiId === deleteTarget.id) {
        setSelectedDivisiId(null);
      }
    } else if (deleteTarget.level === "departemen") {
      await api.deleteDepartemen(deleteTarget.id, password);
      showToast("Departemen berhasil dihapus");
    }

    setDeleteTarget(null);
    await load();
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

      {/* Path Breadcrumb (Revisi 1: Tanpa "Navigasi Aktif", hanya Direktorat -> Divisi -> Departemen dengan warna hitam) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: "var(--bg-surface-alt)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          fontSize: "0.84rem",
          marginTop: 12,
          marginBottom: 14,
          flexWrap: "wrap",
          color: "var(--text-primary)",
        }}
      >
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {currentDirektorat ? currentDirektorat.nama : "Pilih Direktorat"}
        </span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600, opacity: 0.6 }}>&rarr;</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {currentDivisi ? `${currentDivisi.nama} (${currentDivisi.kodeSatuanKerja})` : "Pilih Divisi"}
        </span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600, opacity: 0.6 }}>&rarr;</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {currentDivisi ? `${currentDivisi.departemen.length} Departemen` : "0 Departemen"}
        </span>
      </div>

      {/* Toolbar: Search normal di Ujung Kiri dan Count Box di Ujung Kanan (Revisi 2) */}
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
        <div className="settings-table-search" style={{ maxWidth: 340, width: "100%" }}>
          <Search width={16} height={16} />
          <input
            type="text"
            placeholder="Cari Direktorat, Divisi, dan Departemen"
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
                onClick={openCreateDirektorat}
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
              {filteredDirektorat.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                  {searchQuery ? "Tidak ditemukan" : "Belum ada Direktorat"}
                </div>
              ) : (
                filteredDirektorat.map((direktorat) => {
                  const isSelected = selectedDirektoratId === direktorat.id;

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
                        background: "var(--bg-surface)",
                        boxShadow: isSelected ? "0 2px 8px rgba(28, 109, 255, 0.12)" : "none",
                        transition: "all 150ms ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
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
                          onClick={() => openEditDirektorat(direktorat)}
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
                            setDeleteTarget({
                              level: "direktorat",
                              id: direktorat.id,
                              nama: direktorat.nama,
                              subCount: direktorat.divisi.length,
                            })
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
                onClick={openCreateDivisi}
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
                        onClick={openCreateDivisi}
                      >
                        <Plus width={13} height={13} /> Tambah Divisi Pertama
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredDivisi.map((divisi) => {
                  const isSelected = selectedDivisiId === divisi.id;

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
                        background: "var(--bg-surface)",
                        boxShadow: isSelected ? "0 2px 8px rgba(28, 109, 255, 0.12)" : "none",
                        transition: "all 150ms ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
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
                          onClick={() => openEditDivisi(divisi)}
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
                            setDeleteTarget({
                              level: "divisi",
                              id: divisi.id,
                              nama: divisi.nama,
                              subCount: divisi.departemen.length,
                            })
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
                onClick={openCreateDepartemen}
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
                        onClick={openCreateDepartemen}
                      >
                        <Plus width={13} height={13} /> Tambah Departemen Pertama
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredDepartemen.map((departemen) => {
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
                          onClick={() => openEditDepartemen(departemen)}
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
                            setDeleteTarget({
                              level: "departemen",
                              id: departemen.id,
                              nama: departemen.nama,
                            })
                          }
                        >
                          <Trash2 width={13} height={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Tambah / Edit dengan Password (Revisi 3) */}
      <ModalOverlay
        open={!!formModal}
        onClose={() => (saving ? {} : setFormModal(null))}
        className={`modal-overlay modal-overlay-centered ${formModal ? "" : "hidden"}`}
      >
        {formModal && (
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>
                {formModal.mode === "create" ? "Tambah " : "Ubah "}
                {formModal.level === "direktorat"
                  ? "Direktorat"
                  : formModal.level === "divisi"
                  ? `Divisi${formModal.mode === "create" && formModal.parentName ? ` (${formModal.parentName})` : ""}`
                  : `Departemen${formModal.mode === "create" && formModal.parentName ? ` (${formModal.parentName})` : ""}`}
              </h3>
              <button
                type="button"
                className="modal-close"
                disabled={saving}
                onClick={() => setFormModal(null)}
              >
                &times;
              </button>
            </div>

            <div className={`alert-error ${formErrors.general ? "alert-error-visible" : ""}`}>
              <div className="alert-error-text">
                <strong>Error</strong>
                <span>{formErrors.general}</span>
              </div>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="form-grid">
                <div className="field full">
                  <label htmlFor="org-form-nama">
                    Nama {formModal.level === "direktorat" ? "Direktorat" : formModal.level === "divisi" ? "Divisi" : "Departemen"}
                  </label>
                  <input
                    id="org-form-nama"
                    type="text"
                    required
                    autoFocus
                    placeholder={`Masukkan nama ${formModal.level}`}
                    value={formModal.nama}
                    onChange={(e) =>
                      setFormModal((prev) => (prev ? { ...prev, nama: e.target.value } : null))
                    }
                  />
                  {formErrors.nama && <div className="field-error-text">{formErrors.nama}</div>}
                </div>

                {formModal.level === "divisi" && (
                  <div className="field full">
                    <label htmlFor="org-form-kode">Kode Satuan Kerja</label>
                    <input
                      id="org-form-kode"
                      type="text"
                      required
                      placeholder="Contoh: CORSEC, EPCP"
                      value={formModal.kodeSatuanKerja || ""}
                      onChange={(e) =>
                        setFormModal((prev) => (prev ? { ...prev, kodeSatuanKerja: e.target.value } : null))
                      }
                    />
                    {formErrors.kode && <div className="field-error-text">{formErrors.kode}</div>}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <PasswordField
                  id="org-form-password"
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

              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: "auto" }}
                  disabled={saving}
                  onClick={() => setFormModal(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "auto" }}
                  disabled={saving || !formPassword || !formModal.nama.trim()}
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        )}
      </ModalOverlay>

      {/* Modal Hapus dengan Password (Revisi 3) */}
      <DeleteWithPasswordModal
        open={!!deleteTarget}
        title={
          deleteTarget?.level === "direktorat"
            ? `Hapus Direktorat "${deleteTarget.nama}"?`
            : deleteTarget?.level === "divisi"
            ? `Hapus Divisi "${deleteTarget.nama}"?`
            : `Hapus Departemen "${deleteTarget?.nama}"?`
        }
        passwordFieldId="delete-org-item-password"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="form-grid">
            <div className="field full">
              <label>Nama {deleteTarget.level === "direktorat" ? "Direktorat" : deleteTarget.level === "divisi" ? "Divisi" : "Departemen"}</label>
              <input type="text" value={deleteTarget.nama} disabled readOnly />
            </div>
            {deleteTarget.subCount !== undefined && deleteTarget.subCount > 0 && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--badge-rejected-bg)",
                  marginTop: -6,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(220, 38, 38, 0.08)",
                  border: "1px solid rgba(220, 38, 38, 0.2)",
                }}
              >
                Perhatian: {deleteTarget.level === "direktorat"
                  ? `${deleteTarget.subCount} Divisi di dalamnya akan ikut terhapus.`
                  : `${deleteTarget.subCount} Departemen di dalamnya akan ikut terhapus.`}
              </div>
            )}
          </div>
        )}
      </DeleteWithPasswordModal>

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
