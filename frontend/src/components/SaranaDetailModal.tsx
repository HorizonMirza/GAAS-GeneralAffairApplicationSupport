"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  KATEGORI_KERUSAKAN_LABEL,
  URGENSI_LABEL,
  isL1Actor,
  isSaranaEditableByOrigin,
  isSaranaGaActionable,
  saranaOriginActorLabel,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KategoriKerusakan, Me, PerbaikanSarana, PerbaikanSaranaCreatePayload, Urgensi } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import type { RejectType } from "./RejectModal";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  mode: "view" | "edit";
  item: PerbaikanSarana | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string) => void;
}

const KATEGORI_OPTIONS = Object.keys(KATEGORI_KERUSAKAN_LABEL) as KategoriKerusakan[];
const URGENSI_OPTIONS = Object.keys(URGENSI_LABEL) as Urgensi[];

function toFormFields(item: PerbaikanSarana): PerbaikanSaranaCreatePayload {
  return {
    tanggal: item.tanggal,
    lokasi: item.lokasi,
    kategori: item.kategori,
    urgensi: item.urgensi,
    deskripsiKerusakan: item.deskripsiKerusakan,
    catatan: item.catatan || "",
  };
}

export default function SaranaDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<PerbaikanSaranaCreatePayload | null>(null);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}-${mode}`);

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isSaranaEditableByOrigin(item, me);
  const canL1Act = !isEdit && isL1Actor(item, me) && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isSaranaGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);

  function set<K extends keyof PerbaikanSaranaCreatePayload>(key: K, value: PerbaikanSaranaCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmitDraft() {
    try {
      await api.submitSarana(item!.id);
      showToast("Laporan berhasil dikirim untuk approval");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleApproveL1() {
    onClose();
    try {
      await api.approveSaranaL1(item!.id);
      showToast("Laporan berhasil di-approve, diteruskan ke Admin General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGa() {
    onClose();
    try {
      await api.approveSaranaGa(item!.id);
      showToast("Laporan berhasil di-approve, diteruskan ke Approval General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGaApproval() {
    onClose();
    try {
      await api.approveSaranaGaApproval(item!.id);
      showToast("Laporan perbaikan berhasil disetujui");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateSarana(item!.id, { ...form!, catatan: form!.catatan || null });
      showToast("Laporan berhasil diperbarui");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? "Form Laporan Perbaikan" : "Detail Laporan Perbaikan"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleUpdateSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="ds-nomor-perbaikan">Nomor Laporan Perbaikan</label>
              <input type="text" id="ds-nomor-perbaikan" disabled value={item.nomorPerbaikan || ""} />
            </div>
            <div className="field">
              <label htmlFor="ds-tanggal">Tanggal Laporan</label>
              <input type="date" id="ds-tanggal" required disabled={!isEdit} value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ds-lokasi">Lokasi</label>
              <input type="text" id="ds-lokasi" required disabled={!isEdit} value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ds-kategori">Kategori Kerusakan</label>
              <select id="ds-kategori" required disabled={!isEdit} value={form.kategori} onChange={(e) => set("kategori", e.target.value as KategoriKerusakan)}>
                {KATEGORI_OPTIONS.map((k) => (
                  <option key={k} value={k}>{KATEGORI_KERUSAKAN_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ds-urgensi">Tingkat Urgensi</label>
              <select id="ds-urgensi" required disabled={!isEdit} value={form.urgensi} onChange={(e) => set("urgensi", e.target.value as Urgensi)}>
                {URGENSI_OPTIONS.map((u) => (
                  <option key={u} value={u}>{URGENSI_LABEL[u]}</option>
                ))}
              </select>
            </div>
            <div className="field full">
              <label htmlFor="ds-deskripsi">Deskripsi Kerusakan</label>
              <textarea
                id="ds-deskripsi"
                required
                disabled={!isEdit}
                value={form.deskripsiKerusakan}
                onChange={(e) => set("deskripsiKerusakan", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.stopPropagation();
                }}
              />
            </div>
            <div className="field full">
              <label htmlFor="ds-catatan">Catatan</label>
              <input type="text" id="ds-catatan" disabled={!isEdit} placeholder={isEdit ? "Contoh: Mohon diperbaiki sebelum rapat Jumat" : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"].includes(item.status) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Dilaporkan:</strong> {formatDateTime(item.createdAt)}
            </div>
          )}

          {item.rejectReason && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Catatan Penolakan:</strong> {item.rejectReason}
            </div>
          )}

          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{isEdit ? "Batal" : "Tutup"}</button>
            {canSubmitDraft && (
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft}>Approve</button>
            )}
            {canL1Act && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "sarana-l1", saranaOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveL1}>Approve</button>
              </>
            )}
            {canGaAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "sarana-ga", saranaOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGa}>Approve</button>
              </>
            )}
            {canGaApprovalAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "sarana-ga-approval", saranaOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGaApproval}>Approve</button>
              </>
            )}
            {isEdit && (
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan</button>
            )}
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
