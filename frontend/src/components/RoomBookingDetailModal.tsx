"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES, BOOKING_L1_ACTIONABLE_STATUSES, bookingOriginActorLabel, isBookingGaActionable } from "@/lib/constants";
import type { BookingRuang, BookingRuangCreatePayload, Me, RoomOption } from "@/lib/types";
import type { RejectType } from "./RejectModal";
import { useConfirm } from "./ui/ConfirmProvider";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  mode: "view" | "edit";
  item: BookingRuang | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string) => void;
}

function toFormFields(item: BookingRuang): BookingRuangCreatePayload {
  return {
    namaKegiatan: item.namaKegiatan,
    namaRuang: item.namaRuang,
    jumlahPeserta: item.jumlahPeserta,
    tanggal: item.tanggal,
    isWholeDay: item.isWholeDay,
    jamMulai: item.jamMulai,
    jamSelesai: item.jamSelesai,
    catatan: item.catatan || "",
  };
}

export default function RoomBookingDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<BookingRuangCreatePayload | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [error, setError] = useState("");
  const confirm = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft =
    !isEdit &&
    item.status === "DRAFT" &&
    item.createdBy === me.id &&
    ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI"].includes(me.role);
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI") && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isBookingGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);

  function set<K extends keyof BookingRuangCreatePayload>(key: K, value: BookingRuangCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmitDraft() {
    try {
      await api.submitBooking(item!.id);
      showToast("Booking berhasil dikirim untuk approval");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleApproveL1() {
    onClose();
    confirm("Approve booking ini dan teruskan ke Admin General Affair?", async () => {
      try {
        await api.approveBookingL1(item!.id);
        showToast("Booking berhasil di-approve, diteruskan ke Admin General Affair");
        onSaved();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Approve");
  }

  function handleApproveGa() {
    onClose();
    confirm("Approve booking ini?", async () => {
      try {
        await api.approveBookingGa(item!.id);
        showToast("Booking berhasil di-approve, diteruskan ke Approval General Affair");
        onSaved();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Approve");
  }

  function handleApproveGaApproval() {
    onClose();
    confirm("Approve booking ini sebagai konfirmasi final?", async () => {
      try {
        await api.approveBookingGaApproval(item!.id);
        showToast("Booking berhasil dikonfirmasi");
        onSaved();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }, "Approve");
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateBooking(item!.id, { ...form!, catatan: form!.catatan || null });
      showToast("Booking berhasil diperbarui");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? "Form Booking Ruang Meeting" : "Detail Booking Ruang Meeting"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleUpdateSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="bv-nama-kegiatan">Nama Kegiatan</label>
              <input type="text" id="bv-nama-kegiatan" required disabled={!isEdit} value={form.namaKegiatan} onChange={(e) => set("namaKegiatan", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bv-ruang">Ruang</label>
              <select id="bv-ruang" required disabled={!isEdit} value={form.namaRuang} onChange={(e) => set("namaRuang", e.target.value)}>
                <option value={form.namaRuang} disabled hidden>{form.namaRuang}</option>
                {rooms.map((r) => (
                  <option key={r.nama} value={r.nama}>{r.nama}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bv-peserta">Jumlah Peserta</label>
              <input type="number" id="bv-peserta" min={1} required disabled={!isEdit} value={form.jumlahPeserta} onChange={(e) => set("jumlahPeserta", Number(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="bv-tanggal">Tanggal</label>
              <input type="date" id="bv-tanggal" required disabled={!isEdit} value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bv-whole-day" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="bv-whole-day" disabled={!isEdit} checked={form.isWholeDay} onChange={(e) => set("isWholeDay", e.target.checked)} />
                Sehari Penuh
              </label>
            </div>
            {!form.isWholeDay && (
              <>
                <div className="field">
                  <label htmlFor="bv-jam-mulai">Jam Mulai</label>
                  <input type="time" id="bv-jam-mulai" required disabled={!isEdit} value={form.jamMulai || ""} onChange={(e) => set("jamMulai", e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="bv-jam-selesai">Jam Selesai</label>
                  <input type="time" id="bv-jam-selesai" required disabled={!isEdit} value={form.jamSelesai || ""} onChange={(e) => set("jamSelesai", e.target.value)} />
                </div>
              </>
            )}
            <div className="field full">
              <label htmlFor="bv-catatan">Catatan</label>
              <input type="text" id="bv-catatan" disabled={!isEdit} placeholder="Opsional" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          {item.rejectReason && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Catatan Penolakan:</strong> {item.rejectReason}
            </div>
          )}

          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{isEdit ? "Batal" : "Tutup"}</button>
            {canSubmitDraft && (
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft}>Kirim</button>
            )}
            {canL1Act && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "booking-l1", bookingOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveL1}>Approve</button>
              </>
            )}
            {canGaAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "booking-ga", bookingOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGa}>Approve</button>
              </>
            )}
            {canGaApprovalAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "booking-ga-approval", bookingOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGaApproval}>Approve</button>
              </>
            )}
            {isEdit && (
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
