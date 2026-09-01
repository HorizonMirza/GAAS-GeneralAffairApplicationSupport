"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ARCHIVE_KATEGORI_LABEL } from "@/lib/constants";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { ArchiveKategori, Me, PermintaanArsipCreatePayload, PermintaanArsipItemPayload } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const KATEGORI_OPTIONS = Object.keys(ARCHIVE_KATEGORI_LABEL) as ArchiveKategori[];

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
}

function emptyItem(): PermintaanArsipItemPayload {
  return { namaArsip: "", kategori: "SOP", tahunArsip: "", jumlah: 1, satuan: "" };
}

function emptyForm(): PermintaanArsipCreatePayload {
  return {
    tanggal: todayLocalDate(),
    keperluan: "",
    lokasiPenyimpanan: "",
    catatan: "",
    items: [emptyItem()],
  };
}

const MAX_ITEM_ROWS = 30;

export default function ArsipFormModal({ open, me, onClose, onCreated }: Props) {
  const [form, setForm] = useState<PermintaanArsipCreatePayload>(emptyForm());
  const [error, setError] = useState("");
  const [nomorArsip, setNomorArsip] = useState("");
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, open);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextArsipNomor(form.tanggal)
      .then((r) => setNomorArsip(r.nomorArsip))
      .catch(() => setNomorArsip(""));
  }, [open, form.tanggal]);

  if (!open) return null;

  const unitName =
    me.departemen ||
    me.divisi ||
    (me.role === "ADMIN_GA" ? "Admin General Affair" : me.role === "APPROVAL_GA" ? "Approval General Affair" : "");

  function set<K extends keyof PermintaanArsipCreatePayload>(key: K, value: PermintaanArsipCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setItem(index: number, patch: Partial<PermintaanArsipItemPayload>) {
    setForm((f) => ({
      ...f,
      items: f.items.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function addItemRow() {
    setForm((f) => (f.items.length >= MAX_ITEM_ROWS ? f : { ...f, items: [...f.items, emptyItem()] }));
  }

  function removeItemRow(index: number) {
    setForm((f) => (f.items.length <= 1 ? f : { ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createArsip({ ...form, catatan: form.catatan || null });
      showToast("Permintaan pemindahan arsip berhasil disimpan sebagai Draft");
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
          <h3>Form Permintaan Pemindahan Arsip {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fr-nomor-arsip">Nomor Permintaan Arsip</label>
              <input type="text" id="fr-nomor-arsip" disabled value={nomorArsip} />
            </div>
            <div className="field">
              <label htmlFor="fr-tanggal">Tanggal</label>
              <input type="date" id="fr-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fr-keperluan">Keperluan</label>
              <input type="text" id="fr-keperluan" required placeholder="Contoh: Pemindahan arsip kontrak lama" value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="fr-lokasi">Lokasi Penyimpanan Saat Ini</label>
              <input type="text" id="fr-lokasi" required placeholder="Contoh: Lemari Arsip Divisi, Lt. 3" value={form.lokasiPenyimpanan} onChange={(e) => set("lokasiPenyimpanan", e.target.value)} />
            </div>

            <div className="field full">
              <label>Daftar Arsip</label>
              {form.items.map((row, idx) => (
                <div key={idx} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <input
                    type="text"
                    aria-label={`Nama arsip ${idx + 1}`}
                    required
                    placeholder="Nama arsip (contoh: Kontrak Vendor 2018-2019)"
                    style={{ flex: "3 1 180px", minWidth: 180 }}
                    value={row.namaArsip}
                    onChange={(e) => setItem(idx, { namaArsip: e.target.value })}
                  />
                  <div style={{ flex: "1.5 1 130px", minWidth: 130 }}>
                    <SearchableSelect
                      id={`fr-kategori-${idx}`}
                      value={row.kategori}
                      onChange={(v) => setItem(idx, { kategori: v as ArchiveKategori })}
                      options={KATEGORI_OPTIONS}
                      getLabel={(v) => ARCHIVE_KATEGORI_LABEL[v as ArchiveKategori] || v}
                      placeholder="Kategori"
                    />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`Tahun arsip ${idx + 1}`}
                    required
                    placeholder="Tahun"
                    style={{ flex: "1 1 80px", minWidth: 80 }}
                    value={row.tahunArsip}
                    onChange={(e) => setItem(idx, { tahunArsip: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`Jumlah arsip ${idx + 1}`}
                    required
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
                    aria-label={`Satuan arsip ${idx + 1}`}
                    required
                    placeholder="Satuan (boks/bendel/berkas)"
                    style={{ flex: "1.5 1 110px", minWidth: 110 }}
                    value={row.satuan}
                    onChange={(e) => setItem(idx, { satuan: e.target.value })}
                  />
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
                </div>
              ))}
              {form.items.length < MAX_ITEM_ROWS && (
                <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={addItemRow}>
                  + Tambah Arsip
                </button>
              )}
            </div>

            <div className="field full">
              <label htmlFor="fr-catatan">Catatan</label>
              <input type="text" id="fr-catatan" placeholder="Contoh: Sudah tidak dipakai sejak 2022" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
