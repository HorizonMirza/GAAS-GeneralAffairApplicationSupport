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

// Kategori starts unset (undefined) so SearchableSelect shows its placeholder instead of a
// pre-picked value - handleSubmit validates every row has one chosen before submitting, the
// same pattern RoomBookingFormModal uses for its own required-but-unset selects.
type FormItem = Omit<PermintaanArsipItemPayload, "kategori"> & { kategori: ArchiveKategori | undefined };

function emptyItem(): FormItem {
  return { namaArsip: "", kategori: undefined, tahunArsip: "", jumlah: 1, satuan: "" };
}

function emptyForm(): Omit<PermintaanArsipCreatePayload, "items"> & { items: FormItem[] } {
  return {
    tanggal: todayLocalDate(),
    jumlahArsip: 1,
    namaPic: "",
    noTeleponPic: "",
    keperluan: "",
    lokasiPenyimpanan: "",
    catatan: "",
    items: [emptyItem()],
  };
}

const MAX_ITEM_ROWS = 30;

type FormState = ReturnType<typeof emptyForm>;

export default function ArsipFormModal({ open, me, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm());
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

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setItem(index: number, patch: Partial<FormItem>) {
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
    setError("");
    if (form.items.some((row) => !row.kategori)) {
      setError("Kategori wajib dipilih untuk semua arsip");
      return;
    }
    try {
      const items: PermintaanArsipItemPayload[] = form.items.map((row) => ({ ...row, kategori: row.kategori as ArchiveKategori }));
      await api.createArsip({ ...form, items, catatan: form.catatan || null });
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
              <label htmlFor="fr-nomor-arsip">Nomor Pemindahan Arsip</label>
              <input type="text" id="fr-nomor-arsip" disabled value={nomorArsip} />
            </div>
            <div className="field">
              <label htmlFor="fr-tanggal">Tanggal</label>
              <input type="date" id="fr-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fr-jumlah-arsip">Jumlah Arsip</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="fr-jumlah-arsip"
                required
                placeholder="Masukkan Angka"
                value={form.jumlahArsip === 0 ? "" : String(form.jumlahArsip)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlahArsip", digits === "" ? 0 : Math.min(Number(digits), 9999));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="fr-nama-pic">Nama PIC</label>
              <input type="text" id="fr-nama-pic" required value={form.namaPic} onChange={(e) => set("namaPic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fr-telepon-pic">No. Telepon PIC</label>
              <input type="text" id="fr-telepon-pic" required value={form.noTeleponPic} onChange={(e) => set("noTeleponPic", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="fr-lokasi">Lokasi Penyimpanan Saat Ini</label>
              <input type="text" id="fr-lokasi" required value={form.lokasiPenyimpanan} onChange={(e) => set("lokasiPenyimpanan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="fr-keperluan">Tujuan</label>
              <input type="text" id="fr-keperluan" required placeholder="Contoh: Pemindahan arsip kontrak lama" value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>

            <div className="field full">
              <label>Form Arsip</label>
              {form.items.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid var(--border-color, #e2e2e2)",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Arsip #{idx + 1}</span>
                    <button
                      type="button"
                      className="card-icon-btn card-icon-btn-danger"
                      aria-label={`Hapus baris arsip ${idx + 1}`}
                      disabled={form.items.length <= 1}
                      style={{ flexShrink: 0, opacity: form.items.length <= 1 ? 0.4 : 1 }}
                      onClick={() => removeItemRow(idx)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                  <div>
                    <label htmlFor={`fr-nama-arsip-${idx}`}>Nama Arsip</label>
                    <input
                      type="text"
                      id={`fr-nama-arsip-${idx}`}
                      required
                      placeholder="Contoh: Kontrak Vendor 2018 - 2019"
                      value={row.namaArsip}
                      onChange={(e) => setItem(idx, { namaArsip: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`fr-kategori-${idx}`}>Kategori</label>
                    <SearchableSelect
                      id={`fr-kategori-${idx}`}
                      value={row.kategori}
                      onChange={(v) => setItem(idx, { kategori: v as ArchiveKategori })}
                      options={KATEGORI_OPTIONS}
                      getLabel={(v) => ARCHIVE_KATEGORI_LABEL[v as ArchiveKategori] || v}
                      placeholder="Pilih Kategori"
                    />
                  </div>
                  <div>
                    <label htmlFor={`fr-tahun-${idx}`}>Tahun</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      id={`fr-tahun-${idx}`}
                      required
                      placeholder="Tahun"
                      value={row.tahunArsip}
                      onChange={(e) => setItem(idx, { tahunArsip: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`fr-satuan-${idx}`}>Satuan</label>
                    <input
                      type="text"
                      id={`fr-satuan-${idx}`}
                      required
                      placeholder="Contoh: Berkas, Bendel, Box"
                      value={row.satuan}
                      onChange={(e) => setItem(idx, { satuan: e.target.value })}
                    />
                  </div>
                </div>
              ))}
              {form.items.length < MAX_ITEM_ROWS && (
                <button type="button" className="arsip-add-row-btn" onClick={addItemRow}>
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
            <button type="submit" className="btn btn-approve" style={{ width: "auto" }}>Save</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
