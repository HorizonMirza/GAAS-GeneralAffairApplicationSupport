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
  lokasiParkir: string;
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
  lokasiParkir?: string;
  password?: string;
  general?: string;
}

const EMPTY_FORM: VehicleFormState = {
  nama: "", platNomor: "", kapasitas: "", supir: "", merek: "", model: "", tahun: "", warna: "", nomorTeleponSupir: "", lokasiParkir: "", password: "",
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
    lokasiParkir: item.lokasiParkir,
    password: "",
  };
}

// Routes a flat backend `detail` string to the field it's actually about, so it renders right
// under that field instead of one generic banner - same idea for every Create/Update error here.
function routeApiError(message: string): VehicleFormErrors {
  if (/nama kendaraan/i.test(message)) return { nama: message };
  if (/plat nomor/i.test(message)) return { platNomor: message };
  if (/kapasitas/i.test(message)) return { kapasitas: message };
  if (/supir/i.test(message)) return { supir: message };
  if (/merek/i.test(message)) return { merek: message };
  if (/model/i.test(message)) return { model: message };
  if (/tahun/i.test(message)) return { tahun: message };
  if (/warna/i.test(message)) return { warna: message };
  if (/telepon/i.test(message)) return { nomorTeleponSupir: message };
  if (/lokasi parkir/i.test(message)) return { lokasiParkir: message };
  if (/password/i.test(message)) return { password: message };
  return { general: message };
}

// Super Admin's vehicle fleet editor - the UI for VehicleAdminController, replacing the hardcoded
// 10-vehicle list Services/Vehicles.cs used to carry (see its own SeedData/LoadFromDb). Same
// list+modal-form shape as SuperAdminUsersTab, without pagination - the fleet is small.
export default function SuperAdminVehicleTab() {
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
    if (!form.supir.trim()) errs.supir = "Nama supir wajib diisi";
    if (!form.merek.trim()) errs.merek = "Merek wajib diisi";
    if (!form.model.trim()) errs.model = "Model wajib diisi";
    const tahun = Number(form.tahun);
    if (!Number.isInteger(tahun) || tahun < 1900 || tahun > 2100) errs.tahun = "Tahun tidak valid";
    if (!form.warna.trim()) errs.warna = "Warna wajib diisi";
    if (!form.nomorTeleponSupir.trim()) errs.nomorTeleponSupir = "No. telepon supir wajib diisi";
    if (!form.lokasiParkir.trim()) errs.lokasiParkir = "Lokasi parkir wajib diisi";
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
      lokasiParkir: form.lokasiParkir.trim(),
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
      <div className="card-header" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openCreate}>
          <Plus width={16} height={16} /> Tambah Kendaraan
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nama</th><th>Plat Nomor</th><th>Kapasitas</th><th>Supir</th><th>Merek / Model</th><th>Tahun</th><th></th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={7} className="table-empty">Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="table-empty">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">Tidak Ada Data</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.nama}</td>
                  <td>{item.platNomor}</td>
                  <td>{item.kapasitas}</td>
                  <td>{item.supir}</td>
                  <td>{item.merek} {item.model}</td>
                  <td>{item.tahun}</td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                <label htmlFor="vehicle-form-plat">Plat Nomor</label>
                <input id="vehicle-form-plat" type="text" required value={form.platNomor} onChange={(e) => setForm((f) => ({ ...f, platNomor: e.target.value }))} />
                {formErrors.platNomor && <div className="field-error-text">{formErrors.platNomor}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-kapasitas">Kapasitas</label>
                <input id="vehicle-form-kapasitas" type="number" min={1} required value={form.kapasitas} onChange={(e) => setForm((f) => ({ ...f, kapasitas: e.target.value }))} />
                {formErrors.kapasitas && <div className="field-error-text">{formErrors.kapasitas}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-supir">Nama Supir</label>
                <input id="vehicle-form-supir" type="text" required value={form.supir} onChange={(e) => setForm((f) => ({ ...f, supir: e.target.value }))} />
                {formErrors.supir && <div className="field-error-text">{formErrors.supir}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-notelp">No. Telepon Supir</label>
                <input id="vehicle-form-notelp" type="text" required value={form.nomorTeleponSupir} onChange={(e) => setForm((f) => ({ ...f, nomorTeleponSupir: e.target.value }))} />
                {formErrors.nomorTeleponSupir && <div className="field-error-text">{formErrors.nomorTeleponSupir}</div>}
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
                <label htmlFor="vehicle-form-tahun">Tahun</label>
                <input id="vehicle-form-tahun" type="number" min={1900} max={2100} required value={form.tahun} onChange={(e) => setForm((f) => ({ ...f, tahun: e.target.value }))} />
                {formErrors.tahun && <div className="field-error-text">{formErrors.tahun}</div>}
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-warna">Warna</label>
                <input id="vehicle-form-warna" type="text" required value={form.warna} onChange={(e) => setForm((f) => ({ ...f, warna: e.target.value }))} />
                {formErrors.warna && <div className="field-error-text">{formErrors.warna}</div>}
              </div>
              <div className="field full">
                <label htmlFor="vehicle-form-lokasi">Lokasi Parkir</label>
                <input id="vehicle-form-lokasi" type="text" required value={form.lokasiParkir} onChange={(e) => setForm((f) => ({ ...f, lokasiParkir: e.target.value }))} />
                {formErrors.lokasiParkir && <div className="field-error-text">{formErrors.lokasiParkir}</div>}
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
        itemLabel={`kendaraan "${deleteTarget?.nama ?? ""}"`}
        details={deleteTarget ? [
          { label: "Nama Kendaraan", value: deleteTarget.nama },
          { label: "Plat Nomor", value: deleteTarget.platNomor },
          { label: "Kapasitas", value: String(deleteTarget.kapasitas) },
          { label: "Supir", value: deleteTarget.supir },
          { label: "Merek / Model", value: `${deleteTarget.merek} ${deleteTarget.model}` },
          { label: "Tahun", value: String(deleteTarget.tahun) },
        ] : []}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
