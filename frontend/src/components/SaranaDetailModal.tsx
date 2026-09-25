"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  KATEGORI_KERUSAKAN_LABEL,
  isSaranaEditableByOrigin,
  isSaranaGaActionable,
  saranaOriginActorLabel,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KategoriKerusakan, Me, PerbaikanSarana, PerbaikanSaranaCreatePayload, PerbaikanSaranaFotoKerusakan } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import PhotoDropUploader from "./PhotoDropUploader";
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
const MAX_FOTO_KERUSAKAN = 5;

function toFormFields(item: PerbaikanSarana): PerbaikanSaranaCreatePayload {
  return {
    tanggal: item.tanggal,
    lokasi: item.lokasi,
    kategori: item.kategori,
    deskripsiKerusakan: item.deskripsiKerusakan,
    catatan: item.catatan || "",
    namaPelapor: item.namaPelapor,
    noTeleponPelapor: item.noTeleponPelapor,
  };
}

export default function SaranaDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<PerbaikanSaranaCreatePayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fotoKerusakan, setFotoKerusakan] = useState<PerbaikanSaranaFotoKerusakan[]>([]);
  const [newFotoFiles, setNewFotoFiles] = useState<File[]>([]);
  const [removedFotoIds, setRemovedFotoIds] = useState<number[]>([]);
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
    setBusy(false);
    setNewFotoFiles([]);
    setRemovedFotoIds([]);
    api.listFotoKerusakanSarana(item.id).then(setFotoKerusakan).catch(() => setFotoKerusakan([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  // Foto yang di-stage untuk dihapus disembunyikan dari tampilan tapi baru benar-benar dihapus di
  // server saat Save ditekan (lihat handleUpdateSubmit) - lihat komentar di handleRemoveFoto.
  const visibleFotoKerusakan = fotoKerusakan.filter((f) => !removedFotoIds.includes(f.id));

  const isEdit = mode === "edit";
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isSaranaEditableByOrigin(item, me);
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI") && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isSaranaGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);
  function set<K extends keyof PerbaikanSaranaCreatePayload>(key: K, value: PerbaikanSaranaCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmitDraft() {
    setBusy(true);
    try {
      await api.submitSarana(item!.id);
      showToast("Pengajuan berhasil dikirim untuk approval");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function handleApproveL1() {
    onClose();
    try {
      await api.approveSaranaL1(item!.id);
      showToast("Pengajuan berhasil di-approve, diteruskan ke Admin GA");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGa() {
    onClose();
    try {
      await api.approveSaranaGa(item!.id);
      showToast("Pengajuan berhasil di-approve, diteruskan ke Approval General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGaApproval() {
    onClose();
    try {
      await api.approveSaranaGaApproval(item!.id);
      showToast("Pengajuan perbaikan berhasil disetujui");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (visibleFotoKerusakan.length + newFotoFiles.length === 0) {
      setError("Foto kerusakan wajib diunggah (minimal 1 foto)");
      return;
    }
    setBusy(true);
    try {
      await api.updateSarana(item!.id, { ...form!, catatan: form!.catatan || null });
      for (const fotoId of removedFotoIds) {
        await api.deleteFotoKerusakanSarana(item!.id, fotoId);
      }
      if (newFotoFiles.length > 0) {
        await api.uploadFotoKerusakanSarana(item!.id, newFotoFiles);
      }
      showToast("Pengajuan berhasil diperbarui");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  // Hapus/tambah foto di sini hanya menandai perubahan secara lokal (state), bukan langsung
  // memanggil API - baru benar-benar diterapkan ke server saat tombol Save utama ditekan (lihat
  // handleUpdateSubmit), supaya menutup modal tanpa Save tidak mengubah apa pun.
  function handleRemoveFoto(fotoId: number) {
    setRemovedFotoIds((ids) => [...ids, fotoId]);
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? "Form Pengajuan Perbaikan" : "Detail Pengajuan Perbaikan"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleUpdateSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="ds-nomor-perbaikan">Nomor Pengajuan Perbaikan</label>
              <input type="text" id="ds-nomor-perbaikan" disabled value={item.nomorPerbaikan || ""} />
            </div>
            <div className="field">
              <label htmlFor="ds-tanggal">Tanggal Pengajuan</label>
              <DateFilterPicker id="ds-tanggal" disabled={!isEdit} clearable={false} value={form.tanggal} onChange={(v) => set("tanggal", v)} />
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
            <div className="field full">
              <label htmlFor="ds-lokasi">Lokasi</label>
              <input type="text" id="ds-lokasi" required disabled={!isEdit} maxLength={255} value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ds-nama-pelapor">Nama PIC</label>
              <input type="text" id="ds-nama-pelapor" required disabled={!isEdit} maxLength={255} value={form.namaPelapor} onChange={(e) => set("namaPelapor", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ds-no-telepon-pelapor">No. Telepon PIC</label>
              <input type="text" id="ds-no-telepon-pelapor" required disabled={!isEdit} maxLength={50} value={form.noTeleponPelapor} onChange={(e) => set("noTeleponPelapor", e.target.value.replace(/[^0-9+]/g, ""))} />
            </div>
            <div className="field full">
              <label htmlFor="ds-deskripsi">Deskripsi Kerusakan</label>
              <textarea
                id="ds-deskripsi"
                required
                disabled={!isEdit}
                maxLength={2000}
                value={form.deskripsiKerusakan}
                onChange={(e) => set("deskripsiKerusakan", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.stopPropagation();
                }}
              />
            </div>
            <div className="field full">
              <label>Foto Kerusakan</label>
              {(visibleFotoKerusakan.length > 0 || (isEdit && visibleFotoKerusakan.length < MAX_FOTO_KERUSAKAN)) && (
              <div className="photo-drop-uploader">
                {isEdit && visibleFotoKerusakan.length < MAX_FOTO_KERUSAKAN && (
                  <PhotoDropUploader
                    id="ds-foto-kerusakan-add"
                    files={newFotoFiles}
                    onChange={setNewFotoFiles}
                    maxFiles={MAX_FOTO_KERUSAKAN - visibleFotoKerusakan.length}
                    totalMax={MAX_FOTO_KERUSAKAN}
                  />
                )}
                {visibleFotoKerusakan.length > 0 && (
                  <div className="photo-drop-list">
                    {visibleFotoKerusakan.map((foto, index) => (
                      <div className="photo-drop-item photo-drop-item-existing" key={foto.id}>
                        <span className="photo-drop-item-index">{newFotoFiles.length + index + 1}.</span>
                        <a href={api.saranaFotoKerusakanUrl(item.id, foto.id)} target="_blank" rel="noopener noreferrer" className="photo-drop-item-thumb">
                          <img src={api.saranaFotoKerusakanUrl(item.id, foto.id)} alt={foto.originalFilename} />
                        </a>
                        <div className="photo-drop-item-info">
                          <a href={api.saranaFotoKerusakanUrl(item.id, foto.id)} target="_blank" rel="noopener noreferrer" className="photo-drop-item-name">
                            {foto.originalFilename}
                          </a>
                        </div>
                        <CheckCircle2 width={18} height={18} className="photo-drop-item-check" />
                        {isEdit && (
                          <button type="button" className="photo-drop-item-remove" aria-label="Hapus foto" onClick={() => handleRemoveFoto(foto.id)}>
                            <Trash2 width={14} height={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
            <div className="field full">
              <label htmlFor="ds-catatan">Catatan</label>
              <input type="text" id="ds-catatan" disabled={!isEdit} maxLength={255} placeholder={isEdit ? "Contoh: Mohon Segera Diproses" : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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

          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            {canSubmitDraft && (
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft} disabled={busy}>Submit</button>
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
              <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
            )}
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
