"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { GA_APPROVAL_ACTIONABLE_STATUSES, L1_ACTIONABLE_STATUSES, isGaActionable, originActorLabel } from "@/lib/constants";
import { formatThousandSeparator, parseThousandSeparator } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { Asuransi, Me, Pengiriman, PengirimanCreatePayload, Role } from "@/lib/types";
import type { RejectType } from "./RejectModal";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  mode: "view" | "edit";
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
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}-${mode}`);

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
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
    item.createdBy === me.id &&
    ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI", "ADMIN_GA", "APPROVAL_GA"].includes(me.role);
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI") && L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);
  const canKpuAct = !isEdit && me.role === "KPU" && item.status === "APPROVED_GA_APPROVAL";
  const showKpuSection = canKpuAct || item.status === "COMPLETED";
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
    try {
      await api.submitPengiriman(item!.id);
      showToast("Data berhasil dikirim untuk approval");
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleApproveL1() {
    onClose();
    try {
      await api.approveL1(item!.id);
      showToast("Data berhasil di-approve, diteruskan ke Admin General Affair");
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
      showToast("Data berhasil di-approve, diteruskan ke KPU");
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
      setError(asuransiApplicable ? "Lengkapi No Resi, Berat, Asuransi, dan Ongkos Kirim (Harga)." : "Lengkapi No Resi, Berat, dan Ongkos Kirim (Harga).");
      return;
    }
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
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updatePengiriman(item!.id, { ...form!, catatan: form!.catatan || null });
      showToast("Data berhasil diperbarui");
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
          <h3>{isEdit ? "Form Data Barang" : "Detail Data Barang"} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleUpdateSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="pv-nomor-transmittal">Nomor Transmittal</label>
              <input type="text" id="pv-nomor-transmittal" disabled value={item.nomorTransmittal} />
            </div>
            <div className="field">
              <label htmlFor="pv-tanggal">Tanggal</label>
              <input type="date" id="pv-tanggal" required disabled={!isEdit} value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pv-jumlah-item">Jumlah Barang</label>
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
              <label htmlFor="pv-pengirim">Nama Pengirim</label>
              <input type="text" id="pv-pengirim" required disabled={!isEdit} value={form.namaPengirim} onChange={(e) => set("namaPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pv-telepon-pengirim">No. Telepon Pengirim</label>
              <input type="text" id="pv-telepon-pengirim" required disabled={!isEdit} value={form.noTeleponPengirim} onChange={(e) => set("noTeleponPengirim", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pv-alamat-pengirim">Alamat Pengirim</label>
              <textarea id="pv-alamat-pengirim" required disabled={!isEdit} value={form.alamatPengirim} onChange={(e) => set("alamatPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pv-penerima">Nama Penerima</label>
              <input type="text" id="pv-penerima" required disabled={!isEdit} value={form.namaPenerima} onChange={(e) => set("namaPenerima", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pv-telepon">No. Telepon Penerima</label>
              <input type="text" id="pv-telepon" required disabled={!isEdit} value={form.noTeleponPenerima} onChange={(e) => set("noTeleponPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pv-alamat">Alamat Penerima</label>
              <textarea id="pv-alamat" required disabled={!isEdit} value={form.alamatPenerima} onChange={(e) => set("alamatPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pv-tujuan">Tujuan</label>
              <input type="text" id="pv-tujuan" required disabled={!isEdit} value={form.tujuanPenerimaan} onChange={(e) => set("tujuanPenerimaan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="pv-kode-program">Kode Program</label>
              <input type="text" id="pv-kode-program" required disabled={!isEdit} value={form.kodeProgram} onChange={(e) => set("kodeProgram", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pv-asuransi">Asuransi</label>
              <select id="pv-asuransi" required disabled={!isEdit} value={form.asuransiStatus} onChange={(e) => set("asuransiStatus", e.target.value as Asuransi)}>
                <option value="Tidak">Tidak</option>
                <option value="Ya">Ya</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pv-packing">Pengemasan Tambahan</label>
              <select id="pv-packing" required disabled={!isEdit} value={form.requestPacking} onChange={(e) => set("requestPacking", e.target.value)}>
                <option value="Tidak">Tidak</option>
                <option value="Tambahan Kayu">Tambahan Kayu</option>
              </select>
            </div>
            <div className="field full">
              <label htmlFor="pv-catatan">Catatan</label>
              <input type="text" id="pv-catatan" disabled={!isEdit} placeholder={isEdit ? "Contoh: Request JNE Instant" : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          {showKpuSection && (
            <div style={{ marginTop: 6, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem", color: "var(--text-secondary)" }}>Form Resi &amp; Biaya (KPU)</h4>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="pv-k-resi">No Resi</label>
                  <input type="text" id="pv-k-resi" placeholder="Contoh: AWB123456" disabled={!canKpuAct} value={kResi} onChange={(e) => setKResi(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="pv-k-berat">Berat Barang (Kg)</label>
                  <input type="text" inputMode="decimal" id="pv-k-berat" placeholder="Contoh: 2,5" disabled={!canKpuAct} value={kBerat} onChange={(e) => handleBeratChange(e.target.value)} />
                </div>
                <div className={`field ${asuransiApplicable ? "" : "field-strike"}`}>
                  <label htmlFor="pv-k-asuransi-harga">Asuransi (Harga)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="pv-k-asuransi-harga"
                    disabled={!canKpuAct || !asuransiApplicable}
                    placeholder={asuransiApplicable ? "" : "Anda tidak menggunakan asuransi"}
                    value={kAsuransi}
                    onChange={(e) => handleAsuransiChange(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="pv-k-subtotal">Ongkos Kirim (Harga)</label>
                  <input type="text" inputMode="numeric" id="pv-k-subtotal" disabled={!canKpuAct} value={kSubtotal} onChange={(e) => handleSubtotalChange(e.target.value)} />
                </div>
                <div className="field full">
                  <label htmlFor="pv-k-total">Total</label>
                  <input type="text" id="pv-k-total" readOnly value={kTotal} />
                </div>
              </div>
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
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "l1", originActorLabel(item), item.createdByRole); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveL1}>Approve</button>
              </>
            )}
            {canGaAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "ga", originActorLabel(item), item.createdByRole); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGa}>Approve</button>
              </>
            )}
            {canGaApprovalAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "ga-approval", originActorLabel(item), item.createdByRole); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGaApproval}>Approve</button>
              </>
            )}
            {canKpuAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "kpu", originActorLabel(item), item.createdByRole); }}>Reject</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleKpuApprove}>Approve</button>
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
