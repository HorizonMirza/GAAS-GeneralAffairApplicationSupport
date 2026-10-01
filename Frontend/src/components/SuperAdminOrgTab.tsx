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
  RotateCcw,
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
  const [selectedDepartemenId, setSelectedDepartemenId] = useState<number | null>(null);

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

  // Validate selected nodes if tree changed (e.g. after deletion)
  useEffect(() => {
    if (!tree || tree.length === 0) {
      setSelectedDirektoratId(null);
      setSelectedDivisiId(null);
      setSelectedDepartemenId(null);
      return;
    }

    if (selectedDirektoratId && !tree.some((d) => d.id === selectedDirektoratId)) {
      setSelectedDirektoratId(null);
    }

    if (selectedDivisiId) {
      const exists = tree.some((d) => d.divisi.some((dv) => dv.id === selectedDivisiId));
      if (!exists) {
        setSelectedDivisiId(null);
      }
    }

    if (selectedDepartemenId) {
      const exists = tree.some((d) =>
        d.divisi.some((dv) => dv.departemen.some((dp) => dp.id === selectedDepartemenId))
      );
      if (!exists) {
        setSelectedDepartemenId(null);
      }
    }
  }, [tree, selectedDirektoratId, selectedDivisiId, selectedDepartemenId]);

  function errorMessage(err: unknown): string {
    return err instanceof ApiError
      ? err.message
      : err instanceof Error
      ? err.message
      : "Terjadi kesalahan";
  }

  // Active nodes lookup (null if none selected)
  const currentDirektorat = useMemo(() => {
    if (!tree || selectedDirektoratId === null) return null;
    return tree.find((d) => d.id === selectedDirektoratId) || null;
  }, [tree, selectedDirektoratId]);

  const currentDivisi = useMemo(() => {
    if (!tree || selectedDivisiId === null) return null;
    for (const d of tree) {
      const dv = d.divisi.find((item) => item.id === selectedDivisiId);
      if (dv) return dv;
    }
    return null;
  }, [tree, selectedDivisiId]);

  // Flattened lists for full organization drilldown & scroll
  const allDivisiList = useMemo(() => {
    if (!tree) return [];
    return tree.flatMap((d) =>
      d.divisi.map((dv) => ({
        ...dv,
        direktoratId: d.id,
        direktoratNama: d.nama,
      }))
    );
  }, [tree]);

  const allDepartemenList = useMemo(() => {
    if (!tree) return [];
    return tree.flatMap((d) =>
      d.divisi.flatMap((dv) =>
        dv.departemen.map((dp) => ({
          ...dp,
          divisiId: dv.id,
          divisiNama: dv.nama,
          kodeSatuanKerja: dv.kodeSatuanKerja,
          direktoratId: d.id,
          direktoratNama: d.nama,
        }))
      )
    );
  }, [tree]);

  const currentDepartemen = useMemo(() => {
    if (!selectedDepartemenId) return null;
    return allDepartemenList.find((dp) => dp.id === selectedDepartemenId) || null;
  }, [allDepartemenList, selectedDepartemenId]);

  function handleResetAll() {
    setSelectedDirektoratId(null);
    setSelectedDivisiId(null);
    setSelectedDepartemenId(null);
    setSearchQuery("");
  }

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
    const parent = currentDirektorat || (tree && tree.length > 0 ? tree[0] : null);
    setFormModal({
      mode: "create",
      level: "divisi",
      parentId: parent?.id,
      parentName: parent?.nama,
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
    const parent = currentDivisi || (allDivisiList.length > 0 ? allDivisiList[0] : null);
    setFormModal({
      mode: "create",
      level: "departemen",
      parentId: parent?.id,
      parentName: parent?.nama,
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
        if (formModal.mode === "create") {
          const parentId = formModal.parentId || (tree && tree.length > 0 ? tree[0].id : undefined);
          if (!parentId) {
            setFormErrors({ general: "Direktorat belum dipilih" });
            return;
          }
          const res = await api.createDivisi(parentId, trimmedNama, trimmedKode, formPassword);
          showToast("Divisi berhasil ditambahkan");
          setSelectedDivisiId(res.divisi.id);
          setSelectedDirektoratId(parentId);
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
        if (formModal.mode === "create") {
          const parentId = formModal.parentId || (allDivisiList.length > 0 ? allDivisiList[0].id : undefined);
          if (!parentId) {
            setFormErrors({ general: "Divisi belum dipilih" });
            return;
          }
          const res = await api.createDepartemen(parentId, trimmedNama, formPassword);
          showToast("Departemen berhasil ditambahkan");
          setSelectedDivisiId(parentId);
          const foundDiv = allDivisiList.find((dv) => dv.id === parentId);
          if (foundDiv) setSelectedDirektoratId(foundDiv.direktoratId);
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
        setSelectedDepartemenId(null);
      }
    } else if (deleteTarget.level === "divisi") {
      await api.deleteDivisi(deleteTarget.id, password);
      showToast("Divisi berhasil dihapus");
      if (selectedDivisiId === deleteTarget.id) {
        setSelectedDivisiId(null);
        setSelectedDepartemenId(null);
      }
    } else if (deleteTarget.level === "departemen") {
      await api.deleteDepartemen(deleteTarget.id, password);
      showToast("Departemen berhasil dihapus");
      if (selectedDepartemenId === deleteTarget.id) {
        setSelectedDepartemenId(null);
      }
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
    const baseList = currentDirektorat
      ? currentDirektorat.divisi.map((dv) => ({
          ...dv,
          direktoratId: currentDirektorat.id,
          direktoratNama: currentDirektorat.nama,
        }))
      : allDivisiList;

    if (!queryLower) return baseList;

    return baseList.filter(
      (dv) =>
        dv.nama.toLowerCase().includes(queryLower) ||
        dv.kodeSatuanKerja.toLowerCase().includes(queryLower) ||
        dv.departemen.some((dp) => dp.nama.toLowerCase().includes(queryLower)) ||
        dv.direktoratNama.toLowerCase().includes(queryLower)
    );
  }, [currentDirektorat, allDivisiList, queryLower]);

  const filteredDepartemen = useMemo(() => {
    let baseList = allDepartemenList;
    if (currentDivisi) {
      baseList = baseList.filter((dp) => dp.divisiId === currentDivisi.id);
    } else if (currentDirektorat) {
      baseList = baseList.filter((dp) => dp.direktoratId === currentDirektorat.id);
    }

    if (!queryLower) return baseList;

    return baseList.filter(
      (dp) =>
        dp.nama.toLowerCase().includes(queryLower) ||
        dp.divisiNama.toLowerCase().includes(queryLower) ||
        dp.kodeSatuanKerja.toLowerCase().includes(queryLower) ||
        dp.direktoratNama.toLowerCase().includes(queryLower)
    );
  }, [currentDivisi, currentDirektorat, allDepartemenList, queryLower]);

  return (
    <div className="card">
      {/* Standard GAAS Card Header */}
      <div className="card-header">
        <h3>Struktur Organisasi</h3>
      </div>

      {/* Path Breadcrumb (Revisi 1: Tanpa box biru, hanya teks breadcrumb minimalis) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "0.85rem",
          marginTop: 6,
          marginBottom: 14,
          flexWrap: "wrap",
          color: "var(--text-primary)",
          fontWeight: 600,
        }}
      >
        <span>
          {currentDirektorat ? currentDirektorat.nama : "Semua Direktorat"}
        </span>
        <span style={{ opacity: 0.45 }}>&rarr;</span>
        <span>
          {currentDivisi
            ? `${currentDivisi.nama} (${currentDivisi.kodeSatuanKerja})`
            : currentDirektorat
            ? `${currentDirektorat.divisi.length} Divisi`
            : "Semua Divisi"}
        </span>
        <span style={{ opacity: 0.45 }}>&rarr;</span>
        <span>
          {currentDepartemen
            ? currentDepartemen.nama
            : currentDivisi
            ? `${currentDivisi.departemen.length} Departemen`
            : currentDirektorat
            ? `${currentDirektorat.divisi.reduce((acc, dv) => acc + dv.departemen.length, 0)} Departemen`
            : `${stats.totalDept} Departemen`}
        </span>
      </div>

      {/* Toolbar: Search normal di Ujung Kiri dan Count Box + Tombol Reset di Ujung Kanan (Revisi 1) */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="settings-table-count-box">
            {stats.totalDir} Direktorat &bull; {stats.totalDiv} Divisi &bull; {stats.totalDept} Departemen
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              width: 36,
              height: 36,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              cursor: "pointer",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
            onClick={handleResetAll}
            title="Reset Pilihan dan Muat Ulang"
            aria-label="Reset Pilihan"
          >
            <RotateCcw width={16} height={16} />
          </button>
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
              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                Direktorat
              </span>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  height: 32,
                  padding: "0 14px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  width: "auto",
                }}
                disabled={saving}
                onClick={openCreateDirektorat}
                title="Tambah Direktorat baru"
              >
                <Plus width={14} height={14} /> Tambah
              </button>
            </div>

            {/* Column List */}
            <div
              style={{
                padding: 10,
                flex: 1,
                overflowY: "auto",
                maxHeight: 345,
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
                        if (selectedDirektoratId === direktorat.id) {
                          setSelectedDirektoratId(null);
                          setSelectedDivisiId(null);
                          setSelectedDepartemenId(null);
                        } else {
                          setSelectedDirektoratId(direktorat.id);
                          setSelectedDivisiId(null);
                          setSelectedDepartemenId(null);
                        }
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: isSelected
                          ? "1.5px solid var(--blue-500)"
                          : "1px solid var(--border-subtle)",
                        background: isSelected ? "rgba(28, 109, 255, 0.03)" : "var(--bg-surface)",
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
              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                Divisi
              </span>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  height: 32,
                  padding: "0 14px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  width: "auto",
                }}
                disabled={saving || !tree || tree.length === 0}
                onClick={openCreateDivisi}
                title="Tambah Divisi"
              >
                <Plus width={14} height={14} /> Tambah
              </button>
            </div>

            {/* Column List */}
            <div
              style={{
                padding: 10,
                flex: 1,
                overflowY: "auto",
                maxHeight: 345,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {filteredDivisi.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                  {searchQuery ? "Tidak ditemukan" : (
                    <div>
                      <p style={{ margin: "0 0 10px 0" }}>Belum ada Divisi</p>
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
                      onClick={() => {
                        if (selectedDivisiId === divisi.id) {
                          setSelectedDivisiId(null);
                          setSelectedDepartemenId(null);
                        } else {
                          setSelectedDivisiId(divisi.id);
                          setSelectedDepartemenId(null);
                          if (!selectedDirektoratId) {
                            setSelectedDirektoratId(divisi.direktoratId);
                          }
                        }
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: isSelected
                          ? "1.5px solid var(--blue-500)"
                          : "1px solid var(--border-subtle)",
                        background: isSelected ? "rgba(28, 109, 255, 0.03)" : "var(--bg-surface)",
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
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
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
                          {!selectedDirektoratId && (
                            <span
                              className="text-secondary"
                              style={{ fontSize: "0.7rem", opacity: 0.75 }}
                              title={divisi.direktoratNama}
                            >
                              &bull; {divisi.direktoratNama}
                            </span>
                          )}
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
              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>
                Departemen
              </span>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  height: 32,
                  padding: "0 14px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  width: "auto",
                }}
                disabled={saving || allDivisiList.length === 0}
                onClick={openCreateDepartemen}
                title="Tambah Departemen"
              >
                <Plus width={14} height={14} /> Tambah
              </button>
            </div>

            {/* Column List */}
            <div
              style={{
                padding: 10,
                flex: 1,
                overflowY: "auto",
                maxHeight: 345,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {filteredDepartemen.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                  {searchQuery ? "Tidak ditemukan" : (
                    <div>
                      <p style={{ margin: "0 0 10px 0" }}>Belum ada Departemen</p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: "auto", height: 30, padding: "0 12px", fontSize: "0.78rem" }}
                        disabled={saving || allDivisiList.length === 0}
                        onClick={openCreateDepartemen}
                      >
                        <Plus width={13} height={13} /> Tambah Departemen Pertama
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredDepartemen.map((departemen) => {
                  const isSelected = selectedDepartemenId === departemen.id;

                  return (
                    <div
                      key={departemen.id}
                      onClick={() => {
                        if (selectedDepartemenId === departemen.id) {
                          setSelectedDepartemenId(null);
                        } else {
                          setSelectedDepartemenId(departemen.id);
                          if (!selectedDivisiId) {
                            setSelectedDivisiId(departemen.divisiId);
                          }
                          if (!selectedDirektoratId) {
                            setSelectedDirektoratId(departemen.direktoratId);
                          }
                        }
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: isSelected
                          ? "1.5px solid var(--blue-500)"
                          : "1px solid var(--border-subtle)",
                        background: isSelected ? "rgba(28, 109, 255, 0.03)" : "var(--bg-surface)",
                        boxShadow: isSelected ? "0 2px 8px rgba(28, 109, 255, 0.12)" : "none",
                        transition: "all 150ms ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: "0.84rem",
                            color: isSelected ? "var(--blue-500)" : "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "block",
                          }}
                          title={departemen.nama}
                        >
                          {departemen.nama}
                        </span>
                        {!selectedDivisiId && (
                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--text-secondary)",
                              marginTop: 2,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={`${departemen.divisiNama} (${departemen.kodeSatuanKerja})`}
                          >
                            {departemen.divisiNama} ({departemen.kodeSatuanKerja})
                          </div>
                        )}
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
                {formModal.mode === "create" && formModal.level === "divisi" && (
                  <div className="field full">
                    <label htmlFor="org-form-parent-dir">Direktorat</label>
                    <select
                      id="org-form-parent-dir"
                      value={formModal.parentId || (tree?.[0]?.id ?? "")}
                      onChange={(e) => {
                        const dirId = Number(e.target.value);
                        const dir = tree?.find((d) => d.id === dirId);
                        setFormModal((prev) =>
                          prev ? { ...prev, parentId: dirId, parentName: dir?.nama } : null
                        );
                      }}
                    >
                      {tree?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formModal.mode === "create" && formModal.level === "departemen" && (
                  <div className="field full">
                    <label htmlFor="org-form-parent-div">Divisi</label>
                    <select
                      id="org-form-parent-div"
                      value={formModal.parentId || (allDivisiList[0]?.id ?? "")}
                      onChange={(e) => {
                        const divId = Number(e.target.value);
                        const div = allDivisiList.find((dv) => dv.id === divId);
                        setFormModal((prev) =>
                          prev ? { ...prev, parentId: divId, parentName: div?.nama } : null
                        );
                      }}
                    >
                      {allDivisiList.map((dv) => (
                        <option key={dv.id} value={dv.id}>
                          {dv.nama} ({dv.kodeSatuanKerja})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
