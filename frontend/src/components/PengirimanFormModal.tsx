"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { Asuransi, Me, PengirimanCreatePayload } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
}

function emptyForm(): PengirimanCreatePayload {
  return {
    tanggal: todayLocalDate(),
    jumlahItem: 1,
    tujuanPenerimaan: "",
    namaPengirim: "",
    noTeleponPengirim: "",
    alamatPengirim: "",
    kodeProgram: "",
    namaPenerima: "",
    noTeleponPenerima: "",
    alamatPenerima: "",
    asuransiStatus: "Tidak",
    requestPacking: "Tidak",
    catatan: "",
  };
}

export default function PengirimanFormModal({ open, me, onClose, onCreated }: Props) {
  const { orgStructure } = useAuth();
  const [form, setForm] = useState<PengirimanCreatePayload>(emptyForm());
  const [error, setError] = useState("");
  const [nomorTransmittal, setNomorTransmittal] = useState("");
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, open);

  const isGaActor = me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextTransmittal(form.tanggal, isGaActor ? form.divisi : undefined)
      .then((r) => setNomorTransmittal(r.nomorTransmittal))
      .catch(() => setNomorTransmittal(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.tanggal, form.divisi]);

  if (!open) return null;

  const departemenOptions = form.divisi
    ? (orgStructure?.direktoratTree.flatMap((d) => d.divisi) || []).find((v) => v.nama === form.divisi)?.departemen || []
    : [];

  const unitName =
    me.departemen ||
    me.divisi ||
    (me.role === "ADMIN_GA" ? "Admin General Affair" : me.role === "APPROVAL_GA" ? "Approval General Affair" : "");

  function set<K extends keyof PengirimanCreatePayload>(key: K, value: PengirimanCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createPengiriman({ ...form, catatan: form.catatan || null });
      showToast("Data berhasil disimpan sebagai Draft");
      onClose();
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Form Data Barang {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="f-nomor-transmittal">Nomor Transmittal</label>
              <input type="text" id="f-nomor-transmittal" disabled value={nomorTransmittal} />
            </div>
            {isGaActor && (
              <>
                <div className="field">
                  <label htmlFor="f-divisi">Divisi</label>
                  <select
                    id="f-divisi"
                    required
                    value={form.divisi || ""}
                    onChange={(e) => setForm((f) => ({ ...f, divisi: e.target.value || undefined, departemen: undefined }))}
                  >
                    <option value="" disabled>Pilih Divisi</option>
                    {(orgStructure?.divisi || []).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-departemen">Departemen (opsional)</label>
                  <select
                    id="f-departemen"
                    disabled={!form.divisi}
                    value={form.departemen || ""}
                    onChange={(e) => set("departemen", e.target.value || undefined)}
                  >
                    <option value="">Tanpa Departemen spesifik</option>
                    {departemenOptions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="field">
              <label htmlFor="f-tanggal">Tanggal</label>
              <input type="date" id="f-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-jumlah-item">Jumlah Barang</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="f-jumlah-item"
                required
                placeholder="Masukkan angka"
                value={form.jumlahItem === 0 ? "" : String(form.jumlahItem)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlahItem", digits === "" ? 0 : Number(digits));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="f-pengirim">Nama Pengirim</label>
              <input type="text" id="f-pengirim" required value={form.namaPengirim} onChange={(e) => set("namaPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-telepon-pengirim">No. Telepon Pengirim</label>
              <input type="text" id="f-telepon-pengirim" required value={form.noTeleponPengirim} onChange={(e) => set("noTeleponPengirim", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-alamat-pengirim">Alamat Pengirim</label>
              <textarea id="f-alamat-pengirim" required value={form.alamatPengirim} onChange={(e) => set("alamatPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-penerima">Nama Penerima</label>
              <input type="text" id="f-penerima" required value={form.namaPenerima} onChange={(e) => set("namaPenerima", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-telepon">No. Telepon Penerima</label>
              <input type="text" id="f-telepon" required value={form.noTeleponPenerima} onChange={(e) => set("noTeleponPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-alamat">Alamat Penerima</label>
              <textarea id="f-alamat" required value={form.alamatPenerima} onChange={(e) => set("alamatPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-tujuan">Tujuan</label>
              <input type="text" id="f-tujuan" required placeholder="Contoh: Pengiriman Invoice Tagihan" value={form.tujuanPenerimaan} onChange={(e) => set("tujuanPenerimaan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-kode-program">Kode Program</label>
              <input type="text" id="f-kode-program" required placeholder="Contoh: 11.03.018.206.29.0313.47.09" value={form.kodeProgram} onChange={(e) => set("kodeProgram", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-asuransi">Asuransi</label>
              <select id="f-asuransi" required value={form.asuransiStatus} onChange={(e) => set("asuransiStatus", e.target.value as Asuransi)}>
                <option value="Tidak">Tidak</option>
                <option value="Ya">Ya</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-packing">Pengemasan Tambahan</label>
              <select id="f-packing" required value={form.requestPacking} onChange={(e) => set("requestPacking", e.target.value)}>
                <option value="Tidak">Tidak</option>
                <option value="Tambahan Kayu">Tambahan Kayu</option>
              </select>
            </div>
            <div className="field full">
              <label htmlFor="f-catatan">Catatan</label>
              <input type="text" id="f-catatan" placeholder="Contoh: Request JNE Instant" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
