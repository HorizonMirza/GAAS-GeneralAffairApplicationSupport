"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { ATK_CATALOG } from "@/lib/atkCatalog";
import {
  GA_APPROVAL_ACTIONABLE_STATUSES,
  KATEGORI_ATK_LABEL,
  L1_ACTIONABLE_STATUSES,
  SUMBER_PEMBELIAN_LABEL,
  atkOriginActorLabel,
  isAtkEditableByOrigin,
  isAtkGaActionable,
  isAtkKpuActionable,
} from "@/lib/constants";
import { formatDateTime, formatThousandSeparator, parseThousandSeparator } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { AtkKategori, Me, PermintaanAtk, PermintaanAtkCreatePayload, PermintaanAtkItemPayload, SumberPembelian } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import type { RejectType } from "./RejectModal";
import SearchableSelect from "./SearchableSelect";
import TextAutocomplete from "./TextAutocomplete";
import { useToast } from "./ui/ToastProvider";

// Satuan is no longer a field the user fills in by hand - it's derived silently from the catalog
// the moment Nama Barang matches one of the 200 starter items, falling back to "pcs" (the most
// common unit in the catalog) for anything typed that isn't an exact match.
const ATK_CATALOG_BY_NAME = new Map(ATK_CATALOG.map((i) => [i.namaBarang, i.satuan]));
const ATK_CATALOG_NAMES = ATK_CATALOG.map((i) => i.namaBarang);
const DEFAULT_SATUAN = "pcs";

const SUMBER_PEMBELIAN_OPTIONS: SumberPembelian[] = ["KPU", "PADI"];

interface Props {
  open: boolean;
  // "edit" is the origin creator's own DRAFT/REJECTED edit (every field live). "ga-edit" is
  // Admin/Approval GA's own in-flight edit tool - Nama/No. Telepon Pemohon, Tujuan, and Daftar
  // Barang only, Tanggal/Kategori/Catatan stay the origin creator's own (see
  // PermintaanAtkController.UpdateByGa).
  mode: "view" | "edit" | "ga-edit";
  item: PermintaanAtk | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string) => void;
}

const KATEGORI_OPTIONS = Object.keys(KATEGORI_ATK_LABEL) as AtkKategori[];

const MAX_ITEM_ROWS = 10;

function toFormFields(item: PermintaanAtk): PermintaanAtkCreatePayload {
  return {
    tanggal: item.tanggal,
    kategori: item.kategori,
    keperluan: item.keperluan,
    namaPemohon: item.namaPemohon,
    noTeleponPemohon: item.noTeleponPemohon,
    catatan: item.catatan || "",
    items: item.items.map((i) => ({ namaBarang: i.namaBarang, jumlah: i.jumlah, satuan: i.satuan })),
  };
}

export default function AtkDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<PermintaanAtkCreatePayload | null>(null);
  const [sumberPembelian, setSumberPembelian] = useState<SumberPembelian | "">("");
  const [totalHargaBarang, setTotalHargaBarang] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
    setSumberPembelian(item.sumberPembelian || "");
    setTotalHargaBarang(item.totalHargaBarang ? formatThousandSeparator(String(Math.round(item.totalHargaBarang))) : "");
    setError("");
    setBusy(false);
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isOriginEdit = mode === "edit";
  const isGaEdit = mode === "ga-edit";
  const isEdit = isOriginEdit || isGaEdit;
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
    setBusy(true);
    try {
      await api.submitAtk(item!.id, submitNeedsSumberPembelian ? (sumberPembelian as SumberPembelian) : null);
      showToast("Pesanan berhasil dikirim untuk approval");
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
      await api.approveAtkL1(item!.id);
      showToast("Pesanan berhasil di-approve, diteruskan ke Admin GA");
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
      showToast("Pesanan berhasil di-approve, diteruskan ke Approval General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGaApproval() {
    if (!sumberPembelian) {
      setError("Sumber pembelian wajib dipilih");
      return;
    }
    onClose();
    try {
      await api.approveAtkGaApproval(item!.id, sumberPembelian);
      showToast("Pesanan berhasil di-approve, diteruskan ke Mitra");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveKpu() {
    const digits = parseThousandSeparator(totalHargaBarang.trim());
    if (!digits || Number(digits) <= 0) {
      setError("Total harga barang wajib diisi");
      return;
    }
    onClose();
    try {
      await api.approveAtkKpu(item!.id, Number(digits));
      showToast("Pesanan Kebutuhan Kantor berhasil disetujui");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isGaEdit) {
        await api.updateAtkByGa(item!.id, {
          namaPemohon: form!.namaPemohon,
          noTeleponPemohon: form!.noTeleponPemohon,
          keperluan: form!.keperluan,
          items: form!.items,
        });
      } else {
        await api.updateAtk(item!.id, { ...form!, catatan: form!.catatan || null });
      }
      showToast("Pesanan berhasil diperbarui");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? "Form Pesanan Kebutuhan Kantor" : "Detail Pesanan Kebutuhan Kantor"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleUpdateSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="da-nomor-permintaan">Nomor Pesanan {isGaEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input type="text" id="da-nomor-permintaan" disabled value={item.nomorPermintaan || ""} />
            </div>
            <div className="field">
              <label htmlFor="da-tanggal">Tanggal {isGaEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <DateFilterPicker id="da-tanggal" disabled={!isOriginEdit} clearable={false} value={form.tanggal} onChange={(v) => set("tanggal", v)} />
            </div>
            <div className="field">
              <label htmlFor="da-kategori">Kategori {isGaEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <SearchableSelect
                id="da-kategori"
                disabled={!isOriginEdit}
                value={form.kategori}
                onChange={(v) => set("kategori", v as AtkKategori)}
                options={KATEGORI_OPTIONS}
                getLabel={(v) => KATEGORI_ATK_LABEL[v as AtkKategori] || v}
                placeholder="Pilih Kategori"
              />
            </div>
            <div className="field">
              <label htmlFor="da-nama-pemohon">Nama PIC {isGaEdit && <Pencil className="field-edit-icon" width={12} height={12} />}</label>
              <input type="text" id="da-nama-pemohon" required disabled={!isEdit} maxLength={255} value={form.namaPemohon} onChange={(e) => set("namaPemohon", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="da-no-telepon-pemohon">No. Telepon PIC {isGaEdit && <Pencil className="field-edit-icon" width={12} height={12} />}</label>
              <input type="text" id="da-no-telepon-pemohon" required disabled={!isEdit} maxLength={50} value={form.noTeleponPemohon} onChange={(e) => set("noTeleponPemohon", e.target.value.replace(/[^0-9+]/g, ""))} />
            </div>
            <div className="field full">
              <label htmlFor="da-keperluan">Tujuan {isGaEdit && <Pencil className="field-edit-icon" width={12} height={12} />}</label>
              <input type="text" id="da-keperluan" required disabled={!isEdit} maxLength={150} value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>

            <div className="field full">
              <label>Daftar Barang {isGaEdit && <Pencil className="field-edit-icon" width={12} height={12} />}</label>
              <div className="photo-drop-uploader">
                <div className="item-row-list">
                  {form.items.map((row, idx) => (
                    <div key={idx} className="item-row">
                      <div className="item-row-field item-row-col-lg">
                        <label htmlFor={`da-nama-barang-${idx}`}>Nama Barang</label>
                        <TextAutocomplete
                          id={`da-nama-barang-${idx}`}
                          ariaLabel={`Nama barang ${idx + 1}`}
                          required
                          disabled={!isEdit}
                          maxLength={255}
                          options={ATK_CATALOG_NAMES}
                          placeholder="Contoh: Pulpen"
                          value={row.namaBarang}
                          onChange={(namaBarang) => {
                            setItem(idx, { namaBarang, satuan: ATK_CATALOG_BY_NAME.get(namaBarang) || DEFAULT_SATUAN });
                          }}
                        />
                      </div>
                      <div className="item-row-field item-row-col-sm">
                        <label htmlFor={`da-jumlah-${idx}`}>Jumlah</label>
                        <input
                          type="text"
                          id={`da-jumlah-${idx}`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label={`Jumlah barang ${idx + 1}`}
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
                      {isEdit && (
                        <button
                          type="button"
                          className="card-icon-btn card-icon-btn-danger item-row-delete-btn"
                          aria-label={`Hapus baris barang ${idx + 1}`}
                          disabled={form.items.length <= 1}
                          style={{ opacity: form.items.length <= 1 ? 0.4 : 1 }}
                          onClick={() => removeItemRow(idx)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {isEdit && form.items.length < MAX_ITEM_ROWS && (
                  <button type="button" className="btn btn-secondary" style={{ width: "100%", marginTop: 12 }} onClick={addItemRow}>
                    + Tambah Barang
                  </button>
                )}
              </div>
            </div>

            <div className="field full">
              <label htmlFor="da-catatan">Catatan {isGaEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input type="text" id="da-catatan" disabled={!isOriginEdit} maxLength={255} placeholder="Contoh: Stok Menipis" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>

            {(canGaAct || submitNeedsSumberPembelian || canGaApprovalAct || item.sumberPembelian) && (
              <>
                <div className="field full form-grid-divider" />
                {canGaAct || submitNeedsSumberPembelian || canGaApprovalAct ? (
                  <div className="field full">
                    <label htmlFor="da-sumber-pembelian">Sumber Pembelian</label>
                    <SearchableSelect
                      id="da-sumber-pembelian"
                      value={sumberPembelian}
                      onChange={(v) => setSumberPembelian(v as SumberPembelian)}
                      options={SUMBER_PEMBELIAN_OPTIONS}
                      getLabel={(v) => SUMBER_PEMBELIAN_LABEL[v as SumberPembelian]}
                      placeholder="Pilih Sumber Pembelian"
                    />
                  </div>
                ) : (
                  item.sumberPembelian && (
                    <div className="field full">
                      <label>Sumber Pembelian</label>
                      <input type="text" disabled value={SUMBER_PEMBELIAN_LABEL[item.sumberPembelian]} />
                    </div>
                  )
                )}
              </>
            )}

            {(canKpuAct || item.totalHargaBarang) && (
              canKpuAct ? (
                <div className="field full">
                  <label htmlFor="da-total-harga-barang">Total Harga Barang</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="da-total-harga-barang"
                    placeholder="Contoh: 150.000"
                    value={totalHargaBarang}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      setTotalHargaBarang(digits ? formatThousandSeparator(digits) : "");
                    }}
                  />
                </div>
              ) : (
                item.totalHargaBarang && (
                  <div className="field full">
                    <label>Total Harga Barang</label>
                    <input type="text" disabled value={formatThousandSeparator(String(Math.round(item.totalHargaBarang)))} />
                  </div>
                )
              )
            )}
          </div>

          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL", "COMPLETED"].includes(item.status) && (
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
              <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
            )}
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
