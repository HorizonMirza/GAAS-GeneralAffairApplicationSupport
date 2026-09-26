"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import ModalOverlay from "@/components/ModalOverlay";
import type { MeetingRoomItem } from "@/lib/types";

interface RoomFormState {
  nama: string;
  kapasitas: string;
  lantai: string;
  fasilitas: string;
}

const EMPTY_FORM: RoomFormState = { nama: "", kapasitas: "", lantai: "", fasilitas: "" };

function toFormFields(item: MeetingRoomItem): RoomFormState {
  return { nama: item.nama, kapasitas: String(item.kapasitas), lantai: item.lantai, fasilitas: item.fasilitas.join(", ") };
}

// Super Admin's meeting room roster editor - the UI for MeetingRoomAdminController, replacing the
// hardcoded 10-room list Services/MeetingRooms.cs used to carry (see its own SeedData/LoadFromDb).
// Same list+modal-form shape as SuperAdminUsersTab, without pagination - the roster is small.
export default function SuperAdminMeetingRoomTab() {
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<MeetingRoomItem[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState<"create" | MeetingRoomItem | null>(null);
  const [form, setForm] = useState<RoomFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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
    setFormError("");
    setFormOpen("create");
  }

  function openEdit(item: MeetingRoomItem) {
    setForm(toFormFields(item));
    setFormError("");
    setFormOpen(item);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.nama.trim()) { setFormError("Nama ruang wajib diisi"); return; }
    if (!form.lantai.trim()) { setFormError("Lantai wajib diisi"); return; }
    const kapasitas = Number(form.kapasitas);
    if (!Number.isInteger(kapasitas) || kapasitas <= 0) { setFormError("Kapasitas harus bilangan bulat lebih dari 0"); return; }

    const payload = {
      nama: form.nama.trim(),
      kapasitas,
      lantai: form.lantai.trim(),
      fasilitas: form.fasilitas.split(",").map((f) => f.trim()).filter((f) => f.length > 0),
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
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(item: MeetingRoomItem) {
    confirm(`Hapus ruang meeting "${item.nama}"?`, async () => {
      try {
        await api.deleteAdminMeetingRoom(item.id);
        showToast("Ruang meeting berhasil dihapus");
        await load();
      } catch (err) {
        showToast(errorMessage(err), "error");
      }
    });
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Ruang Meeting ({items.length})</h3>
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={openCreate}>
          <Plus width={16} height={16} /> Tambah Ruang
        </button>
      </div>
      <p className="text-secondary" style={{ marginTop: 0 }}>
        Daftar ruang yang bisa dipilih saat membuat Room Booking. Mengganti nama/kapasitas tidak
        mengubah data booking yang sudah ada - hanya memengaruhi pilihan pada form baru ke depannya.
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nama Ruang</th><th>Kapasitas</th><th>Lantai</th><th>Fasilitas</th><th></th>
            </tr>
          </thead>
          <tbody>
            {busy ? (
              <tr><td colSpan={5} className="table-empty">Memuat data...</td></tr>
            ) : error ? (
              <tr><td colSpan={5} className="table-empty">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">Tidak Ada Data</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.nama}</td>
                  <td>{item.kapasitas}</td>
                  <td>{item.lantai}</td>
                  <td>{item.fasilitas.length > 0 ? item.fasilitas.join(", ") : "-"}</td>
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
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <h3>{formOpen === "create" ? "Tambah Ruang Meeting" : "Edit Ruang Meeting"}</h3>
            <button type="button" className="modal-close" onClick={() => setFormOpen(null)}>&times;</button>
          </div>

          <div className={`alert-error ${formError ? "alert-error-visible" : ""}`}>
            <div className="alert-error-text"><strong>Error</strong><span>{formError}</span></div>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div className="field">
              <label htmlFor="room-form-nama">Nama Ruang</label>
              <input id="room-form-nama" type="text" required value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="room-form-kapasitas">Kapasitas</label>
              <input id="room-form-kapasitas" type="number" min={1} required value={form.kapasitas} onChange={(e) => setForm((f) => ({ ...f, kapasitas: e.target.value }))} />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="room-form-lantai">Lantai</label>
              <input id="room-form-lantai" type="text" required placeholder="Contoh: Lantai 3" value={form.lantai} onChange={(e) => setForm((f) => ({ ...f, lantai: e.target.value }))} />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="room-form-fasilitas">Fasilitas</label>
              <input id="room-form-fasilitas" type="text" placeholder="Pisahkan dengan koma, contoh: TV, AC, Proyektor" value={form.fasilitas} onChange={(e) => setForm((f) => ({ ...f, fasilitas: e.target.value }))} />
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
