"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import ModalOverlay from "@/components/ModalOverlay";
import PasswordField from "@/components/PasswordField";
import DeleteWithPasswordModal from "@/components/DeleteWithPasswordModal";
import type { VehicleItem } from "@/lib/types";

interface VehicleFormState {
  nama: string;
  platNomor: string;
  kapasitas: string;
  supir: string;
  merek: string;
  model: string;
  tahun: string;
  warna: string;
  nomorTeleponSupir: string;
  password: string;
}

interface VehicleFormErrors {
  nama?: string;
  platNomor?: string;
  kapasitas?: string;
  supir?: string;
  merek?: string;
  model?: string;
  tahun?: string;
  warna?: string;
  nomorTeleponSupir?: string;
  password?: string;
  general?: string;
}

const EMPTY_FORM: VehicleFormState = {
  nama: "", platNomor: "", kapasitas: "", supir: "", merek: "", model: "", tahun: "", warna: "", nomorTeleponSupir: "", password: "",
};

function toFormFields(item: VehicleItem): VehicleFormState {
  return {
    nama: item.nama,
    platNomor: item.platNomor,
    kapasitas: String(item.kapasitas),
    supir: item.supir,
    merek: item.merek,
    model: item.model,
    tahun: String(item.tahun),
    warna: item.warna,
    nomorTeleponSupir: item.nomorTeleponSupir,
    password: "",
  };
}

// Routes a flat backend `detail` string to the field it's actually about, so it renders right
// under that field instead of one generic banner - same idea for every Create/Update error here.
function routeApiError(message: string): VehicleFormErrors {
  if (/nama kendaraan/i.test(message)) return { nama: message };
  if (/plat nomor/i.test(message)) return { platNomor: message };
  if (/kapasitas/i.test(message)) return { kapasitas: message };
  if (/merek/i.test(message)) return { merek: message };
  if (/model/i.test(message)) return { model: message };
  if (/tahun/i.test(message)) return { tahun: message };
  if (/warna/i.test(message)) return { warna: message };
  if (/telepon/i.test(message)) return { nomorTeleponSupir: message };
  if (/pengemudi/i.test(message)) return { supir: message };
  if (/password/i.test(message)) return { password: message };
  return { general: message };
}

// Super Admin's vehicle fleet editor - the UI for VehicleAdminController, replacing the hardcoded
// 10-vehicle list Services/Vehicles.cs used to carry (see its own SeedData/LoadFromDb). Same
// list+modal-form shape as SuperAdminUsersTab, without pagination - the fleet is small.
export default function SuperAdminVehicleTab({ hideTitle }: { hideTitle?: boolean } = {}) {
  const { showToast } = useToast();

  const [items, setItems] = useState<VehicleItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState<"create" | VehicleItem | null>(null);
  const [form, setForm] = useState<VehicleFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<VehicleFormErrors>({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<VehicleItem | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.listAdminVehicles();
      setItems(data.vehicles);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Gagal memuat daftar kendaraan");
    } finally {
      setBusy(false);
    }
  }, []);

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

  function openEdit(item: VehicleItem) {
    setForm(toFormFields(item));
    setFormErrors({});
    setFormOpen(item);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: VehicleFormErrors = {};
    if (!form.nama.trim()) errs.nama = "Nama kendaraan wajib diisi";
    if (!form.platNomor.trim()) errs.platNomor = "Plat nomor wajib diisi";
    const kapasitas = Number(form.kapasitas);
    if (!Number.isInteger(kapasitas) || kapasitas <= 0) errs.kapasitas = "Kapasitas harus bilangan bulat lebih dari 0";
    if (!form.supir.trim()) errs.supir = "Nama pengemudi wajib diisi";
    if (!form.merek.trim()) errs.merek = "Merek wajib diisi";
    if (!form.model.trim()) errs.model = "Model wajib diisi";
    const tahun = Number(form.tahun);
    if (!Number.isInteger(tahun) || tahun < 1900 || tahun > 2100) errs.tahun = "Tahun tidak valid";
    if (!form.warna.trim()) errs.warna = "Warna wajib diisi";
    if (!form.nomorTeleponSupir.trim()) errs.nomorTeleponSupir = "No. telepon pengemudi wajib diisi";
    if (!form.password) errs.password = "Password wajib diisi";
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setFormErrors({});

    const payload = {
      nama: form.nama.trim(),
      platNomor: form.platNomor.trim(),
      kapasitas,
      supir: form.supir.trim(),
      merek: form.merek.trim(),
      model: form.model.trim(),
      tahun,
      warna: form.warna.trim(),
      nomorTeleponSupir: form.nomorTeleponSupir.trim(),
      password: form.password,
    };

    setSaving(true);
    try {
      if (formOpen === "create") {
        await api.createAdminVehicle(payload);
        showToast("Kendaraan berhasil ditambahkan");
      } else if (formOpen) {
        await api.updateAdminVehicle(formOpen.id, payload);
        showToast("Kendaraan berhasil diperbarui");
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
    await api.deleteAdminVehicle(deleteTarget.id, password);
    showToast("Kendaraan berhasil dihapus");
    setDeleteTarget(null);
    await load();
  }

  return (
    <div className="card">
      <div className="card-header" style={hideTitle ? { justifyContent: "flex-end" } : undefined}>
        {!hideTitle && <h3>Kendaraan</h3>}
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openCreate}>
          <Plus width={16} height={16} /> Tambah Kendaraan
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>Nama</th><th>Merek</th><th>Model</th><th>Warna</th><th>Tahun</th><th>Kapasitas</th><th>Plat Nomor</th><th>Pengemudi</th><th>No. Telepon Pengemudi</th><th></th>
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
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.nama}</td>
                  <td>{item.merek}</td>
                  <td>{item.model || "-"}</td>
                  <td>{item.warna}</td>
                  <td>{item.tahun}</td>
                  <td>{item.kapasitas}</td>
                  <td>{item.platNomor}</td>
                  <td>{item.supir}</td>
                  <td>{item.nomorTeleponSupir}</td>
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
        <div className="modal" style={{ maxWidth: 520 }}>
          <div className="modal-header">
            <h3>{formOpen === "create" ? "Tambah Kendaraan" : "Edit Kendaraan"}</h3>
            <button type="button" className="modal-close" onClick={() => setFormOpen(null)}>&times;</button>
          </div>

          <div className={`alert-error ${formErrors.general ? "alert-error-visible" : ""}`}>
            <div className="alert-error-text"><strong>Error</strong><span>{formErrors.general}</span></div>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="vehicle-form-nama">Nama Kendaraan</label>
                <input id="vehicle-form-nama" type="text" required value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
                {formErrors.nama && <div className="field-error-text">{formErrors.nama}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-merek">Merek</label>
                <input id="vehicle-form-merek" type="text" required value={form.merek} onChange={(e) => setForm((f) => ({ ...f, merek: e.target.value }))} />
                {formErrors.merek && <div className="field-error-text">{formErrors.merek}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-model">Model</label>
                <input id="vehicle-form-model" type="text" required value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                {formErrors.model && <div className="field-error-text">{formErrors.model}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-warna">Warna</label>
                <input id="vehicle-form-warna" type="text" required value={form.warna} onChange={(e) => setForm((f) => ({ ...f, warna: e.target.value }))} />
                {formErrors.warna && <div className="field-error-text">{formErrors.warna}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-tahun">Tahun</label>
                <input id="vehicle-form-tahun" type="number" min={1900} max={2100} required value={form.tahun} onChange={(e) => setForm((f) => ({ ...f, tahun: e.target.value }))} />
                {formErrors.tahun && <div className="field-error-text">{formErrors.tahun}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-kapasitas">Kapasitas</label>
                <input id="vehicle-form-kapasitas" type="number" min={1} required value={form.kapasitas} onChange={(e) => setForm((f) => ({ ...f, kapasitas: e.target.value }))} />
                {formErrors.kapasitas && <div className="field-error-text">{formErrors.kapasitas}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-plat">Plat Nomor</label>
                <input id="vehicle-form-plat" type="text" required value={form.platNomor} onChange={(e) => setForm((f) => ({ ...f, platNomor: e.target.value }))} />
                {formErrors.platNomor && <div className="field-error-text">{formErrors.platNomor}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-supir">Nama Pengemudi</label>
                <input id="vehicle-form-supir" type="text" required value={form.supir} onChange={(e) => setForm((f) => ({ ...f, supir: e.target.value }))} />
                {formErrors.supir && <div className="field-error-text">{formErrors.supir}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-notelp">No. Telepon Pengemudi</label>
                <input id="vehicle-form-notelp" type="text" required value={form.nomorTeleponSupir} onChange={(e) => setForm((f) => ({ ...f, nomorTeleponSupir: e.target.value }))} />
                {formErrors.nomorTeleponSupir && <div className="field-error-text">{formErrors.nomorTeleponSupir}</div>}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <PasswordField
                id="vehicle-form-password"
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
        title="Hapus Kendaraan"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="delete-vehicle-nama">Nama Kendaraan</label>
              <input id="delete-vehicle-nama" type="text" value={deleteTarget.nama} disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="delete-vehicle-merek">Merek</label>
              <input id="delete-vehicle-merek" type="text" value={deleteTarget.merek} disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="delete-vehicle-model">Model</label>
              <input id="delete-vehicle-model" type="text" value={deleteTarget.model} disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="delete-vehicle-warna">Warna</label>
              <input id="delete-vehicle-warna" type="text" value={deleteTarget.warna} disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="delete-vehicle-tahun">Tahun</label>
              <input id="delete-vehicle-tahun" type="text" value={String(deleteTarget.tahun)} disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="delete-vehicle-kapasitas">Kapasitas</label>
              <input id="delete-vehicle-kapasitas" type="text" value={String(deleteTarget.kapasitas)} disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="delete-vehicle-plat">Plat Nomor</label>
              <input id="delete-vehicle-plat" type="text" value={deleteTarget.platNomor} disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="delete-vehicle-supir">Nama Pengemudi</label>
              <input id="delete-vehicle-supir" type="text" value={deleteTarget.supir} disabled readOnly />
            </div>
            <div className="field">
              <label htmlFor="delete-vehicle-notelp">No. Telepon Pengemudi</label>
              <input id="delete-vehicle-notelp" type="text" value={deleteTarget.nomorTeleponSupir} disabled readOnly />
            </div>
          </div>
        )}
      </DeleteWithPasswordModal>
    </div>
  );
}
