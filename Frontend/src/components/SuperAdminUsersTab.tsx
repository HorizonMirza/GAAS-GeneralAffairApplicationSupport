"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ROLE_LABEL } from "@/lib/constants";
import type { AdminUserListItem, OrgStructure, Role } from "@/lib/types";
import SearchableSelect from "@/components/SearchableSelect";
import ModalOverlay from "@/components/ModalOverlay";
import PasswordField from "@/components/PasswordField";
import CredentialsRevealModal, { type RevealedCredential } from "@/components/CredentialsRevealModal";
import {
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

const PASSWORD_REQUIREMENTS = [
  { regex: /[0-9]/, text: "Minimal 1 angka" },
  { regex: /.{8,}/, text: "Minimal 8 karakter" },
  { regex: /[a-z]/, text: "Minimal 1 huruf kecil" },
  { regex: /[A-Z]/, text: "Minimal 1 huruf besar" },
  { regex: /[^A-Za-z0-9]/, text: "Minimal 1 karakter spesial" },
] as const;

interface AdminPasswordFormState {
  newPassword: string;
  confirmPassword: string;
  currentPassword: string;
  mustChangePassword: boolean;
}

const EMPTY_PASSWORD_FORM: AdminPasswordFormState = {
  newPassword: "",
  confirmPassword: "",
  currentPassword: "",
  mustChangePassword: true,
};

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

  const [activeSuperAdminCount, setActiveSuperAdminCount] = useState(1);
  const [formOpen, setFormOpen] = useState<"create" | AdminUserListItem | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [credentials, setCredentials] = useState<{ title: string; accounts: RevealedCredential[] } | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminUserListItem | null>(null);
  const [passwordForm, setPasswordForm] = useState<AdminPasswordFormState>(EMPTY_PASSWORD_FORM);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [impersonating, setImpersonating] = useState<number | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [data, saData] = await Promise.all([
        api.listAdminUsers(filters),
        api.listAdminUsers({ role: "SUPER_ADMIN", isActive: true, limit: 10 }),
      ]);
      setItems(data.items);
      setTotal(data.total);
      setActiveSuperAdminCount(saData.total);
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
  }, [load, orgStructure]);

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
    if (formOpen === "create" && !form.username.trim()) { setFormError("Username wajib diisi"); return; }
    if (!form.nama.trim()) { setFormError("Nama akun wajib diisi"); return; }
    if (!form.role) { setFormError("Role wajib dipilih"); return; }

    const isDeptRole = form.role === "ADMIN_DEPARTEMEN" || form.role === "APPROVAL_DEPARTEMEN";
    const isDivisiRole = form.role === "ADMIN_DIVISI" || form.role === "APPROVAL_DIVISI";

    if (isDeptRole || isDivisiRole) {
      if (!form.direktorat) { setFormError("Direktorat wajib dipilih"); return; }
      if (!form.divisi) { setFormError("Divisi wajib dipilih"); return; }
      if (isDeptRole && !form.departemen) { setFormError("Departemen wajib dipilih"); return; }
    }

    if (!form.email.trim()) { setFormError("Email wajib diisi"); return; }
    if (!form.noHp.trim()) { setFormError("No. HP wajib diisi"); return; }

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

  function openChangePassword(user: AdminUserListItem) {
    setPasswordTarget(user);
    setPasswordForm({
      ...EMPTY_PASSWORD_FORM,
      mustChangePassword: user.id !== me?.id,
    });
    setPasswordError("");
  }

  function closeChangePassword() {
    if (passwordSaving) return;
    setPasswordTarget(null);
    setPasswordForm(EMPTY_PASSWORD_FORM);
    setPasswordError("");
  }

  async function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordTarget) return;

    setPasswordError("");
    if (!PASSWORD_REQUIREMENTS.every((requirement) => requirement.regex.test(passwordForm.newPassword))) {
      setPasswordError("Password baru belum memenuhi seluruh persyaratan");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak cocok");
      return;
    }
    if (!passwordForm.currentPassword) {
      setPasswordError("Password Super Admin wajib diisi untuk konfirmasi");
      return;
    }

    const target = passwordTarget;
    const changingOwnPassword = target.id === me?.id;
    setPasswordSaving(true);
    try {
      await api.changeAdminUserPassword(target.id, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        mustChangePassword: changingOwnPassword ? false : passwordForm.mustChangePassword,
      });
      setPasswordTarget(null);
      setPasswordForm(EMPTY_PASSWORD_FORM);
      showToast(`Password akun ${target.nama} berhasil diubah`);
      if (changingOwnPassword) await refresh();
      await load();
    } catch (err) {
      setPasswordError(errorMessage(err));
    } finally {
      setPasswordSaving(false);
    }
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

  async function handleToggleActive(user: AdminUserListItem) {
    if (user.isActive && user.role === "SUPER_ADMIN") {
      try {
        const saData = await api.listAdminUsers({ role: "SUPER_ADMIN", isActive: true, limit: 10 });
        setActiveSuperAdminCount(saData.total);
        if (saData.total <= 1) {
          showToast("Akun Super Admin tidak bisa dihapus jika akun Super Admin cuma 1", "error");
          return;
        }
      } catch {
        if (activeSuperAdminCount <= 1) {
          showToast("Akun Super Admin tidak bisa dihapus jika akun Super Admin cuma 1", "error");
          return;
        }
      }
    }
    const actionText = user.isActive ? "menghapus" : "mengaktifkan";
    confirm(`Yakin ingin ${actionText} akun "${user.nama}" (${user.username})?`, async () => {
      try {
        if (user.isActive) await api.deactivateAdminUser(user.id);
        else await api.activateAdminUser(user.id);
        showToast(`Akun berhasil ${user.isActive ? "dihapus" : "diaktifkan"}`);
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
              <span className="searchable-select-placeholder">Semua Filter</span>
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
                          rowMenu.toggle(e, user.id, 280);
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
                openChangePassword(u);
              }}
            >
              <KeyRound width={16} height={16} />
              Ganti Password
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
              Reset Password Acak
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
              title={
                rowMenu.menuItem.isActive && rowMenu.menuItem.role === "SUPER_ADMIN" && activeSuperAdminCount <= 1
                  ? "Akun Super Admin tidak bisa dihapus jika akun Super Admin cuma 1"
                  : undefined
              }
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


      <ModalOverlay
        open={!!passwordTarget}
        onClose={closeChangePassword}
        className={`modal-overlay modal-overlay-centered ${passwordTarget ? "" : "hidden"}`}
      >
        <div className="modal" style={{ maxWidth: 520 }}>
          <div className="modal-header">
            <div>
              <h3>Ganti Password</h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Atur password baru untuk akun yang dipilih
              </p>
            </div>
            <button type="button" className="modal-close" onClick={closeChangePassword} disabled={passwordSaving}>&times;</button>
          </div>

          {passwordTarget && (
            <form onSubmit={handleChangePasswordSubmit}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 14px",
                  marginBottom: 18,
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  background: "var(--bg-surface-alt)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {passwordTarget.nama}
                  </div>
                  <div style={{ marginTop: 2, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {passwordTarget.username}
                  </div>
                </div>
                <span className="badge badge-approved" style={{ flexShrink: 0 }}>
                  {ROLE_LABEL[passwordTarget.role] || passwordTarget.role}
                </span>
              </div>

              <div className={`alert-error ${passwordError ? "alert-error-visible" : ""}`} role="alert" aria-live="polite">
                <div className="alert-error-text"><strong>Error</strong><span>{passwordError}</span></div>
              </div>

              <PasswordField
                id="admin-user-new-password"
                label="Password Baru"
                placeholder="Masukkan password baru"
                minLength={8}
                value={passwordForm.newPassword}
                onChange={(value) => {
                  setPasswordForm((current) => ({ ...current, newPassword: value }));
                  setPasswordError("");
                }}
              />

              <ul className="password-requirement-list" aria-label="Syarat password" style={{ marginTop: 8 }}>
                {PASSWORD_REQUIREMENTS.map((requirement) => {
                  const met = requirement.regex.test(passwordForm.newPassword);
                  return (
                    <li key={requirement.text} className={`password-requirement-item${met ? " met" : ""}`}>
                      {met ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      )}
                      <span>{requirement.text}</span>
                    </li>
                  );
                })}
              </ul>

              <div style={{ marginTop: 16 }}>
                <PasswordField
                  id="admin-user-confirm-password"
                  label="Konfirmasi Password Baru"
                  placeholder="Ulangi password baru"
                  minLength={8}
                  value={passwordForm.confirmPassword}
                  onChange={(value) => {
                    setPasswordForm((current) => ({ ...current, confirmPassword: value }));
                    setPasswordError("");
                  }}
                />
              </div>

              {passwordTarget.id !== me?.id ? (
                <div className="field" style={{ marginTop: 16 }}>
                  <label htmlFor="admin-user-must-change-password">Pengaturan Login</label>
                  <button
                    id="admin-user-must-change-password"
                    type="button"
                    className={`field-toggle${passwordForm.mustChangePassword ? " field-toggle-active" : ""}`}
                    aria-pressed={passwordForm.mustChangePassword}
                    onClick={() => setPasswordForm((current) => ({ ...current, mustChangePassword: !current.mustChangePassword }))}
                  >
                    <span className="field-toggle-box">
                      {passwordForm.mustChangePassword && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </span>
                    Wajib ganti password saat login berikutnya
                  </button>
                  <div className="field-hint-text">Semua sesi akun tersebut akan langsung dihentikan.</div>
                </div>
              ) : (
                <div className="field-hint-text" style={{ marginTop: 16 }}>
                  Anda sedang mengganti password akun sendiri. Sesi ini akan diperbarui secara otomatis.
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <PasswordField
                  id="admin-user-current-password"
                  label="Password Super Admin"
                  placeholder="Masukkan password Anda"
                  value={passwordForm.currentPassword}
                  onChange={(value) => {
                    setPasswordForm((current) => ({ ...current, currentPassword: value }));
                    setPasswordError("");
                  }}
                  hint="Diperlukan untuk memverifikasi tindakan sensitif ini."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={closeChangePassword} disabled={passwordSaving}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={passwordSaving}>
                  {passwordSaving ? "Menyimpan..." : "Ganti Password"}
                </button>
              </div>
            </form>
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

          <form onSubmit={handleFormSubmit} className="user-form-modal">
            {formOpen === "create" && (
              <div className="field field-select-blue">
                <label htmlFor="user-form-username">Username</label>
                <input id="user-form-username" type="text" required value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              </div>
            )}
            <div className="field field-select-blue" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-nama">Nama</label>
              <input id="user-form-nama" type="text" required value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
            </div>
            <div className="field field-select-blue" style={{ marginTop: 12 }}>
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
            <div className="field field-select-blue" style={{ marginTop: 12 }}>
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
            <div className="field field-select-blue" style={{ marginTop: 12 }}>
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
            <div className="field field-select-blue" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-departemen">Departemen</label>
              <SearchableSelect
                id="user-form-departemen"
                value={form.departemen}
                onChange={(v) => setForm((f) => ({ ...f, departemen: v }))}
                options={departemenOptions}
                clearLabel="Tanpa Departmen"
                placeholder="Pilih Departemen"
              />
            </div>
            <div className="field field-select-blue" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-email">Email</label>
              <input id="user-form-email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="field field-select-blue" style={{ marginTop: 12 }}>
              <label htmlFor="user-form-nohp">No. HP</label>
              <input id="user-form-nohp" type="text" required value={form.noHp} onChange={(e) => setForm((f) => ({ ...f, noHp: e.target.value }))} />
            </div>

            <div className="modal-actions">
              <button
                type="submit"
                className="btn btn-confirm-approve"
                style={{ width: "auto" }}
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "Save"}
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
    </>
  );
}
