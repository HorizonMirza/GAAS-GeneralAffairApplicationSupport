"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  EXECUTION_STAGE_LABEL,
  KATEGORI_KERUSAKAN_LABEL,
  URGENSI_LABEL,
  isSaranaEditableByOrigin,
  isSaranaExecutionActor,
  isSaranaGaActionable,
  saranaOriginActorLabel,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KategoriKerusakan, Me, PerbaikanSarana, PerbaikanSaranaCreatePayload, Urgensi } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import type { RejectType } from "./RejectModal";
import SearchableSelect from "./SearchableSelect";
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
  const [execNote, setExecNote] = useState("");
  const [gambarFile, setGambarFile] = useState<File | null>(null);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}-${mode}`);

  // useLayoutEffect (not useEffect) - form starts as null and is only hydrated here, so the very
  // first time this modal is ever opened in a session it renders nothing this pass (see the
  // `!form` check below) and formRef never attaches to a real <form>. A plain useEffect runs
  // after paint with the same open/item/mode trigger useAutofocusFirstField already used on that
  // empty pass, so it never gets a second chance once the form actually appears. useLayoutEffect's
  // setForm call instead forces a synchronous re-render before paint, so by the time
  // useAutofocusFirstField's (deferred) effect runs, formRef already points at the real form.
  useLayoutEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    setExecNote("");
    setGambarFile(null);
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isSaranaEditableByOrigin(item, me);
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI") && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isSaranaGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);
  // Eksekusi fisik hanya tersedia setelah disetujui final, dan hanya untuk Admin GA/Approval GA -
  // lihat isSaranaExecutionActor.
  const canExecute = !isEdit && item.status === "APPROVED_GA_APPROVAL" && isSaranaExecutionActor(me);

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

  // Closes first, same convention as the approve/reject handlers above - the item snapshot this
  // modal holds isn't refetched in place, so leaving it open after a stage change would keep
  // showing the now-stale stage/buttons until the next open.
  async function handleCekLokasi() {
    const note = execNote.trim() || null;
    onClose();
    try {
      await api.cekLokasiSarana(item!.id, note);
      showToast("Lokasi ditandai sudah dicek");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleUploadGambar() {
    if (!gambarFile) {
      setError("Pilih file gambar terlebih dahulu");
      return;
    }
    const file = gambarFile;
    const note = execNote.trim() || null;
    onClose();
    try {
      await api.uploadGambarSarana(item!.id, file, note);
      showToast("Gambar rencana perbaikan berhasil diunggah");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleEksekusi() {
    const note = execNote.trim() || null;
    onClose();
    try {
      await api.eksekusiSarana(item!.id, note);
      showToast("Eksekusi perbaikan ditandai selesai");
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
              <SearchableSelect
                id="ds-kategori"
                disabled={!isEdit}
                value={form.kategori}
                onChange={(v) => set("kategori", v as KategoriKerusakan)}
                options={KATEGORI_OPTIONS}
                getLabel={(v) => KATEGORI_KERUSAKAN_LABEL[v as KategoriKerusakan] || v}
                placeholder="Pilih kategori"
              />
            </div>
            <div className="field">
              <label htmlFor="ds-urgensi">Tingkat Urgensi</label>
              <SearchableSelect
                id="ds-urgensi"
                disabled={!isEdit}
                value={form.urgensi}
                onChange={(v) => set("urgensi", v as Urgensi)}
                options={URGENSI_OPTIONS}
                getLabel={(v) => URGENSI_LABEL[v as Urgensi] || v}
                placeholder="Pilih urgensi"
              />
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

          {item.status === "APPROVED_GA_APPROVAL" && (
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Eksekusi Perbaikan: {EXECUTION_STAGE_LABEL[item.executionStage]}
              </div>
              {item.gambarOriginalFilename && (
                <div style={{ marginBottom: 8 }}>
                  <a href={api.saranaGambarUrl(item.id)} target="_blank" rel="noopener noreferrer">
                    Lihat Gambar Rencana Perbaikan
                  </a>
                </div>
              )}
              {canExecute && item.executionStage === "MENUNGGU" && (
                <>
                  <textarea
                    placeholder="Catatan hasil cek lokasi (opsional)"
                    value={execNote}
                    onChange={(e) => setExecNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.stopPropagation();
                    }}
                    style={{ marginBottom: 8 }}
                  />
                  <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleCekLokasi}>
                    Tandai Lokasi Sudah Dicek
                  </button>
                </>
              )}
              {canExecute && item.executionStage === "LOKASI_DICEK" && (
                <>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => setGambarFile(e.target.files?.[0] || null)}
                    style={{ marginBottom: 8 }}
                  />
                  <textarea
                    placeholder="Catatan gambar rencana perbaikan (opsional)"
                    value={execNote}
                    onChange={(e) => setExecNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.stopPropagation();
                    }}
                    style={{ marginBottom: 8 }}
                  />
                  <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleUploadGambar}>
                    Unggah Gambar
                  </button>
                </>
              )}
              {canExecute && item.executionStage === "GAMBAR_DIBUAT" && (
                <>
                  <textarea
                    placeholder="Catatan hasil eksekusi (opsional)"
                    value={execNote}
                    onChange={(e) => setExecNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.stopPropagation();
                    }}
                    style={{ marginBottom: 8 }}
                  />
                  <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleEksekusi}>
                    Tandai Selesai Dieksekusi
                  </button>
                </>
              )}
            </div>
          )}

          <div className="error-text">{error}</div>
          <div className="modal-actions">
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
