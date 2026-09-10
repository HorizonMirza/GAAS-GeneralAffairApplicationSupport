"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  EXECUTION_STAGE_LABEL,
  KATEGORI_KERUSAKAN_LABEL,
  isSaranaEditableByOrigin,
  isSaranaExecutionActor,
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
import { useConfirm } from "./ui/ConfirmProvider";
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
  const [execNote, setExecNote] = useState("");
  const [gambarFile, setGambarFile] = useState<File | null>(null);
  const [fotoSelesaiFile, setFotoSelesaiFile] = useState<File | null>(null);
  const [fotoKerusakan, setFotoKerusakan] = useState<PerbaikanSaranaFotoKerusakan[]>([]);
  const [newFotoFiles, setNewFotoFiles] = useState<File[]>([]);
  const [fotoBusy, setFotoBusy] = useState(false);
  const { showToast } = useToast();
  const confirm = useConfirm();
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
    setExecNote("");
    setGambarFile(null);
    setFotoSelesaiFile(null);
    setNewFotoFiles([]);
    api.listFotoKerusakanSarana(item.id).then(setFotoKerusakan).catch(() => setFotoKerusakan([]));
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
    setBusy(true);
    try {
      await api.submitSarana(item!.id);
      showToast("Laporan berhasil dikirim untuk approval");
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
      showToast("Laporan berhasil di-approve, diteruskan ke Admin GA");
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
    const file = fotoSelesaiFile;
    onClose();
    try {
      await api.eksekusiSarana(item!.id, note, file);
      showToast("Eksekusi perbaikan ditandai selesai");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  // Koreksi kalau salah unggah foto/salah tandai tahap - memundurkan ExecutionStage satu langkah
  // (lihat PerbaikanSaranaController.ResetEksekusi). Confirm dulu karena foto/catatan tahap yang
  // dibatalkan itu hilang begitu backend memprosesnya.
  function handleResetEksekusi() {
    confirm(
      "Batalkan tahap eksekusi terakhir? Foto/catatan pada tahap ini akan hilang dan tahap akan mundur satu langkah.",
      async () => {
        onClose();
        try {
          await api.resetEksekusiSarana(item!.id, null);
          showToast("Tahap eksekusi terakhir dibatalkan");
          onSaved();
        } catch (err) {
          showToast((err as Error).message, "error");
        }
      },
      "Batalkan"
    );
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateSarana(item!.id, { ...form!, catatan: form!.catatan || null });
      showToast("Laporan berhasil diperbarui");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function handleAddFoto() {
    if (newFotoFiles.length === 0) return;
    setFotoBusy(true);
    try {
      await api.uploadFotoKerusakanSarana(item!.id, newFotoFiles);
      const list = await api.listFotoKerusakanSarana(item!.id);
      setFotoKerusakan(list);
      setNewFotoFiles([]);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setFotoBusy(false);
    }
  }

  function handleRemoveFoto(fotoId: number) {
    confirm(
      "Hapus foto kerusakan ini?",
      async () => {
        try {
          await api.deleteFotoKerusakanSarana(item!.id, fotoId);
          const list = await api.listFotoKerusakanSarana(item!.id);
          setFotoKerusakan(list);
        } catch (err) {
          showToast((err as Error).message, "error");
        }
      },
      "Hapus"
    );
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
            <div className="field">
              <label htmlFor="ds-lokasi">Lokasi</label>
              <input type="text" id="ds-lokasi" required disabled={!isEdit} maxLength={255} value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ds-nama-pelapor">Nama Pelapor</label>
              <input type="text" id="ds-nama-pelapor" required disabled={!isEdit} maxLength={255} value={form.namaPelapor} onChange={(e) => set("namaPelapor", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ds-no-telepon-pelapor">No. Telepon Pelapor</label>
              <input type="text" id="ds-no-telepon-pelapor" required disabled={!isEdit} maxLength={50} value={form.noTeleponPelapor} onChange={(e) => set("noTeleponPelapor", e.target.value)} />
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
              {fotoKerusakan.length > 0 && (
                <div className="photo-drop-list">
                  {fotoKerusakan.map((foto, index) => (
                    <div className="photo-drop-item" key={foto.id}>
                      <div className="photo-drop-item-thumb">
                        <img src={api.saranaFotoKerusakanUrl(item.id, foto.id)} alt={foto.originalFilename} />
                      </div>
                      <div className="photo-drop-item-info">
                        <a href={api.saranaFotoKerusakanUrl(item.id, foto.id)} target="_blank" rel="noopener noreferrer" className="photo-drop-item-name">
                          Foto {index + 1} &middot; {foto.originalFilename}
                        </a>
                      </div>
                      {isEdit && (
                        <button type="button" className="photo-drop-item-remove" aria-label="Hapus foto" onClick={() => handleRemoveFoto(foto.id)}>
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isEdit && fotoKerusakan.length < MAX_FOTO_KERUSAKAN && (
                <div style={{ marginTop: 8 }}>
                  <PhotoDropUploader
                    id="ds-foto-kerusakan-add"
                    files={newFotoFiles}
                    onChange={setNewFotoFiles}
                    maxFiles={MAX_FOTO_KERUSAKAN - fotoKerusakan.length}
                  />
                  {newFotoFiles.length > 0 && (
                    <button type="button" className="btn btn-approve" style={{ width: "auto", marginTop: 8 }} disabled={fotoBusy} onClick={handleAddFoto}>
                      Tambah Foto
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="field full">
              <label htmlFor="ds-catatan">Catatan</label>
              <input type="text" id="ds-catatan" disabled={!isEdit} maxLength={255} placeholder={isEdit ? "Contoh: Mohon diperbaiki sebelum rapat Jumat" : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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

          {item.status === "APPROVED_GA_APPROVAL" && (
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>
                  Eksekusi Perbaikan: {EXECUTION_STAGE_LABEL[item.executionStage]}
                </div>
                {canExecute && item.executionStage !== "MENUNGGU" && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ width: "auto", fontSize: "0.75rem", padding: "4px 10px" }}
                    onClick={handleResetEksekusi}
                  >
                    Batalkan Tahap Terakhir
                  </button>
                )}
              </div>
              {item.gambarOriginalFilename && (
                <div style={{ marginBottom: 8 }}>
                  <a href={api.saranaGambarUrl(item.id)} target="_blank" rel="noopener noreferrer">
                    Lihat Gambar Rencana Perbaikan
                  </a>
                </div>
              )}
              {item.fotoSelesaiOriginalFilename && (
                <div style={{ marginBottom: 8 }}>
                  <a href={api.saranaFotoSelesaiUrl(item.id)} target="_blank" rel="noopener noreferrer">
                    Lihat Foto Hasil Perbaikan
                  </a>
                </div>
              )}
              {canExecute && item.executionStage === "MENUNGGU" && (
                <>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label htmlFor="ds-exec-note-cek">Catatan Hasil Cek Lokasi</label>
                    <textarea
                      id="ds-exec-note-cek"
                      placeholder="Opsional"
                      value={execNote}
                      onChange={(e) => setExecNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.stopPropagation();
                      }}
                    />
                  </div>
                  <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleCekLokasi}>
                    Tandai Lokasi Sudah Dicek
                  </button>
                </>
              )}
              {canExecute && item.executionStage === "LOKASI_DICEK" && (
                <>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label htmlFor="ds-exec-gambar">Gambar Rencana Perbaikan</label>
                    <input
                      type="file"
                      id="ds-exec-gambar"
                      accept="image/jpeg,image/png"
                      onChange={(e) => setGambarFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label htmlFor="ds-exec-note-gambar">Catatan Gambar Rencana Perbaikan</label>
                    <textarea
                      id="ds-exec-note-gambar"
                      placeholder="Opsional"
                      value={execNote}
                      onChange={(e) => setExecNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.stopPropagation();
                      }}
                    />
                  </div>
                  <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleUploadGambar}>
                    Unggah Gambar
                  </button>
                </>
              )}
              {canExecute && item.executionStage === "GAMBAR_DIBUAT" && (
                <>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label htmlFor="ds-exec-foto-selesai">Foto Hasil Perbaikan (opsional)</label>
                    <input
                      type="file"
                      id="ds-exec-foto-selesai"
                      accept="image/jpeg,image/png"
                      onChange={(e) => setFotoSelesaiFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label htmlFor="ds-exec-note-selesai">Catatan Hasil Eksekusi</label>
                    <textarea
                      id="ds-exec-note-selesai"
                      placeholder="Opsional"
                      value={execNote}
                      onChange={(e) => setExecNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.stopPropagation();
                      }}
                    />
                  </div>
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
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft} disabled={busy}>Approve</button>
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
