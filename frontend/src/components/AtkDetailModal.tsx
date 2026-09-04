"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ATK_CATALOG, ATK_CATALOG_DATALIST_ID } from "@/lib/atkCatalog";
import {
  GA_APPROVAL_ACTIONABLE_STATUSES,
  L1_ACTIONABLE_STATUSES,
  SUMBER_PEMBELIAN_LABEL,
  atkOriginActorLabel,
  isAtkEditableByOrigin,
  isAtkGaActionable,
  isAtkKpuActionable,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { Me, PermintaanAtk, PermintaanAtkCreatePayload, PermintaanAtkItemPayload, SumberPembelian } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import type { RejectType } from "./RejectModal";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

// Exact-match lookup only (typing something not in the catalog just stays free text) - used to
// auto-fill Satuan the moment a row's Nama Barang matches one of the 200 starter items.
const ATK_CATALOG_BY_NAME = new Map(ATK_CATALOG.map((i) => [i.namaBarang, i.satuan]));

const SUMBER_PEMBELIAN_OPTIONS: SumberPembelian[] = ["KPU", "PADI"];

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
  const [sumberPembelian, setSumberPembelian] = useState<SumberPembelian | "">("");
  const [error, setError] = useState("");
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
    setSumberPembelian("");
    setError("");
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isAtkEditableByOrigin(item, me);
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI") && L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isAtkGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);
  const canKpuAct = !isEdit && me.role === "KPU" && isAtkKpuActionable(item);
  // Submit's own self-skip (see PermintaanAtkController.Submit) lands an Admin/Approval GA's own
  // draft straight past the tier where SumberPembelian is normally captured (ApproveGa), so this
  // is the only remaining place to still ask for it on that path.
  const submitNeedsSumberPembelian = canSubmitDraft && (me.role === "ADMIN_GA" || me.role === "APPROVAL_GA");

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
    if (submitNeedsSumberPembelian && !sumberPembelian) {
      setError("Sumber pembelian wajib dipilih");
      return;
    }
    try {
      await api.submitAtk(item!.id, submitNeedsSumberPembelian ? (sumberPembelian as SumberPembelian) : null);
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
    if (!sumberPembelian) {
      setError("Sumber pembelian wajib dipilih");
      return;
    }
    onClose();
    try {
      await api.approveAtkGa(item!.id, sumberPembelian);
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
      showToast("Permintaan berhasil di-approve, diteruskan ke Mitra");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveKpu() {
    onClose();
    try {
      await api.approveAtkKpu(item!.id);
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
                <div key={idx} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <input
                    type="text"
                    aria-label={`Nama barang ${idx + 1}`}
                    required
                    disabled={!isEdit}
                    list={ATK_CATALOG_DATALIST_ID}
                    placeholder="Nama barang"
                    style={{ flex: "3 1 180px", minWidth: 180 }}
                    value={row.namaBarang}
                    onChange={(e) => {
                      const namaBarang = e.target.value;
                      const catalogSatuan = ATK_CATALOG_BY_NAME.get(namaBarang);
                      setItem(idx, catalogSatuan && !row.satuan ? { namaBarang, satuan: catalogSatuan } : { namaBarang });
                    }}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`Jumlah barang ${idx + 1}`}
                    required
                    disabled={!isEdit}
                    placeholder="Jumlah"
                    style={{ flex: "1 1 80px", minWidth: 80 }}
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
                    style={{ flex: "1.5 1 110px", minWidth: 110 }}
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

          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL", "COMPLETED"].includes(item.status) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Diajukan:</strong> {formatDateTime(item.createdAt)}
            </div>
          )}

          {(canGaAct || submitNeedsSumberPembelian) && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="da-sumber-pembelian">Sumber Pembelian</label>
              <SearchableSelect
                id="da-sumber-pembelian"
                value={sumberPembelian}
                onChange={(v) => setSumberPembelian(v as SumberPembelian)}
                options={SUMBER_PEMBELIAN_OPTIONS}
                getLabel={(v) => SUMBER_PEMBELIAN_LABEL[v as SumberPembelian]}
                placeholder="Pilih sumber pembelian"
              />
            </div>
          )}

          {!canGaAct && !submitNeedsSumberPembelian && item.sumberPembelian && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Sumber Pembelian:</strong> {SUMBER_PEMBELIAN_LABEL[item.sumberPembelian]}
            </div>
          )}

          {item.rejectReason && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>Catatan Penolakan:</strong> {item.rejectReason}
            </div>
          )}

          <div className="error-text">{error}</div>
          <div className="modal-actions">
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
            {canKpuAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "atk-kpu", atkOriginActorLabel(item)); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveKpu}>Approve</button>
              </>
            )}
            {isEdit && (
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan</button>
            )}
          </div>
        </form>

        <datalist id={ATK_CATALOG_DATALIST_ID}>
          {ATK_CATALOG.map((i) => (
            <option key={i.namaBarang} value={i.namaBarang} />
          ))}
        </datalist>
      </div>
    </ModalOverlay>
  );
}
