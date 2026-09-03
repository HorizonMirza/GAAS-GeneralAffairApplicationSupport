"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Asuransi, Me, PengirimanCreatePayload } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
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
  const { t } = useLanguage();
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
    (me.role === "ADMIN_GA" ? `${t("word.admin")} ${t("word.generalAffair")}` : me.role === "APPROVAL_GA" ? `${t("word.approval")} ${t("word.generalAffair")}` : "");

  function set<K extends keyof PengirimanCreatePayload>(key: K, value: PengirimanCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isGaActor) {
      if (!form.divisi) {
        setError(t("eks.errDivisiRequired"));
        return;
      }
      if (form.departemen === undefined) {
        setError(t("eks.errDepartemenRequired"));
        return;
      }
    }
    try {
      // "" (the explicit "Kebutuhan Divisi ini" choice) means no specific Departemen - translated
      // to undefined here (not sent at all) so the backend still records a null Departemen, same
      // as before this field became a required pick instead of an optional one left blank.
      await api.createPengiriman({ ...form, departemen: form.departemen || undefined, catatan: form.catatan || null });
      showToast(t("eks.toastSavedDraft"));
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
          <h3>{t("eks.formDataBarang")} {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="f-nomor-transmittal">{t("eks.nomorTransmittal")}</label>
              <input type="text" id="f-nomor-transmittal" disabled value={nomorTransmittal} />
            </div>
            {isGaActor && (
              <>
                <div className="field">
                  <label htmlFor="f-divisi">{t("word.division")}</label>
                  <SearchableSelect
                    id="f-divisi"
                    value={form.divisi}
                    onChange={(next) => setForm((f) => ({ ...f, divisi: next, departemen: undefined }))}
                    options={orgStructure?.divisi || []}
                    placeholder={t("eks.pilihDivisi")}
                  />
                </div>
                <div className="field">
                  <label htmlFor="f-departemen">{t("word.department")}</label>
                  <SearchableSelect
                    id="f-departemen"
                    value={form.departemen}
                    onChange={(next) => set("departemen", next)}
                    options={departemenOptions}
                    placeholder={t("eks.pilihDepartemen")}
                    clearLabel={t("eks.kebutuhanDivisi")}
                    disabled={!form.divisi}
                  />
                </div>
              </>
            )}
            <div className="field">
              <label htmlFor="f-tanggal">{t("common.date")}</label>
              <input type="date" id="f-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-jumlah-item">{t("eks.jumlahBarang")}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="f-jumlah-item"
                required
                placeholder={t("eks.masukkanAngka")}
                value={form.jumlahItem === 0 ? "" : String(form.jumlahItem)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  set("jumlahItem", digits === "" ? 0 : Number(digits));
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="f-pengirim">{t("eks.namaPengirim")}</label>
              <input type="text" id="f-pengirim" required value={form.namaPengirim} onChange={(e) => set("namaPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-telepon-pengirim">{t("eks.noTeleponPengirim")}</label>
              <input type="text" id="f-telepon-pengirim" required value={form.noTeleponPengirim} onChange={(e) => set("noTeleponPengirim", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-alamat-pengirim">{t("eks.alamatPengirim")}</label>
              <textarea id="f-alamat-pengirim" required value={form.alamatPengirim} onChange={(e) => set("alamatPengirim", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-penerima">{t("eks.namaPenerima")}</label>
              <input type="text" id="f-penerima" required value={form.namaPenerima} onChange={(e) => set("namaPenerima", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-telepon">{t("eks.noTeleponPenerima")}</label>
              <input type="text" id="f-telepon" required value={form.noTeleponPenerima} onChange={(e) => set("noTeleponPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-alamat">{t("eks.alamatPenerima")}</label>
              <textarea id="f-alamat" required value={form.alamatPenerima} onChange={(e) => set("alamatPenerima", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-tujuan">{t("eks.tujuan")}</label>
              <input type="text" id="f-tujuan" required placeholder={t("eks.contohTujuan")} value={form.tujuanPenerimaan} onChange={(e) => set("tujuanPenerimaan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-kode-program">{t("eks.kodeProgram")}</label>
              <input type="text" id="f-kode-program" required placeholder={t("eks.contohKodeProgram")} value={form.kodeProgram} onChange={(e) => set("kodeProgram", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-asuransi">{t("eks.asuransi")}</label>
              <SearchableSelect
                id="f-asuransi"
                value={form.asuransiStatus}
                onChange={(v) => set("asuransiStatus", v as Asuransi)}
                options={["Tidak", "Ya"]}
                getLabel={(v) => (v === "Ya" ? t("eks.ya") : t("eks.tidak"))}
                placeholder={t("eks.tidak")}
              />
            </div>
            <div className="field">
              <label htmlFor="f-packing">{t("eks.pengemasanTambahan")}</label>
              <SearchableSelect
                id="f-packing"
                value={form.requestPacking}
                onChange={(v) => set("requestPacking", v)}
                options={["Tidak", "Tambahan Kayu"]}
                getLabel={(v) => (v === "Tambahan Kayu" ? t("eks.tambahanKayu") : t("eks.tidak"))}
                placeholder={t("eks.tidak")}
              />
            </div>
            <div className="field full">
              <label htmlFor="f-catatan">{t("common.notes")}</label>
              <input type="text" id="f-catatan" placeholder={t("eks.contohRequestJne")} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
