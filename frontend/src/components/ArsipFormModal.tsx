"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getArchiveKategoriLabelMap } from "@/lib/constants";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
import type { ArchiveKategori, Me, PermintaanArsipCreatePayload, PermintaanArsipItemPayload } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const KATEGORI_OPTIONS: ArchiveKategori[] = ["SOP", "SURAT", "KONTRAK", "LAPORAN", "PANDUAN", "LAINNYA"];

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
  const { language, t } = useLanguage();
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
    (me.role === "ADMIN_GA" ? `${t("word.admin")} ${t("word.generalAffair")}` : me.role === "APPROVAL_GA" ? `${t("word.approval")} ${t("word.generalAffair")}` : "");

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
      showToast(t("arsip.toastSavedDraft"));
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
          <h3>{t("arsip.formPermintaanTitle")} {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fr-nomor-arsip">{t("arsip.nomorPermintaan")}</label>
              <input type="text" id="fr-nomor-arsip" disabled value={nomorArsip} />
            </div>
            <div className="field">
              <label htmlFor="fr-tanggal">{t("common.date")}</label>
              <input type="date" id="fr-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fr-keperluan">{t("arsip.keperluan")}</label>
              <input type="text" id="fr-keperluan" required placeholder={t("arsip.contohPemindahanArsip")} value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="fr-lokasi">{t("arsip.lokasiPenyimpanan")}</label>
              <input type="text" id="fr-lokasi" required placeholder={t("arsip.contohLokasiPenyimpanan")} value={form.lokasiPenyimpanan} onChange={(e) => set("lokasiPenyimpanan", e.target.value)} />
            </div>

            <div className="field full">
              <label>{t("arsip.daftarArsip")}</label>
              {form.items.map((row, idx) => (
                <div key={idx} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <input
                    type="text"
                    aria-label={`${t("arsip.namaArsipAria")} ${idx + 1}`}
                    required
                    placeholder={t("arsip.namaArsipPlaceholder")}
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
                      getLabel={(v) => getArchiveKategoriLabelMap(language)[v as ArchiveKategori] || v}
                      placeholder={t("arsip.kategoriPlaceholder")}
                    />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`${t("arsip.tahunArsipAria")} ${idx + 1}`}
                    required
                    placeholder={t("arsip.tahunPlaceholder")}
                    style={{ flex: "1 1 80px", minWidth: 80 }}
                    value={row.tahunArsip}
                    onChange={(e) => setItem(idx, { tahunArsip: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`${t("arsip.jumlahArsipAria")} ${idx + 1}`}
                    required
                    placeholder={t("arsip.jumlahPlaceholder")}
                    style={{ flex: "1 1 80px", minWidth: 80 }}
                    value={row.jumlah === 0 ? "" : String(row.jumlah)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                      setItem(idx, { jumlah: digits === "" ? 0 : Math.min(Number(digits), 9999) });
                    }}
                  />
                  <input
                    type="text"
                    aria-label={`${t("arsip.satuanArsipAria")} ${idx + 1}`}
                    required
                    placeholder={t("arsip.satuanPlaceholder")}
                    style={{ flex: "1.5 1 110px", minWidth: 110 }}
                    value={row.satuan}
                    onChange={(e) => setItem(idx, { satuan: e.target.value })}
                  />
                  <button
                    type="button"
                    className="card-icon-btn"
                    aria-label={`${t("arsip.hapusBarisArsipAria")} ${idx + 1}`}
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
                  {t("arsip.tambahArsip")}
                </button>
              )}
            </div>

            <div className="field full">
              <label htmlFor="fr-catatan">{t("common.notes")}</label>
              <input type="text" id="fr-catatan" placeholder={t("arsip.contohSudahTidakDipakai")} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>{t("common.save")}</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
