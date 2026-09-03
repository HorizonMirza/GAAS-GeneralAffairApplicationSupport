"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getKategoriKerusakanLabelMap, getUrgensiLabelMap } from "@/lib/constants";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
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

const KATEGORI_OPTIONS: KategoriKerusakan[] = ["AC", "LISTRIK", "AIR", "FURNITUR", "GEDUNG", "IT", "LAINNYA"];
const URGENSI_OPTIONS: Urgensi[] = ["RENDAH", "SEDANG", "TINGGI"];

export default function SaranaFormModal({ open, me, onClose, onCreated }: Props) {
  const { language, t } = useLanguage();
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
    (me.role === "ADMIN_GA" ? `${t("word.admin")} ${t("word.generalAffair")}` : me.role === "APPROVAL_GA" ? `${t("word.approval")} ${t("word.generalAffair")}` : "");

  function set<K extends keyof PerbaikanSaranaCreatePayload>(key: K, value: PerbaikanSaranaCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createSarana({ ...form, catatan: form.catatan || null });
      showToast(t("mnt.toastSavedDraft"));
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
          <h3>{t("mnt.formLaporanTitle")} {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fs-nomor-perbaikan">{t("mnt.nomorLaporan")}</label>
              <input type="text" id="fs-nomor-perbaikan" disabled value={nomorPerbaikan} />
            </div>
            <div className="field">
              <label htmlFor="fs-tanggal">{t("mnt.tanggalLaporan")}</label>
              <input type="date" id="fs-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fs-lokasi">{t("mnt.lokasi")}</label>
              <input type="text" id="fs-lokasi" required placeholder={t("mnt.contohLokasi")} value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fs-kategori">{t("mnt.kategoriKerusakan")}</label>
              <SearchableSelect
                id="fs-kategori"
                value={form.kategori}
                onChange={(v) => set("kategori", v as KategoriKerusakan)}
                options={KATEGORI_OPTIONS}
                getLabel={(v) => getKategoriKerusakanLabelMap(language)[v as KategoriKerusakan] || v}
                placeholder={t("mnt.pilihKategori")}
              />
            </div>
            <div className="field">
              <label htmlFor="fs-urgensi">{t("mnt.tingkatUrgensi")}</label>
              <SearchableSelect
                id="fs-urgensi"
                value={form.urgensi}
                onChange={(v) => set("urgensi", v as Urgensi)}
                options={URGENSI_OPTIONS}
                getLabel={(v) => getUrgensiLabelMap(language)[v as Urgensi] || v}
                placeholder={t("mnt.pilihUrgensi")}
              />
            </div>
            <div className="field full">
              <label htmlFor="fs-deskripsi">{t("mnt.deskripsiKerusakan")}</label>
              <textarea
                id="fs-deskripsi"
                required
                placeholder={t("mnt.contohDeskripsiKerusakan")}
                value={form.deskripsiKerusakan}
                onChange={(e) => set("deskripsiKerusakan", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.stopPropagation();
                }}
              />
            </div>
            <div className="field full">
              <label htmlFor="fs-catatan">{t("common.notes")}</label>
              <input type="text" id="fs-catatan" placeholder={t("mnt.contohCatatanMohonDiperbaiki")} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>
          <div className="error-text">{error}</div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>{t("common.save")}</button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
