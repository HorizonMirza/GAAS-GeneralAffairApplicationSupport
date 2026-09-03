"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
import type { BookingKendaraanCreatePayload, Me, VehicleOption } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
  initial?: Partial<BookingKendaraanCreatePayload>;
}

function emptyForm(initial?: Partial<BookingKendaraanCreatePayload>): BookingKendaraanCreatePayload {
  return {
    keperluan: "",
    pic: "",
    namaKendaraan: "",
    jumlahPenumpang: 1,
    tanggal: todayLocalDate(),
    isWholeDay: false,
    jamMulai: "07:00",
    jamSelesai: "09:00",
    catatan: "",
    ...initial,
  };
}

export default function VehicleBookingFormModal({ open, me, onClose, onCreated, initial }: Props) {
  const { orgStructure } = useAuth();
  const { t } = useLanguage();
  const [form, setForm] = useState<BookingKendaraanCreatePayload>(emptyForm());
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [error, setError] = useState("");
  const [nomorPemesanan, setNomorPemesanan] = useState("");
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, open);

  const isGaActor = me.role === "ADMIN_GA" || me.role === "APPROVAL_GA";

  useEffect(() => {
    if (open) {
      setForm(emptyForm(initial));
      setError("");
      api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextKendaraanNomor(form.tanggal, isGaActor ? form.divisi : undefined)
      .then((r) => setNomorPemesanan(r.nomorPemesanan))
      .catch(() => setNomorPemesanan(""));
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

  const selectedVehicle = vehicles.find((v) => v.nama === form.namaKendaraan);

  function set<K extends keyof BookingKendaraanCreatePayload>(key: K, value: BookingKendaraanCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleWholeDay() {
    setForm((f) => ({
      ...f,
      isWholeDay: !f.isWholeDay,
      jamMulai: !f.isWholeDay ? "07:00" : f.jamMulai,
      jamSelesai: !f.isWholeDay ? "18:00" : f.jamSelesai,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createKendaraanBooking({
        ...form,
        pic: form.pic || null,
        catatan: form.catatan || null,
        jamMulai: form.isWholeDay ? null : form.jamMulai,
        jamSelesai: form.isWholeDay ? null : form.jamSelesai,
      });
      showToast(t("vbk.toastVehicleBookingSavedDraft"));
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
          <h3>{t("vbk.formBookingKendaraanTitle")} {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="fk-nomor-pemesanan">{t("vbk.nomorPesananKendaraan")}</label>
              <input type="text" id="fk-nomor-pemesanan" disabled value={nomorPemesanan} />
            </div>
            {isGaActor && (
              <>
                <div className="field">
                  <label htmlFor="fk-divisi">{t("word.division")}</label>
                  <SearchableSelect
                    id="fk-divisi"
                    value={form.divisi || undefined}
                    onChange={(v) => setForm((f) => ({ ...f, divisi: v || undefined, departemen: undefined }))}
                    options={orgStructure?.divisi || []}
                    placeholder={t("eks.pilihDivisi")}
                  />
                </div>
                <div className="field">
                  <label htmlFor="fk-departemen">{t("word.department")}</label>
                  <SearchableSelect
                    id="fk-departemen"
                    disabled={!form.divisi}
                    value={form.departemen || undefined}
                    onChange={(v) => set("departemen", v || undefined)}
                    options={departemenOptions}
                    placeholder={t("eks.pilihDepartemen")}
                  />
                </div>
              </>
            )}
            <div className="field full">
              <label htmlFor="fk-keperluan">{t("vbk.keperluan")}</label>
              <input type="text" id="fk-keperluan" required placeholder={t("vbk.contohKunjungan")} value={form.keperluan} onChange={(e) => set("keperluan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="fk-pic">{t("bk.pic")}</label>
              <input type="text" id="fk-pic" required placeholder={t("vbk.namaPenanggungJawabPerjalanan")} value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fk-tanggal">{t("common.date")}</label>
              <input type="date" id="fk-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="fk-penumpang">{t("vbk.jumlahPenumpang")}{selectedVehicle ? ` (${t("vbk.maksLabel")} ${selectedVehicle.kapasitas})` : ""}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="fk-penumpang"
                required
                value={form.jumlahPenumpang === 0 ? "" : String(form.jumlahPenumpang)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  const cap = selectedVehicle?.kapasitas ?? 99;
                  const parsed = digits === "" ? 0 : Math.min(Number(digits), cap);
                  set("jumlahPenumpang", parsed);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="fk-jam-mulai">{t("bk.jamMulai")}</label>
              <SearchableSelect
                id="fk-jam-mulai"
                disabled={form.isWholeDay}
                value={form.jamMulai || undefined}
                onChange={(v) => set("jamMulai", v)}
                options={HOUR_OPTIONS}
                placeholder={t("bk.pilihJam")}
              />
            </div>
            <div className="field">
              <label htmlFor="fk-jam-selesai">{t("bk.jamSelesai")}</label>
              <SearchableSelect
                id="fk-jam-selesai"
                disabled={form.isWholeDay}
                value={form.jamSelesai || undefined}
                onChange={(v) => set("jamSelesai", v)}
                options={HOUR_OPTIONS}
                placeholder={t("bk.pilihJam")}
              />
            </div>
            <div className="field full">
              <label htmlFor="fk-sepanjang-hari">{t("bk.durasiOpsional")}</label>
              <button
                type="button"
                id="fk-sepanjang-hari"
                className={`field-toggle${form.isWholeDay ? " field-toggle-active" : ""}`}
                aria-pressed={form.isWholeDay}
                onClick={toggleWholeDay}
              >
                <span className="field-toggle-box">
                  {form.isWholeDay && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </span>
                {t("bk.sepanjangHari")}
              </button>
            </div>
            <div className="field full">
              <label htmlFor="fk-kendaraan">{t("vbk.kendaraan")}</label>
              <SearchableSelect
                id="fk-kendaraan"
                value={form.namaKendaraan || undefined}
                onChange={(v) => set("namaKendaraan", v)}
                options={vehicles.map((v) => v.nama)}
                getLabel={(nama) => {
                  const v = vehicles.find((x) => x.nama === nama);
                  return v ? `${v.nama} - ${v.platNomor} - ${t("vbk.supirLabel")}: ${v.supir}` : nama;
                }}
                placeholder={t("vbk.pilihKendaraan")}
              />
            </div>
            {selectedVehicle && (
              <div className="field full">
                <label htmlFor="fk-supir">{t("vbk.supirLabel")}</label>
                <input type="text" id="fk-supir" disabled value={selectedVehicle.supir} />
              </div>
            )}
            <div className="field full">
              <label htmlFor="fk-catatan">{t("common.notes")}</label>
              <input type="text" id="fk-catatan" placeholder={t("bk.contohSegeraDiApprove")} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
