"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
import type { BookingKendaraan, BookingKendaraanReschedulePayload, VehicleOption } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

interface Props {
  open: boolean;
  item: BookingKendaraan | null;
  onClose: () => void;
  onSaved: () => void;
}

function toFormFields(item: BookingKendaraan): BookingKendaraanReschedulePayload {
  return {
    namaKendaraan: item.namaKendaraan,
    tanggal: item.tanggal,
    isWholeDay: item.isWholeDay,
    jamMulai: item.jamMulai ? item.jamMulai.slice(0, 5) : item.jamMulai,
    jamSelesai: item.jamSelesai ? item.jamSelesai.slice(0, 5) : item.jamSelesai,
  };
}

// Admin/Approval GA's conflict-resolution tool: move an in-flight booking's kendaraan/date/time
// without touching the rest of it (keperluan, PIC, penumpang stay the origin creator's own) -
// separate from VehicleBookingDetailModal's own "edit" mode, which is creator-only and DRAFT-only.
export default function VehicleBookingRescheduleModal({ open, item, onClose, onSaved }: Props) {
  const { t } = useLanguage();
  const [form, setForm] = useState<BookingKendaraanReschedulePayload | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}`);

  useEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    api.listVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  function set<K extends keyof BookingKendaraanReschedulePayload>(key: K, value: BookingKendaraanReschedulePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function toggleWholeDay() {
    setForm((f) => {
      if (!f) return f;
      return {
        ...f,
        isWholeDay: !f.isWholeDay,
        jamMulai: !f.isWholeDay ? "07:00" : f.jamMulai,
        jamSelesai: !f.isWholeDay ? "18:00" : f.jamSelesai,
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.rescheduleKendaraanBooking(item!.id, {
        ...form!,
        jamMulai: form!.isWholeDay ? null : form!.jamMulai,
        jamSelesai: form!.isWholeDay ? null : form!.jamSelesai,
      });
      showToast(t("vbk.toastRescheduleSaved"));
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{t("vbk.ubahKendaraanJadwalTitle")} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="rk-nomor-pemesanan">{t("vbk.nomorPesananKendaraan")}</label>
              <input type="text" id="rk-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="rk-keperluan">{t("vbk.keperluan")}</label>
              <input type="text" id="rk-keperluan" disabled value={item.keperluan} />
            </div>
            <div className="field full">
              <label htmlFor="rk-pic">{t("bk.pic")}</label>
              <input type="text" id="rk-pic" disabled value={item.pic || ""} />
            </div>
            <div className="field">
              <label htmlFor="rk-tanggal">{t("common.date")}</label>
              <input type="date" id="rk-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rk-penumpang">{t("vbk.jumlahPenumpang")}</label>
              <input type="text" id="rk-penumpang" disabled value={item.jumlahPenumpang ? `${item.jumlahPenumpang}` : ""} />
            </div>
            <div className="field">
              <label htmlFor="rk-jam-mulai">{t("bk.jamMulai")}</label>
              <SearchableSelect
                id="rk-jam-mulai"
                disabled={form.isWholeDay}
                value={form.jamMulai || undefined}
                onChange={(v) => set("jamMulai", v)}
                options={HOUR_OPTIONS}
                placeholder={t("bk.pilihJam")}
              />
            </div>
            <div className="field">
              <label htmlFor="rk-jam-selesai">{t("bk.jamSelesai")}</label>
              <SearchableSelect
                id="rk-jam-selesai"
                disabled={form.isWholeDay}
                value={form.jamSelesai || undefined}
                onChange={(v) => set("jamSelesai", v)}
                options={HOUR_OPTIONS}
                placeholder={t("bk.pilihJam")}
              />
            </div>
            <div className="field full">
              <label htmlFor="rk-sepanjang-hari">{t("bk.durasiOpsional")}</label>
              <button
                type="button"
                id="rk-sepanjang-hari"
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
              <label htmlFor="rk-kendaraan">{t("vbk.kendaraan")}</label>
              <SearchableSelect
                id="rk-kendaraan"
                value={form.namaKendaraan}
                onChange={(v) => set("namaKendaraan", v)}
                options={vehicles.map((v) => v.nama)}
                getLabel={(nama) => {
                  const v = vehicles.find((x) => x.nama === nama);
                  return v ? `${v.nama} - ${v.platNomor} - ${t("vbk.supirLabel")}: ${v.supir}` : nama;
                }}
                placeholder={form.namaKendaraan}
              />
            </div>
            <div className="field full">
              <label htmlFor="rk-supir">{t("vbk.supirLabel")}</label>
              <input type="text" id="rk-supir" disabled value={vehicles.find((v) => v.nama === form.namaKendaraan)?.supir ?? item.supir ?? ""} />
            </div>
            <div className="field full">
              <label htmlFor="rk-catatan">{t("common.notes")}</label>
              <input type="text" id="rk-catatan" disabled value={item.catatan || ""} />
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
