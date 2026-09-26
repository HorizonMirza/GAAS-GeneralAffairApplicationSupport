"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { GA_APPROVAL_ACTIONABLE_STATUSES, L1_ACTIONABLE_STATUSES, isGaActionable, isValidPengirimanPhone, originActorLabel } from "@/lib/constants";
import { formatDateTime, formatThousandSeparator, parseThousandSeparator } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { Asuransi, Me, Pengiriman, PengirimanCreatePayload, Role } from "@/lib/types";
import DateFilterPicker from "./DateFilterPicker";
import ModalOverlay from "./ModalOverlay";
import type { RejectType } from "./RejectModal";
import { useToast } from "./ui/ToastProvider";
import SearchableSelect from "./SearchableSelect";

interface Props {
  open: boolean;
  // "kpu-edit" is Mitra's own post-Approved price-correction tool - only No. Resi/Berat/
  // Asuransi/Ongkos Kirim are editable, everything else (including this module's own regular
  // "edit" fields) stays the origin creator's own. See PengirimanController.KoreksiHarga.
  mode: "view" | "edit" | "kpu-edit";
  item: Pengiriman | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string, createdByRole: Role) => void;
}

function toFormFields(item: Pengiriman): PengirimanCreatePayload {
  return {
    tanggal: item.tanggal,
    jumlahItem: item.jumlahItem,
    tujuanPenerimaan: item.tujuanPenerimaan,
    namaPengirim: item.namaPengirim,
    noTeleponPengirim: item.noTeleponPengirim,
    alamatPengirim: item.alamatPengirim,
    kodeProgram: item.kodeProgram,
    namaPenerima: item.namaPenerima,
    noTeleponPenerima: item.noTeleponPenerima,
    alamatPenerima: item.alamatPenerima,
    asuransiStatus: item.asuransiStatus,
    requestPacking: item.requestPacking,
    catatan: item.catatan || "",
  };
}

export default function PengirimanDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const [form, setForm] = useState<PengirimanCreatePayload | null>(null);
  const [kResi, setKResi] = useState("");
  const [kBerat, setKBerat] = useState("");
  const [kAsuransi, setKAsuransi] = useState("");
  const [kSubtotal, setKSubtotal] = useState("");
  const [kTotal, setKTotal] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}-${mode}`);

  // useLayoutEffect (not useEffect) - form starts as null and is only hydrated here, so on the
  // very first time this modal is ever opened in a session, the component renders nothing this
  // pass (see the `!form` check below) and formRef never attaches to a real <form>. A plain
  // useEffect runs after paint with the same open/item/mode trigger as useAutofocusFirstField
  // already used on that empty pass, so it never gets a second chance to focus anything once the
  // form actually appears. useLayoutEffect's setForm call instead forces a synchronous re-render
  // before paint, so by the time useAutofocusFirstField's (deferred) effect runs, formRef already
  // points at the real, populated form.
  useLayoutEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    setBusy(false);
    setKResi(item.noResi || "");
    setKBerat(item.beratBarangKg != null ? String(item.beratBarangKg).replace(".", ",") : "");
    setKAsuransi(item.asuransiHarga ? formatThousandSeparator(String(Math.round(item.asuransiHarga))) : "");
    setKSubtotal(item.subTotal ? formatThousandSeparator(String(Math.round(item.subTotal))) : "");
    setKTotal(item.total ? formatThousandSeparator(String(Math.round(item.total))) : "");
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft =
    !isEdit &&
    item.status === "DRAFT" &&
    (me.role === "SUPER_ADMIN" ||
      (item.createdBy === me.id &&
        ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"].includes(me.role)));
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI" || me.role === "SUPER_ADMIN") && L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && (me.role === "ADMIN_GA" || me.role === "SUPER_ADMIN") && isGaActionable(item);
  const canGaApprovalAct = !isEdit && (me.role === "APPROVAL_GA" || me.role === "SUPER_ADMIN") && GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);
  const canKpuAct = !isEdit && (me.role === "KPU" || me.role === "SUPER_ADMIN") && item.status === "APPROVED_GA_APPROVAL";
  const isKpuEdit = mode === "kpu-edit";
  const showKpuSection = canKpuAct || isKpuEdit || item.status === "COMPLETED";
  const hargaFieldsEditable = canKpuAct || isKpuEdit;
  const asuransiApplicable = item.asuransiStatus === "Ya";

  function set<K extends keyof PengirimanCreatePayload>(key: K, value: PengirimanCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function recomputeTotal(asuransiStr: string, subtotalStr: string) {
    const total = Number(parseThousandSeparator(asuransiStr) || "0") + Number(parseThousandSeparator(subtotalStr) || "0");
    setKTotal(total ? formatThousandSeparator(String(total)) : "");
  }

  function handleBeratChange(value: string) {
    let v = value.replace(/[^0-9,]/g, "");
    const firstComma = v.indexOf(",");
    if (firstComma !== -1) {
      v = v.slice(0, firstComma + 1) + v.slice(firstComma + 1).replace(/,/g, "");
    }
    setKBerat(v);
  }

  function handleAsuransiChange(value: string) {
    const digits = value.replace(/\D/g, "");
    const formatted = digits ? formatThousandSeparator(digits) : "";
    setKAsuransi(formatted);
    recomputeTotal(formatted, kSubtotal);
  }

  function handleSubtotalChange(value: string) {
    const digits = value.replace(/\D/g, "");
    const formatted = digits ? formatThousandSeparator(digits) : "";
    setKSubtotal(formatted);
    recomputeTotal(kAsuransi, formatted);
  }

  async function handleSubmitDraft() {
    setBusy(true);
    try {
      await api.submitPengiriman(item!.id);
      showToast("Data berhasil dikirim untuk approval");
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
      await api.approveL1(item!.id);
      showToast("Data berhasil di-approve, diteruskan ke Admin GA");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGa() {
    onClose();
    try {
      await api.approveGa(item!.id);
      showToast("Data berhasil di-approve, diteruskan ke Approval General Affair");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGaApproval() {
    onClose();
    try {
      await api.approveGaApproval(item!.id);
      showToast("Data berhasil di-approve, diteruskan ke Mitra");
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleKpuApprove() {
    const noResi = kResi.trim();
    const beratStr = kBerat.trim();
    const asuransiStr = parseThousandSeparator(kAsuransi.trim());
    const subTotalStr = parseThousandSeparator(kSubtotal.trim());
    const totalStr = parseThousandSeparator(kTotal.trim());
    if (!noResi || !beratStr || subTotalStr === "" || (asuransiApplicable && asuransiStr === "")) {
      setError(asuransiApplicable ? "Lengkapi No Resi, Berat, Harga Asuransi, dan Harga Ongkos Kirim." : "Lengkapi No Resi, Berat, dan Harga Ongkos Kirim.");
      return;
    }
    if (!(Number(beratStr.replace(",", ".")) > 0)) {
      setError("Berat barang harus lebih dari 0");
      return;
    }
    if (!(Number(subTotalStr) > 0)) {
      setError("Harga ongkos kirim harus lebih dari 0");
      return;
    }
    setBusy(true);
    try {
      await api.approveKpu(item!.id, {
        noResi,
        beratBarangKg: Number(beratStr.replace(",", ".")),
        asuransiHarga: Number(asuransiStr || "0"),
        subTotal: Number(subTotalStr),
        total: Number(totalStr || "0"),
      });
      showToast("Data berhasil di-approve & resi dicetak");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function handleKoreksiHarga() {
    const noResi = kResi.trim();
    const beratStr = kBerat.trim();
    const asuransiStr = parseThousandSeparator(kAsuransi.trim());
    const subTotalStr = parseThousandSeparator(kSubtotal.trim());
    if (!noResi || !beratStr || subTotalStr === "" || (asuransiApplicable && asuransiStr === "")) {
      setError(asuransiApplicable ? "Lengkapi No Resi, Berat, Harga Asuransi, dan Harga Ongkos Kirim." : "Lengkapi No Resi, Berat, dan Harga Ongkos Kirim.");
      return;
    }
    if (!(Number(beratStr.replace(",", ".")) > 0)) {
      setError("Berat barang harus lebih dari 0");
      return;
    }
    if (!(Number(subTotalStr) > 0)) {
      setError("Harga ongkos kirim harus lebih dari 0");
      return;
    }
    const totalStr = parseThousandSeparator(kTotal.trim());
    setBusy(true);
    try {
      await api.koreksiHargaPengiriman(item!.id, {
        noResi,
        beratBarangKg: Number(beratStr.replace(",", ".")),
        asuransiHarga: Number(asuransiStr || "0"),
        subTotal: Number(subTotalStr),
        total: Number(totalStr || "0"),
      });
      showToast("Harga berhasil dikoreksi");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  // Every workflow action below is `type="submit"` (Reject stays `type="button"` - a destructive
  // action should never fire just because Enter was pressed in a text field), so this one handler
  // is what Enter actually triggers no matter which single action currently applies - Save in Edit
  // mode, Submit for a DRAFT's own creator, or Approve for whichever tier is reviewing right now.
  // The conditions mirror the buttons rendered in modal-actions below and are mutually exclusive.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (isEdit) {
      if (form!.jumlahItem <= 0) {
        setError("Jumlah barang harus lebih dari 0");
        return;
      }
      if (!form!.namaPengirim.trim()) {
        setError("Nama pengirim wajib diisi");
        return;
      }
      if (!isValidPengirimanPhone(form!.noTeleponPengirim)) {
        setError("Nomor telepon pengirim tidak valid");
        return;
      }
      if (!form!.namaPenerima.trim()) {
        setError("Nama penerima wajib diisi");
        return;
      }
      if (!isValidPengirimanPhone(form!.noTeleponPenerima)) {
        setError("Nomor telepon penerima tidak valid");
        return;
      }
      setBusy(true);
      try {
        await api.updatePengiriman(item!.id, { ...form!, catatan: form!.catatan || null });
        showToast("Data berhasil diperbarui");
        onClose();
        onSaved();
      } catch (err) {
        setError((err as Error).message);
        setBusy(false);
      }
      return;
    }
    if (isKpuEdit) return handleKoreksiHarga();
    if (canSubmitDraft) return handleSubmitDraft();
    if (canL1Act) return handleApproveL1();
    if (canGaAct) return handleApproveGa();
    if (canGaApprovalAct) return handleApproveGaApproval();
    if (canKpuAct) return handleKpuApprove();
  }

  // focusNextFieldOnEnter only preventDefault()s when it moves focus to the *next* field - on the
  // last one it deliberately falls through to the browser's native "Enter submits the form"
  // behavior. That's fine for a plain data-entry form, but here it silently fires a real workflow
  // action (Save/Submit/Approve) just from finishing a sentence in the last text field (e.g.
  // Catatan) and hitting Enter out of habit. Stop that fallback for every text field; Enter on an
  // actually-focused button (Tab'd to Submit/Approve on purpose) is untouched.
  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    focusNextFieldOnEnter(e);
    const target = e.target as HTMLElement;
    if (e.key === "Enter" && (target.tagName === "INPUT" || target.tagName === "SELECT")) {
      e.preventDefault();
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{isEdit ? "Form Data Barang" : isKpuEdit ? "Koreksi Harga Pengiriman" : "Detail Data Barang"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="pv-nomor-transmittal">Nomor Transmittal {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input type="text" id="pv-nomor-transmittal" disabled value={item.nomorTransmittal} />
            </div>
            <div className="field">
              <label htmlFor="pv-tanggal">Tanggal {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <DateFilterPicker id="pv-tanggal" disabled={!isEdit} clearable={false} value={form.tanggal} onChange={(v) => set("tanggal", v)} />
            </div>
            <div className="field">
              <label htmlFor="pv-jumlah-item">Jumlah Barang {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="pv-jumlah-item"
                required
                disabled={!isEdit}
                value={form.jumlahItem === 0 ? "" : String(form.jumlahItem)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlahItem", digits === "" ? 0 : Number(digits));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="pv-pengirim">Nama Pengirim {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input type="text" id="pv-pengirim" required disabled={!isEdit} maxLength={50} value={form.namaPengirim} onChange={(e) => set("namaPengirim", e.target.value.replace(/[^A-Za-z0-9\s.'-]/g, ""))} />
            </div>
            <div className="field">
              <label htmlFor="pv-telepon-pengirim">No. Telepon Pengirim {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input
                type="text"
                inputMode="tel"
                id="pv-telepon-pengirim"
                required
                disabled={!isEdit}
                maxLength={15}
                value={form.noTeleponPengirim}
                onChange={(e) => set("noTeleponPengirim", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field full">
              <label htmlFor="pv-alamat-pengirim">Alamat Pengirim {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <textarea id="pv-alamat-pengirim" required disabled={!isEdit} maxLength={255} value={form.alamatPengirim} onChange={(e) => set("alamatPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pv-penerima">Nama Penerima {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input type="text" id="pv-penerima" required disabled={!isEdit} maxLength={50} value={form.namaPenerima} onChange={(e) => set("namaPenerima", e.target.value.replace(/[^A-Za-z0-9\s.'-]/g, ""))} />
            </div>
            <div className="field">
              <label htmlFor="pv-telepon">No. Telepon Penerima {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input
                type="text"
                inputMode="tel"
                id="pv-telepon"
                required
                disabled={!isEdit}
                maxLength={15}
                value={form.noTeleponPenerima}
                onChange={(e) => set("noTeleponPenerima", e.target.value.replace(/[^0-9+]/g, ""))}
              />
            </div>
            <div className="field full">
              <label htmlFor="pv-alamat">Alamat Penerima {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <textarea id="pv-alamat" required disabled={!isEdit} maxLength={255} value={form.alamatPenerima} onChange={(e) => set("alamatPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pv-tujuan">Tujuan {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input type="text" id="pv-tujuan" required disabled={!isEdit} maxLength={150} value={form.tujuanPenerimaan} onChange={(e) => set("tujuanPenerimaan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pv-kode-program">Kode Program {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input type="text" id="pv-kode-program" required disabled={!isEdit} value={form.kodeProgram} onChange={(e) => set("kodeProgram", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pv-asuransi">Asuransi {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <SearchableSelect
                id="pv-asuransi"
                disabled={!isEdit}
                value={form.asuransiStatus}
                onChange={(v) => set("asuransiStatus", v as Asuransi)}
                options={["Tidak", "Ya"]}
                placeholder="Tidak"
              />
            </div>
            <div className="field">
              <label htmlFor="pv-packing">Pengemasan Tambahan {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <SearchableSelect
                id="pv-packing"
                disabled={!isEdit}
                value={form.requestPacking}
                onChange={(v) => set("requestPacking", v)}
                options={["Tidak", "Tambahan Kayu"]}
                placeholder="Tidak"
              />
            </div>
            <div className="field full">
              <label htmlFor="pv-catatan">Catatan {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
              <input type="text" id="pv-catatan" disabled={!isEdit} maxLength={255} placeholder={isEdit ? "Contoh: Request JNE Instant" : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value.replace(/[^A-Za-z0-9\s]/g, ""))} />
            </div>
            {showKpuSection && (
              <>
                <div className="field full form-grid-divider" />
                <div className="field">
                  <label htmlFor="pv-k-resi">No. Resi {isKpuEdit && <Pencil className="field-edit-icon" width={12} height={12} />}</label>
                  <input type="text" id="pv-k-resi" placeholder="Contoh: AWB123456" disabled={!hargaFieldsEditable} value={kResi} onChange={(e) => setKResi(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} />
                </div>
                <div className="field">
                  <label htmlFor="pv-k-berat">Berat Barang (Kg) {isKpuEdit && <Pencil className="field-edit-icon" width={12} height={12} />}</label>
                  <input type="text" inputMode="decimal" id="pv-k-berat" placeholder="Contoh: 2,5" disabled={!hargaFieldsEditable} value={kBerat} onChange={(e) => handleBeratChange(e.target.value)} />
                </div>
                <div className={`field ${asuransiApplicable ? "" : "field-strike"}`}>
                  <label htmlFor="pv-k-asuransi-harga">Harga Asuransi {isKpuEdit && <Pencil className="field-edit-icon" width={12} height={12} />}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="pv-k-asuransi-harga"
                    disabled={!hargaFieldsEditable || !asuransiApplicable}
                    placeholder={asuransiApplicable ? "" : "Anda tidak menggunakan asuransi"}
                    value={kAsuransi}
                    onChange={(e) => handleAsuransiChange(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="pv-k-subtotal">Harga Ongkos Kirim {isKpuEdit && <Pencil className="field-edit-icon" width={12} height={12} />}</label>
                  <input type="text" inputMode="numeric" id="pv-k-subtotal" disabled={!hargaFieldsEditable} value={kSubtotal} onChange={(e) => handleSubtotalChange(e.target.value)} />
                </div>
                <div className="field full">
                  <label htmlFor="pv-k-total">Total {isKpuEdit && <Lock className="field-lock-icon" width={12} height={12} />}</label>
                  <input type="text" id="pv-k-total" disabled value={kTotal} />
                </div>
              </>
            )}
          </div>

          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL", "APPROVED_KPU", "COMPLETED"].includes(item.status) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: -8 }}>
              <strong>Diajukan:</strong> {formatDateTime(item.createdAt)}
            </div>
          )}

          {item.rejectReason && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 10 }}>
              <strong>Catatan Penolakan:</strong> {item.rejectReason}
            </div>
          )}

          {error && <div className="error-text">{error}</div>}
          {(canSubmitDraft || canL1Act || canGaAct || canGaApprovalAct || canKpuAct || isEdit || isKpuEdit) && (
            <div className="modal-actions">
              {isKpuEdit && (
                <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
              )}
              {canSubmitDraft && (
                <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Submit</button>
              )}
              {canL1Act && (
                <>
                  <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "l1", originActorLabel(item), item.createdByRole); }}>Reject</button>
                  <button type="submit" className="btn btn-approve" style={{ width: "auto" }}>Approve</button>
                </>
              )}
              {canGaAct && (
                <>
                  <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "ga", originActorLabel(item), item.createdByRole); }}>Reject</button>
                  <button type="submit" className="btn btn-approve" style={{ width: "auto" }}>Approve</button>
                </>
              )}
              {canGaApprovalAct && (
                <>
                  <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "ga-approval", originActorLabel(item), item.createdByRole); }}>Reject</button>
                  <button type="submit" className="btn btn-approve" style={{ width: "auto" }}>Approve</button>
                </>
              )}
              {canKpuAct && (
                <>
                  <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "kpu", originActorLabel(item), item.createdByRole); }}>Reject</button>
                  <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Approve</button>
                </>
              )}
              {isEdit && (
                <button type="submit" className="btn btn-approve" style={{ width: "auto" }} disabled={busy}>Save</button>
              )}
            </div>
          )}
        </form>
      </div>
    </ModalOverlay>
  );
}
