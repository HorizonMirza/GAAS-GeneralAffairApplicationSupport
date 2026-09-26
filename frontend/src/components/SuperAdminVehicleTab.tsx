"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import ModalOverlay from "@/components/ModalOverlay";
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
}

const EMPTY_FORM: VehicleFormState = {
  nama: "", platNomor: "", kapasitas: "", supir: "", merek: "", model: "", tahun: "", warna: "", nomorTeleponSupir: "", lokasiParkir: "",
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
  };
}

// Super Admin's vehicle fleet editor - the UI for VehicleAdminController, replacing the hardcoded
// 10-vehicle list Services/Vehicles.cs used to carry (see its own SeedData/LoadFromDb). Same
// list+modal-form shape as SuperAdminUsersTab, without pagination - the fleet is small.
export default function SuperAdminVehicleTab() {
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<VehicleItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState<"create" | VehicleItem | null>(null);
  const [form, setForm] = useState<VehicleFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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
    setFormError("");
    setFormOpen("create");
  }

  function openEdit(item: VehicleItem) {
    setForm(toFormFields(item));
    setFormError("");
    setFormOpen(item);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.nama.trim()) { setFormError("Nama kendaraan wajib diisi"); return; }
    if (!form.platNomor.trim()) { setFormError("Plat nomor wajib diisi"); return; }
    const kapasitas = Number(form.kapasitas);
    if (!Number.isInteger(kapasitas) || kapasitas <= 0) { setFormError("Kapasitas harus bilangan bulat lebih dari 0"); return; }
    if (!form.supir.trim()) { setFormError("Nama supir wajib diisi"); return; }
    if (!form.merek.trim()) { setFormError("Merek wajib diisi"); return; }
    if (!form.model.trim()) { setFormError("Model wajib diisi"); return; }
    const tahun = Number(form.tahun);
    if (!Number.isInteger(tahun) || tahun < 1900 || tahun > 2100) { setFormError("Tahun tidak valid"); return; }
    if (!form.warna.trim()) { setFormError("Warna wajib diisi"); return; }
    if (!form.nomorTeleponSupir.trim()) { setFormError("No. telepon supir wajib diisi"); return; }
    if (!form.lokasiParkir.trim()) { setFormError("Lokasi parkir wajib diisi"); return; }

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
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(item: VehicleItem) {
    confirm(`Hapus kendaraan "${item.nama}"?`, async () => {
      try {
        await api.deleteAdminVehicle(item.id);
        showToast("Kendaraan berhasil dihapus");
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      }
    });
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Kendaraan ({items.length})</h3>
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openCreate}>
          <Plus width={16} height={16} /> Tambah Kendaraan
        </button>
      </div>
      <p className="text-secondary" style={{ marginTop: 0 }}>
        Daftar kendaraan yang bisa dipilih saat membuat Vehicle Booking. Mengganti data kendaraan
        tidak mengubah data booking yang sudah ada - hanya memengaruhi pilihan pada form baru ke
        depannya.
      </p>

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
                    <button type="button" className="btn btn-secondary" style={{ width: "auto", padding: "3px 8px" }} onClick={() => openEdit(item)}>Edit</button>
                    <button type="button" className="btn btn-confirm-danger" style={{ width: "auto", padding: "3px 8px" }} onClick={() => handleDelete(item)}>Hapus</button>
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

          <div className={`alert-error ${formError ? "alert-error-visible" : ""}`}>
            <div className="alert-error-text"><strong>Error</strong><span>{formError}</span></div>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="vehicle-form-nama">Nama Kendaraan</label>
                <input id="vehicle-form-nama" type="text" required value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-plat">Plat Nomor</label>
                <input id="vehicle-form-plat" type="text" required value={form.platNomor} onChange={(e) => setForm((f) => ({ ...f, platNomor: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-kapasitas">Kapasitas</label>
                <input id="vehicle-form-kapasitas" type="number" min={1} required value={form.kapasitas} onChange={(e) => setForm((f) => ({ ...f, kapasitas: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-supir">Nama Supir</label>
                <input id="vehicle-form-supir" type="text" required value={form.supir} onChange={(e) => setForm((f) => ({ ...f, supir: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-notelp">No. Telepon Supir</label>
                <input id="vehicle-form-notelp" type="text" required value={form.nomorTeleponSupir} onChange={(e) => setForm((f) => ({ ...f, nomorTeleponSupir: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-merek">Merek</label>
                <input id="vehicle-form-merek" type="text" required value={form.merek} onChange={(e) => setForm((f) => ({ ...f, merek: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-model">Model</label>
                <input id="vehicle-form-model" type="text" required value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-tahun">Tahun</label>
                <input id="vehicle-form-tahun" type="number" min={1900} max={2100} required value={form.tahun} onChange={(e) => setForm((f) => ({ ...f, tahun: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="vehicle-form-warna">Warna</label>
                <input id="vehicle-form-warna" type="text" required value={form.warna} onChange={(e) => setForm((f) => ({ ...f, warna: e.target.value }))} />
              </div>
              <div className="field full">
                <label htmlFor="vehicle-form-lokasi">Lokasi Parkir</label>
                <input id="vehicle-form-lokasi" type="text" required value={form.lokasiParkir} onChange={(e) => setForm((f) => ({ ...f, lokasiParkir: e.target.value }))} />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={() => setFormOpen(null)} disabled={saving}>Batal</button>
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={saving}>
                {saving ? "Menyimpan..." : formOpen === "create" ? "Tambah" : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>
    </div>
  );
}
