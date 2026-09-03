"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { todayLocalDate } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import type { BookingRuangCreatePayload, Me, RecurrenceFrequency, RoomOption } from "@/lib/types";
import { MAX_JUMLAH_PESERTA, TIPE_BOOKING_LABELS, getRecurrenceFrequencyLabelMap } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/language-context";
import ModalOverlay from "./ModalOverlay";
import RoomMultiSelect from "./RoomMultiSelect";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
const RECURRENCE_OPTIONS: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];

interface Props {
  open: boolean;
  me: Me;
  onClose: () => void;
  onCreated: () => void;
  initial?: Partial<BookingRuangCreatePayload>;
}

function emptyForm(initial?: Partial<BookingRuangCreatePayload>): BookingRuangCreatePayload {
  return {
    namaKegiatan: "",
    pic: "",
    namaRuang: "",
    additionalRooms: [],
    jumlahPeserta: 1,
    tanggal: todayLocalDate(),
    isWholeDay: false,
    jamMulai: "07:00",
    jamSelesai: "09:00",
    catatan: "",
    tipe: "INTERNAL",
    isRecurring: false,
    recurrenceFrequency: null,
    recurrenceEndDate: null,
    ...initial,
  };
}

export default function RoomBookingFormModal({ open, me, onClose, onCreated, initial }: Props) {
  const { orgStructure } = useAuth();
  const { language, t } = useLanguage();
  const [form, setForm] = useState<BookingRuangCreatePayload>(emptyForm());
  const [rooms, setRooms] = useState<RoomOption[]>([]);
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
      api.listRooms().then(setRooms).catch(() => setRooms([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !form.tanggal) return;
    api
      .nextBookingNomor(form.tanggal, isGaActor ? form.divisi : undefined)
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

  function set<K extends keyof BookingRuangCreatePayload>(key: K, value: BookingRuangCreatePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Switching the primary room to one already picked as an additional room would otherwise leave
  // a stale duplicate in additionalRooms - invisible in the UI (its chip disappears once it
  // matches namaRuang) but still sent to the backend, which rejects the save with a confusing
  // "Ruang tambahan tidak boleh sama dengan ruang utama" error the user can't see the cause of.
  function setNamaRuang(nama: string) {
    setForm((f) => ({ ...f, namaRuang: nama, additionalRooms: (f.additionalRooms || []).filter((r) => r !== nama) }));
  }

  function toggleRecurring() {
    setForm((f) => ({
      ...f,
      isRecurring: !f.isRecurring,
      recurrenceFrequency: !f.isRecurring ? "WEEKLY" : null,
      recurrenceEndDate: !f.isRecurring ? f.tanggal : null,
    }));
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
      const created = await api.createBooking({
        ...form,
        // "" (the explicit "Kebutuhan Divisi ini" choice) means no specific Departemen -
        // translated to undefined here (not sent at all) so the backend still records a null
        // Departemen, same as before this field became a required pick instead of an optional
        // one left blank.
        departemen: form.departemen || undefined,
        pic: form.pic || null,
        catatan: form.catatan || null,
        jamMulai: form.isWholeDay ? null : form.jamMulai,
        jamSelesai: form.isWholeDay ? null : form.jamSelesai,
      });
      showToast(
        created.length > 1
          ? `${created.length} ${t("bk.jadwalBerulangSuffix")}`
          : t("bk.toastBookingSavedDraft")
      );
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
          <h3>{t("bk.formBookingRuangTitle")} {unitName ? `(${unitName})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="f-nomor-pemesanan">{t("bk.nomorPesananRuangan")}</label>
              <input type="text" id="f-nomor-pemesanan" disabled value={nomorPemesanan} />
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
            <div className="field full">
              <label htmlFor="f-nama-kegiatan">{t("bk.namaKegiatan")}</label>
              <input type="text" id="f-nama-kegiatan" required placeholder={t("bk.contohTechnicalMeeting")} value={form.namaKegiatan} onChange={(e) => set("namaKegiatan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="f-pic">{t("bk.pic")}</label>
              <input type="text" id="f-pic" required placeholder={t("bk.namaPenanggungJawab")} value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-tanggal">{t("common.date")}</label>
              <input type="date" id="f-tanggal" required value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-peserta">{t("bk.jumlahPeserta")}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="f-peserta"
                required
                value={form.jumlahPeserta === 0 ? "" : String(form.jumlahPeserta)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  const parsed = digits === "" ? 0 : Math.min(Number(digits), MAX_JUMLAH_PESERTA);
                  set("jumlahPeserta", parsed);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="f-jam-mulai">{t("bk.jamMulai")}</label>
              <SearchableSelect
                id="f-jam-mulai"
                value={form.jamMulai || undefined}
                onChange={(v) => set("jamMulai", v)}
                options={HOUR_OPTIONS}
                placeholder={t("bk.pilihJam")}
                disabled={form.isWholeDay}
              />
            </div>
            <div className="field">
              <label htmlFor="f-jam-selesai">{t("bk.jamSelesai")}</label>
              <SearchableSelect
                id="f-jam-selesai"
                value={form.jamSelesai || undefined}
                onChange={(v) => set("jamSelesai", v)}
                options={HOUR_OPTIONS}
                placeholder={t("bk.pilihJam")}
                disabled={form.isWholeDay}
              />
            </div>
            <div className="field full">
              <label htmlFor="f-sepanjang-hari">{t("bk.durasiOpsional")}</label>
              <button
                type="button"
                id="f-sepanjang-hari"
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
              <label htmlFor="f-ruang">{t("bk.ruangan")}</label>
              <SearchableSelect
                id="f-ruang"
                value={form.namaRuang || undefined}
                onChange={setNamaRuang}
                options={rooms.map((r) => r.nama)}
                placeholder={t("bk.pilihRuang")}
              />
            </div>
            {rooms.filter((r) => r.nama !== form.namaRuang).length > 0 && (
              <div className="field full">
                <label htmlFor="f-ruang-tambahan">{t("bk.ruanganTambahanOpsional")}</label>
                <RoomMultiSelect
                  id="f-ruang-tambahan"
                  rooms={rooms}
                  excludeRoom={form.namaRuang}
                  selected={form.additionalRooms || []}
                  onChange={(next) => set("additionalRooms", next)}
                />
              </div>
            )}
            <div className="field full">
              <label htmlFor="f-tipe">{t("bk.tipe")}</label>
              <SearchableSelect
                id="f-tipe"
                value={form.tipe}
                onChange={(v) => set("tipe", v as BookingRuangCreatePayload["tipe"])}
                options={Object.keys(TIPE_BOOKING_LABELS)}
                getLabel={(v) => TIPE_BOOKING_LABELS[v as keyof typeof TIPE_BOOKING_LABELS] || v}
                placeholder={form.tipe ? TIPE_BOOKING_LABELS[form.tipe] : t("bk.pilihTipe")}
              />
            </div>
            <div className="field full">
              <label htmlFor="f-booking-berulang">{t("bk.pengulanganOpsional")}</label>
              <button
                type="button"
                id="f-booking-berulang"
                className={`field-toggle${form.isRecurring ? " field-toggle-active" : ""}`}
                aria-pressed={form.isRecurring}
                onClick={toggleRecurring}
              >
                <span className="field-toggle-box">
                  {form.isRecurring && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </span>
                {t("bk.bookingBerulang")}
              </button>
            </div>
            {form.isRecurring && (
              <>
                <div className="field">
                  <label htmlFor="f-recurrence-frequency">{t("bk.frekuensi")}</label>
                  <SearchableSelect
                    id="f-recurrence-frequency"
                    value={form.recurrenceFrequency || undefined}
                    onChange={(v) => set("recurrenceFrequency", v as RecurrenceFrequency)}
                    options={RECURRENCE_OPTIONS}
                    getLabel={(v) => getRecurrenceFrequencyLabelMap(language)[v as RecurrenceFrequency] || v}
                    placeholder={t("bk.pilihFrekuensi")}
                  />
                </div>
                <div className="field">
                  <label htmlFor="f-recurrence-end">{t("bk.berulangSampaiTanggal")}</label>
                  <input
                    type="date"
                    id="f-recurrence-end"
                    required
                    min={form.tanggal}
                    value={form.recurrenceEndDate || ""}
                    onChange={(e) => set("recurrenceEndDate", e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="field full">
              <label htmlFor="f-catatan">{t("common.notes")}</label>
              <input type="text" id="f-catatan" placeholder={t("bk.contohSegeraDiApprove")} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
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
