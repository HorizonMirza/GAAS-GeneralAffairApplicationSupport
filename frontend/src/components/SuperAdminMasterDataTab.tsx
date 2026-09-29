"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import ModalOverlay from "@/components/ModalOverlay";
import PasswordField from "@/components/PasswordField";
import DeleteWithPasswordModal from "@/components/DeleteWithPasswordModal";
import type { MasterDataCategory, MasterDataItem } from "@/lib/types";

interface FormState {
  label: string;
  extra: string;
  password: string;
}

interface FormErrors {
  label?: string;
  password?: string;
  general?: string;
}

const EMPTY_FORM: FormState = { label: "", extra: "", password: "" };

function routeApiError(message: string): FormErrors {
  if (/nama ini sudah ada|nama wajib/i.test(message)) return { label: message };
  if (/password/i.test(message)) return { password: message };
  return { general: message };
}

// One reusable CRUD editor for every Master Data category (Kategori Kerusakan, Kategori Arsip,
// Kategori ATK, Nama Barang ATK, Tipe Booking, Asuransi, Pengemasan Tambahan, Tahun Arsip) - same
// list+modal-form shape as SuperAdminVehicleTab/SuperAdminMeetingRoomTab, just parameterized by
// category since every one of these is otherwise identical: a Super Admin-managed list of
// {label, extra?} rows read by every dropdown built on top of api.listMasterData.
export default function SuperAdminMasterDataTab({
  category,
  itemLabel,
  hasExtra,
  extraLabel,
}: {
  category: MasterDataCategory;
  itemLabel: string;
  hasExtra?: boolean;
  extraLabel?: string;
}) {
  const { showToast } = useToast();

  const [items, setItems] = useState<MasterDataItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState<"create" | MasterDataItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MasterDataItem | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.listMasterData(category);
      setItems(data.items);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setBusy(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  function errorMessage(err: unknown): string {
    return err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Terjadi kesalahan";
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormOpen("create");
  }

  function openEdit(item: MasterDataItem) {
    setForm({ label: item.label, extra: item.extra ?? "", password: "" });
    setFormErrors({});
    setFormOpen(item);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: FormErrors = {};
    if (!form.label.trim()) errs.label = "Nama wajib diisi";
    if (!form.password) errs.password = "Password wajib diisi";
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setFormErrors({});

    setSaving(true);
    try {
      if (formOpen === "create") {
        await api.createMasterData({ category, label: form.label.trim(), extra: hasExtra ? form.extra.trim() : undefined, password: form.password });
        showToast(`${itemLabel} berhasil ditambahkan`);
      } else if (formOpen) {
        await api.updateMasterData(formOpen.id, { label: form.label.trim(), extra: hasExtra ? form.extra.trim() : undefined, password: form.password });
        showToast(`${itemLabel} berhasil diperbarui`);
      }
      setFormOpen(null);
      await load();
    } catch (err) {
      setFormErrors(routeApiError(errorMessage(err)));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm(password: string) {
    if (!deleteTarget) return;
    await api.deleteMasterData(deleteTarget.id, password);
    showToast(`${itemLabel} berhasil dihapus`);
    setDeleteTarget(null);
    await load();
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>{itemLabel}</h3>
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openCreate}>
          <Plus width={16} height={16} /> Tambah {itemLabel}
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>Nama</th>{hasExtra && <th>{extraLabel}</th>}<th></th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={hasExtra ? 4 : 3} className="table-empty">Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={hasExtra ? 4 : 3} className="table-empty">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={hasExtra ? 4 : 3} className="table-empty">Tidak Ada Data</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.label}</td>
                  {hasExtra && <td>{item.extra || "-"}</td>}
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button type="button" className="card-icon-btn" aria-label="Edit" title="Edit" onClick={() => openEdit(item)}>
                      <Pencil width={16} height={16} />
                    </button>
                    <button type="button" className="card-icon-btn card-icon-btn-danger" aria-label="Hapus" title="Hapus" onClick={() => setDeleteTarget(item)}>
                      <Trash2 width={16} height={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalOverlay open={!!formOpen} onClose={() => setFormOpen(null)} className={`modal-overlay modal-overlay-centered ${formOpen ? "" : "hidden"}`}>
        <div className="modal" style={{ maxWidth: 460 }}>
          <div className="modal-header">
            <h3>{formOpen === "create" ? `Tambah ${itemLabel}` : `Edit ${itemLabel}`}</h3>
            <button type="button" className="modal-close" onClick={() => setFormOpen(null)}>&times;</button>
          </div>

          <div className={`alert-error ${formErrors.general ? "alert-error-visible" : ""}`}>
            <div className="alert-error-text"><strong>Error</strong><span>{formErrors.general}</span></div>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="master-data-form-label">Nama</label>
                <input id="master-data-form-label" type="text" required value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
                {formErrors.label && <div className="field-error-text">{formErrors.label}</div>}
              </div>
              {hasExtra && (
                <div className="field full">
                  <label htmlFor="master-data-form-extra">{extraLabel}</label>
                  <input id="master-data-form-extra" type="text" placeholder="Contoh: pcs, rim, box" value={form.extra} onChange={(e) => setForm((f) => ({ ...f, extra: e.target.value }))} />
                </div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <PasswordField
                id="master-data-form-password"
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
        title={`Hapus ${itemLabel}`}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="delete-master-data-label">Nama</label>
              <input id="delete-master-data-label" type="text" value={deleteTarget.label} disabled readOnly />
            </div>
            {hasExtra && (
              <div className="field full">
                <label htmlFor="delete-master-data-extra">{extraLabel}</label>
                <input id="delete-master-data-extra" type="text" value={deleteTarget.extra ?? ""} disabled readOnly />
              </div>
            )}
          </div>
        )}
      </DeleteWithPasswordModal>
    </div>
  );
}
