"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ATK_CATALOG, ATK_CATALOG_DATALIST_ID } from "@/lib/atkCatalog";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { Me, PermintaanAtkCreatePayload, PermintaanAtkItemPayload } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import { useToast } from "./ui/ToastProvider";

// Exact-match lookup only (typing something not in the catalog just stays free text) - used to
// auto-fill Satuan the moment a row's Nama Barang matches one of the 200 starter items.
const ATK_CATALOG_BY_NAME = new Map(ATK_CATALOG.map((i) => [i.namaBarang, i.satuan]));

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
}

function emptyItem(): PermintaanAtkItemPayload {
  return { namaBarang: "", jumlah: 1, satuan: "" };
}

function emptyForm(): PermintaanAtkCreatePayload {
  return {
    tanggal: todayLocalDate(),
    keperluan: "",
    catatan: "",
    items: [emptyItem()],
  };
}

const MAX_ITEM_ROWS = 30;

export default function AtkFormModal({ open, me, onClose, onCreated }: Props) {
  const [form, setForm] = useState<PermintaanAtkCreatePayload>(emptyForm());
  const [error, setError] = useState("");
  const [nomorPermintaan, setNomorPermintaan] = useState("");
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
      .nextAtkNomor(form.tanggal)
      .then((r) => setNomorPermintaan(r.nomorPermintaan))
      .catch(() => setNomorPermintaan(""));
  }, [open, form.tanggal]);

  if (!open) return null;

  const unitName =
    me.departemen ||
    me.divisi ||
    (me.role === "ADMIN_GA" ? "Admin General Affair" : me.role === "APPROVAL_GA" ? "Approval General Affair" : "");

  function set<K extends keyof PermintaanAtkCreatePayload>(key: K, value: PermintaanAtkCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setItem(index: number, patch: Partial<PermintaanAtkItemPayload>) {
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
      await api.createAtk({ ...form, catatan: form.catatan || null });
      showToast("Permintaan ATK berhasil disimpan sebagai Draft");
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
          <h3>Form Permintaan ATK {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fa-nomor-permintaan">Nomor Permintaan ATK</label>
              <input type="text" id="fa-nomor-permintaan" disabled value={nomorPermintaan} />
            </div>
            <div className="field">
              <label htmlFor="fa-tanggal">Tanggal Dibutuhkan</label>
              <input type="date" id="fa-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fa-keperluan">Keperluan</label>
              <input type="text" id="fa-keperluan" required placeholder="Contoh: Kebutuhan ATK bulanan tim" value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>

            <div className="field full">
              <label>Daftar Barang</label>
              {form.items.map((row, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <input
                    type="text"
                    aria-label={`Nama barang ${idx + 1}`}
                    required
                    list={ATK_CATALOG_DATALIST_ID}
                    placeholder="Nama barang (contoh: Pulpen)"
                    style={{ flex: 3, minWidth: 0 }}
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
                    placeholder="Jumlah"
                    style={{ flex: 1, minWidth: 0 }}
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
                    placeholder="Satuan (pcs/rim/box)"
                    style={{ flex: 1.5, minWidth: 0 }}
                    value={row.satuan}
                    onChange={(e) => setItem(idx, { satuan: e.target.value })}
                  />
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
                </div>
              ))}
              {form.items.length < MAX_ITEM_ROWS && (
                <button type="button" className="btn btn-secondary" style={{ width: "auto" }} onClick={addItemRow}>
                  + Tambah Barang
                </button>
              )}
            </div>

            <div className="field full">
              <label htmlFor="fa-catatan">Catatan</label>
              <input type="text" id="fa-catatan" placeholder="Contoh: Segera di Approve" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>
          <datalist id={ATK_CATALOG_DATALIST_ID}>
            {ATK_CATALOG.map((i) => (
              <option key={i.namaBarang} value={i.namaBarang} />
            ))}
          </datalist>

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
