"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import ModalOverlay from "@/components/ModalOverlay";
import PasswordField from "@/components/PasswordField";
import DeleteWithPasswordModal from "@/components/DeleteWithPasswordModal";
import type { MeetingRoomItem } from "@/lib/types";

interface RoomFormState {
  nama: string;
  kapasitas: string;
  lantai: string;
  fasilitas: string;
  password: string;
}

interface RoomFormErrors {
  nama?: string;
  kapasitas?: string;
  lantai?: string;
  password?: string;
  general?: string;
}

const EMPTY_FORM: RoomFormState = { nama: "", kapasitas: "", lantai: "", fasilitas: "", password: "" };

function toFormFields(item: MeetingRoomItem): RoomFormState {
  return { nama: item.nama, kapasitas: String(item.kapasitas), lantai: item.lantai, fasilitas: item.fasilitas.join(", "), password: "" };
}

// Routes a flat backend `detail` string to the field it's actually about, so it renders right
// under that field instead of one generic banner - same idea for every Create/Update error here.
function routeApiError(message: string): RoomFormErrors {
  if (/nama ruang/i.test(message)) return { nama: message };
  if (/lantai/i.test(message)) return { lantai: message };
  if (/kapasitas/i.test(message)) return { kapasitas: message };
  if (/password/i.test(message)) return { password: message };
  return { general: message };
}

// Super Admin's meeting room roster editor - the UI for MeetingRoomAdminController, replacing the
// hardcoded 10-room list Services/MeetingRooms.cs used to carry (see its own SeedData/LoadFromDb).
// Same list+modal-form shape as SuperAdminUsersTab, without pagination - the roster is small.
export default function SuperAdminMeetingRoomTab({ hideTitle }: { hideTitle?: boolean } = {}) {
  const { showToast } = useToast();

  const [items, setItems] = useState<MeetingRoomItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState<"create" | MeetingRoomItem | null>(null);
  const [form, setForm] = useState<RoomFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<RoomFormErrors>({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MeetingRoomItem | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.listAdminMeetingRooms();
      setItems(data.rooms);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Gagal memuat daftar ruang meeting");
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

  function openEdit(item: MeetingRoomItem) {
    setForm(toFormFields(item));
    setFormErrors({});
    setFormOpen(item);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: RoomFormErrors = {};
    if (!form.nama.trim()) errs.nama = "Nama ruang wajib diisi";
    if (!form.lantai.trim()) errs.lantai = "Lantai wajib diisi";
    const kapasitas = Number(form.kapasitas);
    if (!Number.isInteger(kapasitas) || kapasitas <= 0) errs.kapasitas = "Kapasitas harus bilangan bulat lebih dari 0";
    if (!form.password) errs.password = "Password wajib diisi";
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setFormErrors({});

    const payload = {
      nama: form.nama.trim(),
      kapasitas,
      lantai: form.lantai.trim(),
      fasilitas: form.fasilitas.split(",").map((f) => f.trim()).filter((f) => f.length > 0),
      password: form.password,
    };

    setSaving(true);
    try {
      if (formOpen === "create") {
        await api.createAdminMeetingRoom(payload);
        showToast("Ruang meeting berhasil ditambahkan");
      } else if (formOpen) {
        await api.updateAdminMeetingRoom(formOpen.id, payload);
        showToast("Ruang meeting berhasil diperbarui");
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
    await api.deleteAdminMeetingRoom(deleteTarget.id, password);
    showToast("Ruang meeting berhasil dihapus");
    setDeleteTarget(null);
    await load();
  }

  return (
    <div className="card">
      <div className="card-header" style={hideTitle ? { justifyContent: "flex-end" } : undefined}>
        {!hideTitle && <h3>Ruang Meeting</h3>}
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openCreate}>
          <Plus width={16} height={16} /> Tambah Ruang Meeting
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>Nama Ruang</th><th>Kapasitas</th><th>Lantai</th><th>Fasilitas</th><th></th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={6} className="table-empty">Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="table-empty">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">Tidak Ada Data</td></tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.nama}</td>
                  <td>{item.kapasitas}</td>
                  <td>{item.lantai}</td>
                  <td>{item.fasilitas.length > 0 ? item.fasilitas.join(", ") : "-"}</td>
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
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <h3>{formOpen === "create" ? "Tambah Ruang Meeting" : "Edit Ruang Meeting"}</h3>
            <button type="button" className="modal-close" onClick={() => setFormOpen(null)}>&times;</button>
          </div>

          <div className={`alert-error ${formErrors.general ? "alert-error-visible" : ""}`}>
            <div className="alert-error-text"><strong>Error</strong><span>{formErrors.general}</span></div>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div className="field">
              <label htmlFor="room-form-nama">Nama Ruang</label>
              <input id="room-form-nama" type="text" required value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
              {formErrors.nama && <div className="field-error-text">{formErrors.nama}</div>}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="room-form-kapasitas">Kapasitas</label>
              <input id="room-form-kapasitas" type="number" min={1} required value={form.kapasitas} onChange={(e) => setForm((f) => ({ ...f, kapasitas: e.target.value }))} />
              {formErrors.kapasitas && <div className="field-error-text">{formErrors.kapasitas}</div>}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="room-form-lantai">Lantai</label>
              <input id="room-form-lantai" type="text" required value={form.lantai} onChange={(e) => setForm((f) => ({ ...f, lantai: e.target.value }))} />
              {formErrors.lantai && <div className="field-error-text">{formErrors.lantai}</div>}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="room-form-fasilitas">Fasilitas</label>
              <input id="room-form-fasilitas" type="text" value={form.fasilitas} onChange={(e) => setForm((f) => ({ ...f, fasilitas: e.target.value }))} />
            </div>
            <div style={{ marginTop: 12 }}>
              <PasswordField
                id="room-form-password"
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
        title="Hapus Ruang Meeting"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <>
            <div className="field">
              <label htmlFor="delete-room-nama">Nama Ruang</label>
              <input id="delete-room-nama" type="text" value={deleteTarget.nama} disabled readOnly />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="delete-room-kapasitas">Kapasitas</label>
              <input id="delete-room-kapasitas" type="text" value={String(deleteTarget.kapasitas)} disabled readOnly />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="delete-room-lantai">Lantai</label>
              <input id="delete-room-lantai" type="text" value={deleteTarget.lantai} disabled readOnly />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="delete-room-fasilitas">Fasilitas</label>
              <input id="delete-room-fasilitas" type="text" value={deleteTarget.fasilitas.length > 0 ? deleteTarget.fasilitas.join(", ") : "-"} disabled readOnly />
            </div>
          </>
        )}
      </DeleteWithPasswordModal>
    </div>
  );
}
