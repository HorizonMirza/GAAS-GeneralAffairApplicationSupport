"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { KATEGORI_KERUSAKAN_LABEL, URGENSI_LABEL } from "@/lib/constants";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { KategoriKerusakan, Me, PerbaikanSaranaCreatePayload, Urgensi } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
}

function emptyForm(): PerbaikanSaranaCreatePayload {
  return {
    tanggal: todayLocalDate(),
    lokasi: "",
    kategori: "AC",
    urgensi: "SEDANG",
    deskripsiKerusakan: "",
    catatan: "",
  };
}

const KATEGORI_OPTIONS = Object.keys(KATEGORI_KERUSAKAN_LABEL) as KategoriKerusakan[];
const URGENSI_OPTIONS = Object.keys(URGENSI_LABEL) as Urgensi[];

export default function SaranaFormModal({ open, me, onClose, onCreated }: Props) {
  const [form, setForm] = useState<PerbaikanSaranaCreatePayload>(emptyForm());
  const [error, setError] = useState("");
  const [nomorPerbaikan, setNomorPerbaikan] = useState("");
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
      .nextSaranaNomor(form.tanggal)
      .then((r) => setNomorPerbaikan(r.nomorPerbaikan))
      .catch(() => setNomorPerbaikan(""));
  }, [open, form.tanggal]);

  if (!open) return null;

  const unitName =
    me.departemen ||
    me.divisi ||
    (me.role === "ADMIN_GA" ? "Admin General Affair" : me.role === "APPROVAL_GA" ? "Approval General Affair" : "");

  function set<K extends keyof PerbaikanSaranaCreatePayload>(key: K, value: PerbaikanSaranaCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createSarana({ ...form, catatan: form.catatan || null });
      showToast("Laporan perbaikan berhasil disimpan sebagai Draft");
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
          <h3>Form Laporan Perbaikan {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fs-nomor-perbaikan">Nomor Laporan Perbaikan</label>
              <input type="text" id="fs-nomor-perbaikan" disabled value={nomorPerbaikan} />
            </div>
            <div className="field">
              <label htmlFor="fs-tanggal">Tanggal Laporan</label>
              <input type="date" id="fs-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fs-lokasi">Lokasi</label>
              <input type="text" id="fs-lokasi" required placeholder="Contoh: Lantai 3 - Ruang Meeting Bromo" value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fs-kategori">Kategori Kerusakan</label>
              <SearchableSelect
                id="fs-kategori"
                value={form.kategori}
                onChange={(v) => set("kategori", v as KategoriKerusakan)}
                options={KATEGORI_OPTIONS}
                getLabel={(v) => KATEGORI_KERUSAKAN_LABEL[v as KategoriKerusakan] || v}
                placeholder="Pilih kategori"
              />
            </div>
            <div className="field">
              <label htmlFor="fs-urgensi">Tingkat Urgensi</label>
              <SearchableSelect
                id="fs-urgensi"
                value={form.urgensi}
                onChange={(v) => set("urgensi", v as Urgensi)}
                options={URGENSI_OPTIONS}
                getLabel={(v) => URGENSI_LABEL[v as Urgensi] || v}
                placeholder="Pilih urgensi"
              />
            </div>
            <div className="field full">
              <label htmlFor="fs-deskripsi">Deskripsi Kerusakan</label>
              <textarea
                id="fs-deskripsi"
                required
                placeholder="Contoh: AC tidak dingin dan mengeluarkan bunyi berisik sejak Senin pagi"
                value={form.deskripsiKerusakan}
                onChange={(e) => set("deskripsiKerusakan", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.stopPropagation();
                }}
              />
            </div>
            <div className="field full">
              <label htmlFor="fs-catatan">Catatan</label>
              <input type="text" id="fs-catatan" placeholder="Contoh: Mohon diperbaiki sebelum rapat Jumat" value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>Simpan</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
