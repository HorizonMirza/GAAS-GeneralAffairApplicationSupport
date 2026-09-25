"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ROLE_LABEL } from "@/lib/constants";
import type { AdminUserListItem, OrgStructure, Role } from "@/lib/types";
import SearchableSelect from "@/components/SearchableSelect";
import ModalOverlay from "@/components/ModalOverlay";
import CredentialsRevealModal, { type RevealedCredential } from "@/components/CredentialsRevealModal";
import { formatDateTime } from "@/lib/format";
import { UserPlus } from "lucide-react";

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

const EMPTY_FILTERS: FilterState = { page: 1, limit: 20, role: "", divisi: "", departemen: "", search: "", isActive: "" };

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

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState<"create" | AdminUserListItem | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [credentials, setCredentials] = useState<{ title: string; accounts: RevealedCredential[] } | null>(null);

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

  const directoratNode = orgStructure?.direktoratTree.find((d) => d.nama === form.direktorat) || null;
  const divisiOptions = directoratNode ? directoratNode.divisi.map((v) => v.nama) : orgStructure?.divisi || [];
  const divisiNode = form.divisi
    ? (directoratNode?.divisi || orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === form.divisi)
    : null;
  const departemenOptions = divisiNode ? divisiNode.departemen : orgStructure?.departemen || [];

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

  function handleToggleActive(user: AdminUserListItem) {
    const action = user.isActive ? "menonaktifkan" : "mengaktifkan";
    confirm(`Yakin ingin ${action} akun "${user.nama}" (${user.username})?`, async () => {
      try {
        if (user.isActive) await api.deactivateAdminUser(user.id);
        else await api.activateAdminUser(user.id);
        showToast(`Akun berhasil ${user.isActive ? "dinonaktifkan" : "diaktifkan"}`);
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      }
    }, user.isActive ? "Nonaktifkan" : "Aktifkan");
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Manajemen Akun</h3>
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openCreate}>
          <UserPlus width={16} height={16} /> Tambah Akun
        </button>
      </div>

      <div className="toolbar transactions-page-toolbar">
        <div className="field">
          <label htmlFor="users-search">Cari</label>
          <input id="users-search" type="text" placeholder="Username atau nama" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <div className="field">
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
        <div className="field">
          <label htmlFor="users-divisi">Divisi</label>
          <SearchableSelect
            id="users-divisi"
            value={filters.divisi}
            onChange={(v) => setFilters((prev) => ({ ...prev, divisi: v, page: 1 }))}
            options={orgStructure?.divisi || []}
            clearLabel="Semua Divisi"
            placeholder="Semua Divisi"
          />
        </div>
        <div className="field">
          <label htmlFor="users-departemen">Departemen</label>
          <SearchableSelect
            id="users-departemen"
            value={filters.departemen}
            onChange={(v) => setFilters((prev) => ({ ...prev, departemen: v, page: 1 }))}
            options={orgStructure?.departemen || []}
            clearLabel="Semua Departemen"
            placeholder="Semua Departemen"
          />
        </div>
        <div className="field">
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
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "auto", alignSelf: "flex-end" }}
          onClick={() => { setFilters(EMPTY_FILTERS); setSearchInput(""); }}
        >
          Hapus Filter
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th><th>Nama</th><th>Role</th><th>Divisi / Departemen</th><th>Email</th><th>No. HP</th><th>Status</th><th>Dibuat</th><th></th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={9} className="table-empty">Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={9} className="table-empty">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="table-empty">Tidak Ada Data</td></tr>
            ) : (
              items.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.nama}</td>
                  <td>{ROLE_LABEL[user.role] || user.role}</td>
                  <td>{user.departemen || user.divisi || "-"}</td>
                  <td>{user.email || "-"}</td>
                  <td>{user.noHp || "-"}</td>
                  <td>
                    <span className={`badge ${user.isActive ? "badge-approved" : "badge-rejected"}`}>
                      {user.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                    {user.mustChangePassword && (
                      <span className="badge badge-pending" style={{ marginLeft: 4 }} title="Belum mengganti password sementara">
                        Belum Ganti Password
                      </span>
                    )}
                  </td>
                  <td>{formatDateTime(user.createdAt)}</td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-secondary" style={{ width: "auto", padding: "3px 8px" }} onClick={() => openEdit(user)}>Edit</button>
                    <button type="button" className="btn btn-secondary" style={{ width: "auto", padding: "3px 8px" }} onClick={() => handleResetPassword(user)}>Reset Password</button>
                    <button
                      type="button"
                      className={user.isActive ? "btn btn-confirm-danger" : "btn btn-confirm-approve"}
                      style={{ width: "auto", padding: "3px 8px" }}
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.isActive ? "Nonaktifkan" : "Aktifkan"}
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
              getLabel={(v) => `${v} akun`}
              placeholder={`${filters.limit} akun`}
            />
          </div>
        </div>
        <div className="pagination-right">
          <span className="text-secondary">Total {total} Akun · Halaman {filters.page} dari {totalPages}</span>
          <div className="pages">
            <button className="page-btn" disabled={filters.page <= 1} onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}>‹</button>
            <button className="page-btn" disabled={filters.page >= totalPages} onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}>›</button>
          </div>
        </div>
      </div>

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
    </div>
  );
}
