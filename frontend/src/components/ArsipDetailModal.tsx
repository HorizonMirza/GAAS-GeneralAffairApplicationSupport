"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  ARCHIVE_KATEGORI_LABEL,
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  arsipOriginActorLabel,
  isArsipEditableByOrigin,
  isArsipGaActionable,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { ArchiveKategori, Me, PermintaanArsip, PermintaanArsipCreatePayload, PermintaanArsipItemPayload } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import type { RejectType } from "./RejectModal";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const KATEGORI_OPTIONS = Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[];

interface Props {
  open: boolean;
  mode: "view" | "edit";
  item: PermintaanArsip | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string) => void;
}

const MAX_ITEM_ROWS = 30;

function toFormFields(item: PermintaanArsip): PermintaanArsipCreatePayload {
  return {
    tanggal: item.tanggal,
    jumlahArsip: item.jumlahArsip || 0,
    namaPic: item.namaPic || "",
    noTeleponPic: item.noTeleponPic || "",
    keperluan: item.keperluan,
    lokasiPenyimpanan: item.lokasiPenyimpanan,
    catatan: item.catatan || "",
    items: item.items.map((i) => ({ namaArsip: i.namaArsip, kategori: i.kategori, tahunArsip: i.tahunArsip, jumlah: i.jumlah, satuan: i.satuan })),
  };
}

export default function ArsipDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<PermintaanArsipCreatePayload | null>(null);
  const [openItemIdx, setOpenItemIdx] = useState<number | null>(0);
  const [error, setError] = useState("");
  const [previewNomor, setPreviewNomor] = useState<string | null>(null);
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
    setOpenItemIdx(0);
    setError("");
    setPreviewNomor(null);
  }, [open, item]);

  // Nomor Pemindahan Arsip is keyed to the request's month/year (see backend's Update, which
  // regenerates it on save whenever Tanggal moves to a different month/year) - preview that same
  // recalculation live while editing so the disabled Nomor field doesn't keep showing the old
  // number as if the date change had no effect.
  useEffect(() => {
    if (!open || !item || mode !== "edit" || !form) {
      setPreviewNomor(null);
      return;
    }
    const [origY, origM] = item.tanggal.split("-");
    const [curY, curM] = form.tanggal.split("-");
    if (origY === curY && origM === curM) {
      setPreviewNomor(null);
      return;
    }
    let cancelled = false;
    api
      .nextArsipNomor(form.tanggal, item.divisi)
      .then((r) => { if (!cancelled) setPreviewNomor(r.nomorArsip); })
      .catch(() => { if (!cancelled) setPreviewNomor(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, mode, form?.tanggal]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isArsipEditableByOrigin(item, me);
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI") && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isArsipGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);

  function set<K extends keyof PermintaanArsipCreatePayload>(key: K, value: PermintaanArsipCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function setItem(index: number, patch: Partial<PermintaanArsipItemPayload>) {
    setForm((f) => (f ? { ...f, items: f.items.map((row, i) => (i === index ? { ...row, ...patch } : row)) } : f));
  }

  function addItemRow() {
    if (!form || form.items.length >= MAX_ITEM_ROWS) return;
    const newIndex = form.items.length;
    setForm((f) => {
      if (!f || f.items.length >= MAX_ITEM_ROWS) return f;
      return { ...f, items: [...f.items, { namaArsip: "", kategori: "SOP", tahunArsip: "", jumlah: 1, satuan: "" }] };
    });
    setOpenItemIdx(newIndex);
  }

  function removeItemRow(index: number) {
    if (!form || form.items.length <= 1) return;
    setForm((f) => (f && f.items.length > 1 ? { ...f, items: f.items.filter((_, i) => i !== index) } : f));
    setOpenItemIdx((cur) => (cur === null ? cur : index === cur ? null : index < cur ? cur - 1 : cur));
  }

  async function handleSubmitDraft() {
    try {
      await api.submitArsip(item!.id);
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
      await api.approveArsipL1(item!.id);
      showToast("Permintaan berhasil di-approve, diteruskan ke Admin General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGa() {
    onClose();
    try {
      await api.approveArsipGa(item!.id);
      showToast("Permintaan berhasil di-approve, diteruskan ke Approval General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGaApproval() {
    onClose();
    try {
      await api.approveArsipGaApproval(item!.id);
      showToast("Permintaan pemindahan arsip berhasil disetujui");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateArsip(item!.id, { ...form!, catatan: form!.catatan || null });
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
          <h3>{isEdit ? "Form Permintaan Pemindahan Arsip" : "Detail Permintaan Pemindahan Arsip"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleUpdateSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="dr-nomor-arsip">Nomor Pemindahan Arsip</label>
              <input type="text" id="dr-nomor-arsip" disabled value={previewNomor || item.nomorArsip || ""} />
            </div>
            <div className="field">
              <label htmlFor="dr-tanggal">Tanggal</label>
              <input type="date" id="dr-tanggal" required disabled={!isEdit} value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dr-jumlah-arsip">Jumlah Arsip</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="dr-jumlah-arsip"
                required
                disabled={!isEdit}
                value={form.jumlahArsip ? String(form.jumlahArsip) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlahArsip", digits === "" ? 0 : Math.min(Number(digits), 30));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="dr-nama-pic">Nama PIC</label>
              <input type="text" id="dr-nama-pic" required disabled={!isEdit} maxLength={50} value={form.namaPic} onChange={(e) => set("namaPic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="dr-telepon-pic">No. Telepon PIC</label>
              <input
                type="text"
                inputMode="tel"
                id="dr-telepon-pic"
                required
                disabled={!isEdit}
                maxLength={15}
                value={form.noTeleponPic}
                onChange={(e) => set("noTeleponPic", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field full">
              <label htmlFor="dr-keperluan">Keperluan</label>
              <input type="text" id="dr-keperluan" required disabled={!isEdit} maxLength={150} value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="dr-lokasi">Lokasi Penyimpanan Saat Ini</label>
              <input type="text" id="dr-lokasi" required disabled={!isEdit} maxLength={100} value={form.lokasiPenyimpanan} onChange={(e) => set("lokasiPenyimpanan", e.target.value)} />
            </div>

            <div className="field full" style={{ marginBottom: 6 }}>
              <label>Daftar Arsip</label>
              {form.items.map((row, idx) => {
                const multiple = form.items.length > 1;
                const isOpen = !multiple || openItemIdx === idx;
                return (
                <div key={idx} className="arsip-item-card">
                  <div className="arsip-item-header">
                    {multiple ? (
                      <button
                        type="button"
                        className="arsip-item-toggle"
                        aria-expanded={isOpen}
                        onClick={() => setOpenItemIdx(isOpen ? null : idx)}
                      >
                        <svg className="arsip-item-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        <span>Arsip #{idx + 1}{row.namaArsip ? ` – ${row.namaArsip}` : ""}</span>
                      </button>
                    ) : (
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Arsip #{idx + 1}</span>
                    )}
                    {isEdit && (
                      <button
                        type="button"
                        className="card-icon-btn"
                        aria-label={`Hapus baris arsip ${idx + 1}`}
                        disabled={form.items.length <= 1}
                        style={{ flexShrink: 0, opacity: form.items.length <= 1 ? 0.4 : 1 }}
                        onClick={() => removeItemRow(idx)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    )}
                  </div>
                  <div className={`arsip-item-body${isOpen ? " arsip-item-body-open" : ""}`}>
                    <div className="arsip-item-body-inner">
                      <div>
                        <label htmlFor={`dr-nama-arsip-${idx}`}>Nama Arsip</label>
                        <input
                          type="text"
                          id={`dr-nama-arsip-${idx}`}
                          required
                          disabled={!isEdit}
                          maxLength={100}
                          placeholder="Nama arsip"
                          value={row.namaArsip}
                          onChange={(e) => setItem(idx, { namaArsip: e.target.value })}
                        />
                      </div>
                      <div>
                        <label htmlFor={`dr-kategori-${idx}`}>Kategori</label>
                        <SearchableSelect
                          id={`dr-kategori-${idx}`}
                          disabled={!isEdit}
                          value={row.kategori}
                          onChange={(v) => setItem(idx, { kategori: v as ArchiveKategori })}
                          options={KATEGORI_OPTIONS}
                          getLabel={(v) => ARCHIVE_KATEGORI_LABEL[v as ArchiveKategori] || v}
                          placeholder="Kategori"
                        />
                      </div>
                      <div>
                        <label htmlFor={`dr-tahun-${idx}`}>Tahun</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          id={`dr-tahun-${idx}`}
                          required
                          disabled={!isEdit}
                          placeholder="Contoh: 2018"
                          value={row.tahunArsip}
                          onChange={(e) => setItem(idx, { tahunArsip: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        />
                      </div>
                      <div>
                        <label htmlFor={`dr-jumlah-${idx}`}>Jumlah</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          id={`dr-jumlah-${idx}`}
                          required
                          disabled={!isEdit}
                          placeholder="Jumlah"
                          value={row.jumlah === 0 ? "" : String(row.jumlah)}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                            setItem(idx, { jumlah: digits === "" ? 0 : Math.min(Number(digits), 9999) });
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor={`dr-satuan-${idx}`}>Satuan</label>
                        <input
                          type="text"
                          id={`dr-satuan-${idx}`}
                          required
                          disabled={!isEdit}
                          maxLength={50}
                          placeholder="Satuan"
                          value={row.satuan}
                          onChange={(e) => setItem(idx, { satuan: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
              {isEdit && form.items.length < MAX_ITEM_ROWS && (
                <button type="button" className="arsip-add-row-btn" onClick={addItemRow}>
                  + Tambah Arsip
                </button>
              )}
            </div>

            <div className="field full" style={{ marginBottom: 6 }}>
              <label htmlFor="dr-catatan">Catatan</label>
              <input type="text" id="dr-catatan" disabled={!isEdit} maxLength={255} placeholder={isEdit ? "Contoh: Sudah tidak dipakai sejak 2022" : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft}>Approve</button>
            )}
            {canL1Act && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "arsip-l1", arsipOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveL1}>Approve</button>
              </>
            )}
            {canGaAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "arsip-ga", arsipOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGa}>Approve</button>
              </>
            )}
            {canGaApprovalAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "arsip-ga-approval", arsipOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGaApproval}>Approve</button>
              </>
            )}
            {isEdit && (
              <button type="submit" className="btn btn-approve" style={{ width: "auto" }}>Save</button>
            )}
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
