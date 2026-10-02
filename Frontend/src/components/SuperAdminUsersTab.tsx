"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ROLE_LABEL } from "@/lib/constants";
import type { AdminUserListItem, ImpersonationLogEntry, OrgStructure, Role } from "@/lib/types";
import SearchableSelect from "@/components/SearchableSelect";
import ModalOverlay from "@/components/ModalOverlay";
import CredentialsRevealModal, { type RevealedCredential } from "@/components/CredentialsRevealModal";
import { formatDateTime } from "@/lib/format";
import {
  ListChecks,
  SquarePen,
  KeyRound,
  LogOut,
  LogIn,
  Trash2,
  UserCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { itemVariants, sidebarVariants } from "@/components/ui/menu";
import { useRowMenu } from "@/lib/useRowMenu";
import { useClickOutside } from "@/lib/useClickOutside";
import { useExclusivePanel } from "@/lib/exclusivePanel";

const ROLE_OPTIONS = Object.keys(ROLE_LABEL) as Role[];
const LIMIT_OPTIONS = [10, 20, 50, 100];

interface FilterState {
  page: number;
  limit: number;
  role: Role | "";
  divisi: string;
  departemen: string;
  search: string;
  isActive: boolean | "";
}

const EMPTY_FILTERS: FilterState = { page: 1, limit: 10, role: "", divisi: "", departemen: "", search: "", isActive: "" };

interface UserFormState {
  username: string;
  nama: string;
  role: Role;
  direktorat: string;
  divisi: string;
  departemen: string;
  email: string;
  noHp: string;
}

const EMPTY_FORM: UserFormState = { username: "", nama: "", role: "ADMIN_DEPARTEMEN", direktorat: "", divisi: "", departemen: "", email: "", noHp: "" };

// Super Admin's account management table - the UI for UsersAdminController, and the direct fix
// for DbSeeder's shared DefaultPassword ("123456789") never having a way to actually change per
// account. Extracted out of superadmin/page.tsx (already 2000+ lines) rather than added inline.
export default function SuperAdminUsersTab({ orgStructure }: { orgStructure: OrgStructure | null }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { me, refresh } = useAuth();
  const router = useRouter();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([filterWrapRef], () => setFilterOpen(false), filterOpen);
  useExclusivePanel(filterOpen, () => setFilterOpen(false));

  const rowMenu = useRowMenu(items);

  const [detailUser, setDetailUser] = useState<AdminUserListItem | null>(null);
  const [formOpen, setFormOpen] = useState<"create" | AdminUserListItem | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [credentials, setCredentials] = useState<{ title: string; accounts: RevealedCredential[] } | null>(null);

  const [impersonating, setImpersonating] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logItems, setLogItems] = useState<ImpersonationLogEntry[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logBusy, setLogBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.listAdminUsers(filters);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "Gagal memuat daftar akun");
    } finally {
      setBusy(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced search, same 400ms pattern used by every other search box on this page.
  useEffect(() => {
    const id = setTimeout(() => setFilters((prev) => ({ ...prev, search: searchInput, page: 1 })), 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  function errorMessage(err: unknown): string {
    return err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Terjadi kesalahan";
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const pageStart = Math.min(Math.max(1, filters.page), totalPages);
  const pageEnd = Math.min(totalPages, pageStart + 1);
  const pageButtons: number[] = [];
  for (let p = pageStart; p <= pageEnd; p++) pageButtons.push(p);

  const directoratNode = orgStructure?.direktoratTree.find((d) => d.nama === form.direktorat) || null;
  const divisiOptions = directoratNode ? directoratNode.divisi.map((v) => v.nama) : orgStructure?.divisi || [];
  const divisiNode = form.divisi
    ? (directoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === form.divisi)
    : null;
  const departemenOptions = divisiNode ? divisiNode.departemen : orgStructure?.departemen || [];

  const filterDivisiNode = filters.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === filters.divisi)
    : null;
  const filterDepartemenOptions = filterDivisiNode ? filterDivisiNode.departemen : orgStructure?.departemen || [];

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen("create");
  }

  function openEdit(user: AdminUserListItem) {
    setForm({
      username: user.username,
      nama: user.nama,
      role: user.role,
      direktorat: user.direktorat || "",
      divisi: user.divisi || "",
      departemen: user.departemen || "",
      email: user.email || "",
      noHp: user.noHp || "",
    });
    setFormError("");
    setFormOpen(user);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.nama.trim()) { setFormError("Nama akun wajib diisi"); return; }
    if (formOpen === "create" && !form.username.trim()) { setFormError("Username wajib diisi"); return; }

    setSaving(true);
    try {
      if (formOpen === "create") {
        const result = await api.createAdminUser({
          username: form.username.trim(),
          nama: form.nama.trim(),
          role: form.role,
          divisi: form.divisi || null,
          departemen: form.departemen || null,
          email: form.email.trim() || null,
          noHp: form.noHp.trim() || null,
        });
        setFormOpen(null);
        showToast("Akun berhasil dibuat");
        setCredentials({
          title: `Akun Baru: ${result.user.nama}`,
          accounts: [{ username: result.user.username, nama: result.user.nama, role: result.user.role, password: result.password }],
        });
      } else if (formOpen) {
        await api.updateAdminUser(formOpen.id, {
          nama: form.nama.trim(),
          role: form.role,
          divisi: form.divisi || null,
          departemen: form.departemen || null,
          clearDivisi: !form.divisi,
          clearDepartemen: !form.departemen,
          email: form.email.trim() || null,
          noHp: form.noHp.trim() || null,
        });
        setFormOpen(null);
        showToast("Akun berhasil diperbarui");
      }
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleResetPassword(user: AdminUserListItem) {
    confirm(`Reset password akun "${user.nama}" (${user.username})? Password lama tidak akan berlaku lagi.`, async () => {
      try {
        const result = await api.resetAdminUserPassword(user.id);
        showToast("Password berhasil direset");
        setCredentials({
          title: `Password Baru: ${user.nama}`,
          accounts: [{ username: user.username, nama: user.nama, role: user.role, password: result.password }],
        });
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      }
    }, "Reset Password");
  }

  // "Paksa logout" - memutus semua sesi login akun ini seketika tanpa mengubah passwordnya (lihat
  // UsersAdminController.ForceLogout) - akun bisa langsung login lagi dengan password yang sama.
  function handleForceLogout(user: AdminUserListItem) {
    confirm(`Paksa logout akun "${user.nama}" (${user.username})? Semua sesi login akun ini akan terputus seketika - password tidak berubah.`, async () => {
      try {
        await api.forceLogoutAdminUser(user.id);
        showToast("Akun berhasil dipaksa logout");
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      }
    }, "Paksa Logout");
  }

  function handleToggleActive(user: AdminUserListItem) {
    const actionText = user.isActive ? "menonaktifkan / menghapus" : "mengaktifkan";
    confirm(`Yakin ingin ${actionText} akun "${user.nama}" (${user.username})?`, async () => {
      try {
        if (user.isActive) await api.deactivateAdminUser(user.id);
        else await api.activateAdminUser(user.id);
        showToast(`Akun berhasil ${user.isActive ? "dinonaktifkan" : "diaktifkan"}`);
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      }
    }, user.isActive ? "Delete" : "Aktifkan");
  }

  // "Login As" - bertindak penuh sebagai akun ini (approve/reject/edit/buat baru, dst persis
  // seperti akun tsb login sendiri). Lihat UsersAdminController.Impersonate untuk mekanismenya.
  function handleImpersonate(user: AdminUserListItem) {
    confirm(
      `Login As akun "${user.nama}" (${user.username})? Anda akan bertindak penuh sebagai akun ini sampai memilih "Kembali ke Super Admin".`,
      async () => {
        setImpersonating(user.id);
        try {
          await api.impersonateUser(user.id);
          await refresh();
          router.push("/dashboard");
        } catch (err) {
          showToast(errorMessage(err), "error");
        } finally {
          setImpersonating(null);
        }
      },
      "Login As"
    );
  }

  const loadImpersonationLog = useCallback(async (page: number) => {
    setLogBusy(true);
    try {
      const data = await api.listImpersonationLog({ page, limit: 20 });
      setLogItems(data.items);
      setLogTotal(data.total);
      setLogPage(page);
    } catch (err) {
      showToast(errorMessage(err), "error");
    } finally {
      setLogBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openImpersonationLog() {
    setLogOpen(true);
    loadImpersonationLog(1);
  }

  return (
    <>
      <div className="card">
        <div className="toolbar transactions-page-toolbar">
          <div className="field toolbar-search-field">
            <label htmlFor="users-search">Cari Username</label>
            <input
              id="users-search"
              type="text"
              placeholder="Username"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="filter-dropdown-wrap" ref={filterWrapRef}>
            <label className="filter-dropdown-label">Filter Lainnya</label>
            <button
              type="button"
              className="btn filter-dropdown-toggle"
              id="users-filter-toggle"
              style={{ minWidth: 145, justifyContent: "space-between" }}
              onClick={() => setFilterOpen((v) => !v)}
            >
              Semua Filter
              <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            {filterOpen && (
              <div className="filter-dropdown-panel">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="users-role">Role</label>
                  <SearchableSelect
                    id="users-role"
                    value={filters.role}
                    onChange={(v) => setFilters((prev) => ({ ...prev, role: v as Role | "", page: 1 }))}
                    options={ROLE_OPTIONS}
                    getLabel={(v) => ROLE_LABEL[v as Role] || v}
                    clearLabel="Semua Role"
                    placeholder="Semua Role"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="users-divisi">Divisi</label>
                  <SearchableSelect
                    id="users-divisi"
                    value={filters.divisi}
                    onChange={(v) => setFilters((prev) => ({ ...prev, divisi: v, departemen: "", page: 1 }))}
                    options={orgStructure?.divisi || []}
                    clearLabel="Semua Divisi"
                    placeholder="Semua Divisi"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="users-departemen">Departemen</label>
                  <SearchableSelect
                    id="users-departemen"
                    value={filters.departemen}
                    onChange={(v) => setFilters((prev) => ({ ...prev, departemen: v, page: 1 }))}
                    options={filterDepartemenOptions}
                    clearLabel="Semua Departemen"
                    placeholder="Semua Departemen"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, marginTop: 12 }}>
                  <label htmlFor="users-active">Status</label>
                  <SearchableSelect
                    id="users-active"
                    value={filters.isActive === "" ? "" : String(filters.isActive)}
                    onChange={(v) => setFilters((prev) => ({ ...prev, isActive: v === "" ? "" : v === "true", page: 1 }))}
                    options={["true", "false"]}
                    getLabel={(v) => (v === "true" ? "Aktif" : "Nonaktif")}
                    clearLabel="Semua Status"
                    placeholder="Semua Status"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "auto", alignSelf: "flex-end", height: 38, padding: "0 16px", borderRadius: 8, boxSizing: "border-box" }}
            onClick={() => { setFilters(EMPTY_FILTERS); setSearchInput(""); }}
          >
            Semua Akun
          </button>

          <div className="toolbar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "auto", height: 38, padding: "0 16px", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}
              onClick={openImpersonationLog}
            >
              Riwayat Login
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "auto", height: 38, padding: "0 16px", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}
              onClick={openCreate}
            >
              + Tambah Akun
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: "center" }}>No</th>
                <th>Username</th>
                <th>Nama</th>
                <th>Role</th>
                <th>Direktorat</th>
                <th>Divisi</th>
                <th>Departemen</th>
                <th>Email</th>
                <th>No. HP</th>
                <th>Status</th>
                <th style={{ width: 44, textAlign: "center" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {busy ? (
                <tr><td colSpan={11} className="table-empty">Memuat data...</td></tr>
              ) : error ? (
                <tr><td colSpan={11} className="table-empty">{error}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={11} className="table-empty">Tidak Ada Data</td></tr>
              ) : (
                items.map((user, idx) => (
                  <tr key={user.id}>
                    <td style={{ textAlign: "center" }}>{(filters.page - 1) * filters.limit + idx + 1}</td>
                    <td>{user.username}</td>
                    <td>{user.nama}</td>
                    <td>{ROLE_LABEL[user.role] || user.role}</td>
                    <td>{user.direktorat || "-"}</td>
                    <td>{user.divisi || "-"}</td>
                    <td>{user.departemen || "-"}</td>
                    <td>{user.email || "-"}</td>
                    <td>{user.noHp || "-"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span className={`badge ${user.isActive ? "badge-approved" : "badge-rejected"}`}>
                          {user.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                        {user.mustChangePassword && (
                          <span className="badge badge-pending" title="Belum mengganti password sementara">
                            Belum Ganti Password
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="card-icon-btn"
                        aria-label="Aksi"
                        onClick={(e) => {
                          e.stopPropagation();
                          rowMenu.toggle(e, user.id, 240);
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      <div className="pagination">
        <div className="pagination-left">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="users-limit">Tampilkan</label>
            <SearchableSelect
              id="users-limit"
              value={String(filters.limit)}
              onChange={(v) => setFilters((prev) => ({ ...prev, limit: Number(v), page: 1 }))}
              options={LIMIT_OPTIONS.map(String)}
              getLabel={(v) => `${v} Akun`}
              placeholder={`${filters.limit} Akun`}
            />
          </div>
        </div>
        <div className="pagination-right">
          <span className="text-secondary">Total {total} Akun · Halaman {filters.page} dari {totalPages}</span>
          <div className="pages">
            <button className="page-btn" disabled={filters.page <= 1} onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}>‹</button>
            {pageButtons.map((p) => (
              <button
                key={p}
                className={`page-btn ${p === filters.page ? "active" : ""}`}
                onClick={() => setFilters((prev) => ({ ...prev, page: p }))}
              >
                {p}
              </button>
            ))}
            <button className="page-btn" disabled={filters.page >= totalPages} onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}>›</button>
          </div>
        </div>
      </div>
    </div>

      {rowMenu.position && rowMenu.menuItem && (
        <motion.div
          className="row-menu-dropdown"
          style={{
            top: rowMenu.position.top,
            left: rowMenu.position.left,
          }}
          onClick={(e) => e.stopPropagation()}
          initial="hidden"
          animate="visible"
          variants={sidebarVariants}
        >
          <motion.div variants={itemVariants}>
            <button
              type="button"
              className="row-menu-item"
              onClick={() => {
                const u = rowMenu.menuItem!;
                rowMenu.close();
                setDetailUser(u);
              }}
            >
              <ListChecks width={16} height={16} />
              Detail
            </button>
          </motion.div>

          <motion.div variants={itemVariants}>
            <button
              type="button"
              className="row-menu-item"
              onClick={() => {
                const u = rowMenu.menuItem!;
                rowMenu.close();
                openEdit(u);
              }}
            >
              <SquarePen width={16} height={16} />
              Updates
            </button>
          </motion.div>

          <motion.div variants={itemVariants}>
            <button
              type="button"
              className="row-menu-item"
              onClick={() => {
                const u = rowMenu.menuItem!;
                rowMenu.close();
                handleResetPassword(u);
              }}
            >
              <KeyRound width={16} height={16} />
              Reset Password
            </button>
          </motion.div>

          {rowMenu.menuItem.isActive && (
            <motion.div variants={itemVariants}>
              <button
                type="button"
                className="row-menu-item"
                onClick={() => {
                  const u = rowMenu.menuItem!;
                  rowMenu.close();
                  handleForceLogout(u);
                }}
              >
                <LogOut width={16} height={16} />
                Paksa Logout
              </button>
            </motion.div>
          )}

          {rowMenu.menuItem.isActive && rowMenu.menuItem.role !== "SUPER_ADMIN" && rowMenu.menuItem.id !== me?.id && (
            <motion.div variants={itemVariants}>
              <button
                type="button"
                className="row-menu-item"
                disabled={impersonating === rowMenu.menuItem.id}
                onClick={() => {
                  const u = rowMenu.menuItem!;
                  rowMenu.close();
                  handleImpersonate(u);
                }}
                style={{ color: "var(--blue-500)", fontWeight: 600 }}
              >
                <LogIn width={16} height={16} />
                {impersonating === rowMenu.menuItem.id ? "Memuat..." : "Login As"}
              </button>
            </motion.div>
          )}

          <motion.div variants={itemVariants}>
            <button
              type="button"
              className={`row-menu-item ${rowMenu.menuItem.isActive ? "row-menu-item-danger" : ""}`}
              style={!rowMenu.menuItem.isActive ? { color: "var(--green-500)", fontWeight: 600 } : undefined}
              onClick={() => {
                const u = rowMenu.menuItem!;
                rowMenu.close();
                handleToggleActive(u);
              }}
            >
              {rowMenu.menuItem.isActive ? (
                <>
                  <Trash2 width={16} height={16} />
                  Delete
                </>
              ) : (
                <>
                  <UserCheck width={16} height={16} />
                  Aktifkan
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}

      <ModalOverlay open={!!detailUser} onClose={() => setDetailUser(null)} className={`modal-overlay modal-overlay-centered ${detailUser ? "" : "hidden"}`}>
        <div className="modal" style={{ maxWidth: 520 }}>
          <div className="modal-header">
            <h3>Detail Akun</h3>
            <button type="button" className="modal-close" onClick={() => setDetailUser(null)}>&times;</button>
          </div>
          {detailUser && (
            <div style={{ padding: "0 4px" }}>
              <div className="detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Username</span>
                  <span className="detail-value">{detailUser.username}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Nama</span>
                  <span className="detail-value">{detailUser.nama}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Role</span>
                  <span className="detail-value">{ROLE_LABEL[detailUser.role] || detailUser.role}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <div className="detail-value" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span className={`badge ${detailUser.isActive ? "badge-approved" : "badge-rejected"}`}>
                      {detailUser.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                    {detailUser.mustChangePassword && (
                      <span className="badge badge-pending">
                        Belum Ganti Password
                      </span>
                    )}
                  </div>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Direktorat</span>
                  <span className="detail-value">{detailUser.direktorat || "-"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Divisi</span>
                  <span className="detail-value">{detailUser.divisi || "-"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Departemen</span>
                  <span className="detail-value">{detailUser.departemen || "-"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Dibuat</span>
                  <span className="detail-value">
                    {!detailUser.createdAt || detailUser.createdAt.startsWith("0001")
                      ? "-"
                      : formatDateTime(detailUser.createdAt)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{detailUser.email || "-"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">No. HP</span>
                  <span className="detail-value">{detailUser.noHp || "-"}</span>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setDetailUser(null)}>
                  Tutup
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: "auto" }}
                  onClick={() => {
                    const u = detailUser;
                    setDetailUser(null);
                    openEdit(u);
                  }}
                >
                  Edit Akun
                </button>
              </div>
            </div>
          )}
        </div>
      </ModalOverlay>

      <ModalOverlay open={!!formOpen} onClose={() => setFormOpen(null)} className={`modal-overlay modal-overlay-centered ${formOpen ? "" : "hidden"}`}>
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <h3>{formOpen === "create" ? "Tambah Akun" : "Edit Akun"}</h3>
            <button type="button" className="modal-close" onClick={() => setFormOpen(null)}>&times;</button>
          </div>

          <div className={`alert-error ${formError ? "alert-error-visible" : ""}`}>
            <div className="alert-error-text"><strong>Error</strong><span>{formError}</span></div>
          </div>

          <form onSubmit={handleFormSubmit}>
            {formOpen === "create" && (
              <div className="field">
                <label htmlFor="user-form-username">Username</label>
                <input id="user-form-username" type="text" required value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              </div>
            )}
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-nama">Nama</label>
              <input id="user-form-nama" type="text" required value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-role">Role</label>
              <SearchableSelect
                id="user-form-role"
                value={form.role}
                onChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
                options={ROLE_OPTIONS}
                getLabel={(v) => ROLE_LABEL[v as Role] || v}
                placeholder="Pilih Role"
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-direktorat">Direktorat</label>
              <SearchableSelect
                id="user-form-direktorat"
                value={form.direktorat}
                onChange={(v) => setForm((f) => ({ ...f, direktorat: v, divisi: "", departemen: "" }))}
                options={orgStructure?.direktorat || []}
                clearLabel="Tidak Terkait Direktorat"
                placeholder="Pilih Direktorat"
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-divisi">Divisi</label>
              <SearchableSelect
                id="user-form-divisi"
                value={form.divisi}
                onChange={(v) => setForm((f) => ({ ...f, divisi: v, departemen: "" }))}
                options={divisiOptions}
                clearLabel="Tidak Terkait Divisi"
                placeholder="Pilih Divisi"
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-departemen">Departemen</label>
              <SearchableSelect
                id="user-form-departemen"
                value={form.departemen}
                onChange={(v) => setForm((f) => ({ ...f, departemen: v }))}
                options={departemenOptions}
                clearLabel="Kebutuhan Divisi ini (tanpa Departemen spesifik)"
                placeholder="Pilih Departemen"
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-email">Email</label>
              <input id="user-form-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-nohp">No. HP</label>
              <input id="user-form-nohp" type="text" value={form.noHp} onChange={(e) => setForm((f) => ({ ...f, noHp: e.target.value }))} />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setFormOpen(null)} disabled={saving}>Batal</button>
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={saving}>
                {saving ? "Menyimpan..." : formOpen === "create" ? "Buat Akun" : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      <CredentialsRevealModal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title={credentials?.title || ""}
        accounts={credentials?.accounts || []}
      />

      <ModalOverlay open={logOpen} onClose={() => setLogOpen(false)} className={`modal-overlay modal-overlay-centered ${logOpen ? "" : "hidden"}`}>
        <div className="modal" style={{ maxWidth: 640 }}>
          <div className="modal-header">
            <h3>Riwayat Login As</h3>
            <button type="button" className="modal-close" onClick={() => setLogOpen(false)}>&times;</button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Super Admin</th><th>Login As</th><th>Mulai</th><th>Selesai</th></tr>
              </thead>
              <tbody>
                {logBusy ? (
                  <tr><td colSpan={4} className="table-empty">Memuat data...</td></tr>
                ) : logItems.length === 0 ? (
                  <tr><td colSpan={4} className="table-empty">Belum ada riwayat</td></tr>
                ) : (
                  logItems.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.superAdminNama}</td>
                      <td>{entry.targetNama} ({ROLE_LABEL[entry.targetRole] || entry.targetRole})</td>
                      <td>{formatDateTime(entry.startedAt)}</td>
                      <td>{entry.endedAt ? formatDateTime(entry.endedAt) : "Masih berlangsung"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <div className="pagination-left" />
            <div className="pagination-right">
              <span className="text-secondary">Total {logTotal} sesi · Halaman {logPage} dari {Math.max(1, Math.ceil(logTotal / 20))}</span>
              <div className="pages">
                <button className="page-btn" disabled={logPage <= 1} onClick={() => loadImpersonationLog(logPage - 1)}>‹</button>
                <button className="page-btn" disabled={logPage >= Math.ceil(logTotal / 20)} onClick={() => loadImpersonationLog(logPage + 1)}>›</button>
              </div>
            </div>
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
