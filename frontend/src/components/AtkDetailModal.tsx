"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  atkOriginActorLabel,
  isAtkEditableByOrigin,
  isAtkGaActionable,
  isL1Actor,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { Me, PermintaanAtk, PermintaanAtkCreatePayload, PermintaanAtkItemPayload } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import type { RejectType } from "./RejectModal";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  mode: "view" | "edit";
  item: PermintaanAtk | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string) => void;
}

const MAX_ITEM_ROWS = 30;

function toFormFields(item: PermintaanAtk): PermintaanAtkCreatePayload {
  return {
    tanggal: item.tanggal,
    keperluan: item.keperluan,
    catatan: item.catatan || "",
    items: item.items.map((i) => ({ namaBarang: i.namaBarang, jumlah: i.jumlah, satuan: i.satuan })),
  };
}

export default function AtkDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<PermintaanAtkCreatePayload | null>(null);
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
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isAtkEditableByOrigin(item, me);
  const canL1Act = !isEdit && isL1Actor(item, me) && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isAtkGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);

  function set<K extends keyof PermintaanAtkCreatePayload>(key: K, value: PermintaanAtkCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function setItem(index: number, patch: Partial<PermintaanAtkItemPayload>) {
    setForm((f) => (f ? { ...f, items: f.items.map((row, i) => (i === index ? { ...row, ...patch } : row)) } : f));
  }

  function addItemRow() {
    setForm((f) => {
      if (!f || f.items.length >= MAX_ITEM_ROWS) return f;
      return { ...f, items: [...f.items, { namaBarang: "", jumlah: 1, satuan: "" }] };
    });
  }

  function removeItemRow(index: number) {
    setForm((f) => (f && f.items.length > 1 ? { ...f, items: f.items.filter((_, i) => i !== index) } : f));
  }

  async function handleSubmitDraft() {
    try {
      await api.submitAtk(item!.id);
      showToast("Permintaan berhasil dikirim untuk approval");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleApproveL1() {
    onClose();
    try {
      await api.approveAtkL1(item!.id);
      showToast("Permintaan berhasil di-approve, diteruskan ke Admin General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGa() {
    onClose();
    try {
      await api.approveAtkGa(item!.id);
      showToast("Permintaan berhasil di-approve, diteruskan ke Approval General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGaApproval() {
    onClose();
    try {
      await api.approveAtkGaApproval(item!.id);
      showToast("Permintaan ATK berhasil disetujui");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateAtk(item!.id, { ...form!, catatan: form!.catatan || null });
      showToast("Permintaan berhasil diperbarui");
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
          <h3>{isEdit ? "Form Permintaan ATK" : "Detail Permintaan ATK"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleUpdateSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="da-nomor-permintaan">Nomor Permintaan ATK</label>
              <input type="text" id="da-nomor-permintaan" disabled value={item.nomorPermintaan || ""} />
            </div>
            <div className="field">
              <label htmlFor="da-tanggal">Tanggal Dibutuhkan</label>
              <input type="date" id="da-tanggal" required disabled={!isEdit} value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="da-keperluan">Keperluan</label>
              <input type="text" id="da-keperluan" required disabled={!isEdit} value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>

            <div className="field full">
              <label>Daftar Barang</label>
              {form.items.map((row, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <input
                    type="text"
                    aria-label={`Nama barang ${idx + 1}`}
                    required
                    disabled={!isEdit}
                    placeholder="Nama barang"
                    style={{ flex: 3, minWidth: 0 }}
                    value={row.namaBarang}
                    onChange={(e) => setItem(idx, { namaBarang: e.target.value })}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`Jumlah barang ${idx + 1}`}
                    required
                    disabled={!isEdit}
                    placeholder="Jumlah"
                    style={{ flex: 1, minWidth: 0 }}
                    value={row.jumlah === 0 ? "" : String(row.jumlah)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                      setItem(idx, { jumlah: digits === "" ? 0 : Math.min(Number(digits), 9999) });
                    }}
                  />
                  <input
                    type="text"
                    aria-label={`Satuan barang ${idx + 1}`}
                    required
                    disabled={!isEdit}
                    placeholder="Satuan"
                    style={{ flex: 1.5, minWidth: 0 }}
                    value={row.satuan}
                    onChange={(e) => setItem(idx, { satuan: e.target.value })}
                  />
                  {isEdit && (
                    <button
                      type="button"
                      className="card-icon-btn"
                      aria-label={`Hapus baris barang ${idx + 1}`}
                      disabled={form.items.length <= 1}
                      style={{ flexShrink: 0, opacity: form.items.length <= 1 ? 0.4 : 1 }}
                      onClick={() => removeItemRow(idx)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  )}
                </div>
              ))}
              {isEdit && form.items.length < MAX_ITEM_ROWS && (
                <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={addItemRow}>
                  + Tambah Barang
                </button>
              )}
            </div>

            <div className="field full">
              <label htmlFor="da-catatan">Catatan</label>
              <input type="text" id="da-catatan" disabled={!isEdit} placeholder={isEdit ? "Contoh: Segera di Approve" : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"].includes(item.status) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Diajukan:</strong> {formatDateTime(item.createdAt)}
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
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "atk-l1", atkOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveL1}>Approve</button>
              </>
            )}
            {canGaAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "atk-ga", atkOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGa}>Approve</button>
              </>
            )}
            {canGaApprovalAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "atk-ga-approval", atkOriginActorLabel(item)); }}>Reject</button>
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
