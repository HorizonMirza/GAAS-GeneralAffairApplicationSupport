"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES,
  BOOKING_L1_ACTIONABLE_STATUSES,
  bookingOriginActorLabel,
  bookingRecurrenceLabel,
  getRecurrenceFrequencyLabelMap,
  isBookingEditableByOrigin,
  isBookingGaActionable,
  MAX_JUMLAH_PESERTA,
  TIPE_BOOKING_LABELS,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { focusNextFieldOnEnter, useAutofocusFirstField } from "@/lib/formNav";
import { useLanguage } from "@/lib/i18n/language-context";
import type { BookingRuang, BookingRuangCreatePayload, Me, RecurrenceFrequency, RoomOption } from "@/lib/types";
import ModalOverlay from "./ModalOverlay";
import type { RejectType } from "./RejectModal";
import RoomMultiSelect from "./RoomMultiSelect";
import SearchableSelect from "./SearchableSelect";
import { useToast } from "./ui/ToastProvider";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
const RECURRENCE_OPTIONS: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];

interface Props {
  open: boolean;
  mode: "view" | "edit";
  item: BookingRuang | null;
  me: Me;
  onClose: () => void;
  onSaved: () => void;
  onRequestReject: (id: number, type: RejectType, originLabel: string) => void;
}

function toFormFields(item: BookingRuang): BookingRuangCreatePayload {
  return {
    namaKegiatan: item.namaKegiatan,
    pic: item.pic || "",
    namaRuang: item.namaRuang,
    additionalRooms: item.additionalRooms,
    jumlahPeserta: item.jumlahPeserta,
    tanggal: item.tanggal,
    isWholeDay: item.isWholeDay,
    // The API returns TimeOnly values as "HH:mm:ss", but the Jam Mulai/Selesai <select> options
    // are "HH:mm" - without slicing, the value never matches any option and the browser silently
    // falls back to displaying the first option (07:00) instead of the item's real time.
    jamMulai: item.jamMulai ? item.jamMulai.slice(0, 5) : item.jamMulai,
    jamSelesai: item.jamSelesai ? item.jamSelesai.slice(0, 5) : item.jamSelesai,
    catatan: item.catatan || "",
    tipe: item.tipe,
    isRecurring: !!item.seriesId,
    recurrenceFrequency: item.recurrenceFrequency,
    recurrenceEndDate: item.recurrenceEndDate,
  };
}

export default function RoomBookingDetailModal({ open, mode, item, me, onClose, onSaved, onRequestReject }: Props) {
  const { language, t } = useLanguage();
  const [form, setForm] = useState<BookingRuangCreatePayload | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [error, setError] = useState("");
  const [bulkShift, setBulkShift] = useState(7);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  useAutofocusFirstField(formRef, `${open}-${item?.id}-${mode}`);

  // useLayoutEffect (not useEffect) - form starts as null and is only hydrated here, so the very
  // first time this modal is ever opened in a session it renders nothing this pass (see the
  // `!form` check below) and formRef never attaches to a real <form>. A plain useEffect runs
  // after paint with the same open/item/mode trigger useAutofocusFirstField already used on that
  // empty pass, so it never gets a second chance once the form actually appears. useLayoutEffect's
  // setForm call instead forces a synchronous re-render before paint, so by the time
  // useAutofocusFirstField's (deferred) effect runs, formRef already points at the real form.
  useLayoutEffect(() => {
    if (!open || !item) return;
    setForm(toFormFields(item));
    setError("");
    setBulkShift(7);
    api.listRooms().then(setRooms).catch(() => setRooms([]));
  }, [open, item]);

  if (!open || !item || !form) return null;

  const isEdit = mode === "edit";
  const canSubmitDraft = !isEdit && item.status === "DRAFT" && isBookingEditableByOrigin(item, me);
  const canL1Act = !isEdit && (me.role === "APPROVAL_DEPARTEMEN" || me.role === "APPROVAL_DIVISI") && BOOKING_L1_ACTIONABLE_STATUSES.includes(item.status);
  const canGaAct = !isEdit && me.role === "ADMIN_GA" && isBookingGaActionable(item);
  const canGaApprovalAct = !isEdit && me.role === "APPROVAL_GA" && BOOKING_GA_APPROVAL_ACTIONABLE_STATUSES.includes(item.status);

  function set<K extends keyof BookingRuangCreatePayload>(key: K, value: BookingRuangCreatePayload[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleBulkReschedule() {
    if (!item?.seriesId || bulkShift === 0) return;
    setBulkBusy(true);
    try {
      const results = await api.bulkRescheduleSeries(item.seriesId, bulkShift);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;
      if (failCount === 0) {
        showToast(`${successCount} ${t("bk.jadwalBerhasilDigeserSuffix")} ${bulkShift} ${t("bk.hariUnit")}`);
      } else {
        showToast(`${successCount} ${t("bk.jadwalBerhasilDigeserSuffix")}, ${failCount} ${t("bk.masihBentrokSuffix")}`, "error");
      }
      onClose();
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBulkBusy(false);
    }
  }

  // Switching the primary room to one already picked as an additional room would otherwise leave
  // a stale duplicate in additionalRooms - invisible in the UI (its chip disappears once it
  // matches namaRuang) but still sent to the backend, which rejects the save with a confusing
  // "Ruang tambahan tidak boleh sama dengan ruang utama" error the user can't see the cause of.
  function setNamaRuang(nama: string) {
    setForm((f) => (f ? { ...f, namaRuang: nama, additionalRooms: (f.additionalRooms || []).filter((r) => r !== nama) } : f));
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

  function toggleRecurring() {
    setForm((f) => (f ? { ...f, isRecurring: !f.isRecurring } : f));
  }

  async function handleSubmitDraft() {
    try {
      const { detail } = await api.submitBooking(item!.id);
      showToast(detail || t("bk.toastBookingSubmitted"));
      onClose();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleApproveL1() {
    onClose();
    try {
      await api.approveBookingL1(item!.id);
      showToast(t("bk.toastApprovedToAdminGa"));
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGa() {
    onClose();
    try {
      await api.approveBookingGa(item!.id);
      showToast(t("bk.toastApprovedToApprovalGa"));
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleApproveGaApproval() {
    onClose();
    try {
      const { detail } = await api.approveBookingGaApproval(item!.id);
      showToast(detail || t("bk.toastBookingConfirmed"));
      onSaved();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateBooking(item!.id, { ...form!, pic: form!.pic || null, catatan: form!.catatan || null });
      showToast(form!.isRecurring ? t("bk.toastRecurringUpdated") : t("bk.toastBookingUpdated"));
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
          <h3>{isEdit ? t("bk.formBookingRuangTitle") : t("bk.detailBookingRuangTitle")} {item.departemen || item.divisi ? `(${item.departemen || item.divisi})` : ""}</h3>
          <button type="button" className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form ref={formRef} onSubmit={handleUpdateSubmit} onKeyDown={focusNextFieldOnEnter}>
          <div className="form-grid form-grid-compact">
            <div className="field full">
              <label htmlFor="bv-nomor-pemesanan">{t("bk.nomorPesananRuangan")}</label>
              <input type="text" id="bv-nomor-pemesanan" disabled value={item.nomorPemesanan || ""} />
            </div>
            <div className="field full">
              <label htmlFor="bv-nama-kegiatan">{t("bk.namaKegiatan")}</label>
              <input type="text" id="bv-nama-kegiatan" required disabled={!isEdit} value={form.namaKegiatan} onChange={(e) => set("namaKegiatan", e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="bv-pic">{t("bk.pic")}</label>
              <input type="text" id="bv-pic" required disabled={!isEdit} value={form.pic || ""} onChange={(e) => set("pic", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bv-tanggal">{t("common.date")}</label>
              <input type="date" id="bv-tanggal" required disabled={!isEdit} value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="bv-peserta">{t("bk.jumlahPeserta")}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                id="bv-peserta"
                required
                disabled={!isEdit}
                value={form.jumlahPeserta === 0 ? "" : String(form.jumlahPeserta)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  const parsed = digits === "" ? 0 : Math.min(Number(digits), MAX_JUMLAH_PESERTA);
                  set("jumlahPeserta", parsed);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="bv-jam-mulai">{t("bk.jamMulai")}</label>
              <SearchableSelect
                id="bv-jam-mulai"
                value={form.jamMulai || undefined}
                onChange={(v) => set("jamMulai", v)}
                options={HOUR_OPTIONS}
                placeholder={t("bk.pilihJam")}
                disabled={!isEdit || form.isWholeDay}
              />
            </div>
            <div className="field">
              <label htmlFor="bv-jam-selesai">{t("bk.jamSelesai")}</label>
              <SearchableSelect
                id="bv-jam-selesai"
                value={form.jamSelesai || undefined}
                onChange={(v) => set("jamSelesai", v)}
                options={HOUR_OPTIONS}
                placeholder={t("bk.pilihJam")}
                disabled={!isEdit || form.isWholeDay}
              />
            </div>
            <div className="field full">
              <label htmlFor="bv-sepanjang-hari">{t("bk.durasiOpsional")}</label>
              <button
                type="button"
                id="bv-sepanjang-hari"
                className={`field-toggle${form.isWholeDay ? " field-toggle-active" : ""}${!isEdit ? " field-toggle-disabled" : ""}`}
                aria-pressed={form.isWholeDay}
                disabled={!isEdit}
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
              <label htmlFor="bv-ruang">{t("bk.ruangan")}</label>
              <SearchableSelect
                id="bv-ruang"
                value={form.namaRuang || undefined}
                onChange={setNamaRuang}
                options={rooms.map((r) => r.nama)}
                placeholder={t("bk.pilihRuang")}
                disabled={!isEdit}
              />
            </div>
            {(isEdit ? rooms.filter((r) => r.nama !== form.namaRuang).length > 0 : (form.additionalRooms || []).length > 0) && (
              <div className="field full">
                <label htmlFor="bv-ruang-tambahan">{t("bk.ruanganTambahan")}</label>
                <RoomMultiSelect
                  id="bv-ruang-tambahan"
                  rooms={rooms}
                  excludeRoom={form.namaRuang}
                  selected={form.additionalRooms || []}
                  onChange={(next) => set("additionalRooms", next)}
                  readOnly={!isEdit}
                />
              </div>
            )}
            <div className="field full">
              <label htmlFor="bv-tipe">{t("bk.tipe")}</label>
              <SearchableSelect
                id="bv-tipe"
                value={form.tipe}
                onChange={(v) => set("tipe", v as BookingRuangCreatePayload["tipe"])}
                options={Object.keys(TIPE_BOOKING_LABELS)}
                getLabel={(v) => TIPE_BOOKING_LABELS[v as keyof typeof TIPE_BOOKING_LABELS] || v}
                placeholder={form.tipe ? TIPE_BOOKING_LABELS[form.tipe] : t("bk.pilihTipe")}
                disabled={!isEdit}
              />
            </div>
            {/* Editing lets the origin creator redefine an existing series' recurrence too (not
                just add one to a still-standalone booking) - Update() below regenerates the
                series' DRAFT occurrences to match. In view mode, a booking that already belongs
                to a series just shows its current Frekuensi/Berulang Sampai Tanggal, disabled. */}
            {isEdit ? (
              <>
                <div className="field full">
                  <label htmlFor="bv-booking-berulang">{t("bk.pengulanganOpsional")}</label>
                  <button
                    type="button"
                    id="bv-booking-berulang"
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
                      <label htmlFor="bv-recurrence-frequency">{t("bk.frekuensi")}</label>
                      <SearchableSelect
                        id="bv-recurrence-frequency"
                        value={form.recurrenceFrequency || undefined}
                        onChange={(v) => set("recurrenceFrequency", v as RecurrenceFrequency)}
                        options={RECURRENCE_OPTIONS}
                        getLabel={(v) => getRecurrenceFrequencyLabelMap(language)[v as RecurrenceFrequency] || v}
                        placeholder={t("bk.pilihFrekuensi")}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="bv-recurrence-end">{t("bk.berulangSampaiTanggal")}</label>
                      <input
                        type="date"
                        id="bv-recurrence-end"
                        required
                        min={form.tanggal}
                        value={form.recurrenceEndDate || ""}
                        onChange={(e) => set("recurrenceEndDate", e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            ) : item.seriesId && (
              <>
                <div className="field full">
                  <label htmlFor="bv-booking-berulang">{t("bk.pengulanganOpsional")}</label>
                  <button type="button" id="bv-booking-berulang" className="field-toggle field-toggle-active field-toggle-disabled" aria-pressed disabled>
                    <span className="field-toggle-box">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </span>
                    {t("bk.bookingBerulang")}
                  </button>
                </div>
                <div className="field">
                  <label htmlFor="bv-recurrence-frequency">{t("bk.frekuensi")}</label>
                  <SearchableSelect
                    id="bv-recurrence-frequency"
                    value={item.recurrenceFrequency || undefined}
                    onChange={() => {}}
                    options={RECURRENCE_OPTIONS}
                    getLabel={(v) => getRecurrenceFrequencyLabelMap(language)[v as RecurrenceFrequency] || v}
                    placeholder={t("bk.pilihFrekuensi")}
                    disabled
                  />
                </div>
                <div className="field">
                  <label htmlFor="bv-recurrence-end">{t("bk.berulangSampaiTanggal")}</label>
                  <input type="date" id="bv-recurrence-end" disabled value={item.recurrenceEndDate || ""} />
                </div>
              </>
            )}
            <div className="field full">
              <label htmlFor="bv-catatan">{t("common.notes")}</label>
              <input type="text" id="bv-catatan" disabled={!isEdit} placeholder={isEdit ? t("bk.contohSegeraDiApprove") : ""} value={form.catatan || ""} onChange={(e) => set("catatan", e.target.value)} />
            </div>
          </div>

          {bookingRecurrenceLabel(item, language) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 4 }}>
              <strong>{t("bk.pengulanganColon")}</strong> {t("bk.approveRejectSeriesNote")}
            </div>
          )}

          {!isEdit && item.hasConflict && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12, color: "#d64545" }}>
              <strong>{t("bk.bentrokColon")}</strong> {t("bk.bentrokNote")}
              {item.seriesId && (me.role === "ADMIN_GA" || me.role === "APPROVAL_GA") && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span>{t("bk.atauGeserSemuaJadwal")}</span>
                  <input
                    type="number"
                    value={bulkShift}
                    onChange={(e) => setBulkShift(Number(e.target.value))}
                    style={{ width: 56 }}
                    title={t("bk.jumlahHariTitle")}
                  />
                  <span>{t("bk.hariUnit")}</span>
                  <button type="button" className="btn btn-secondary" style={{ width: "auto", padding: "4px 10px" }} disabled={bulkBusy} onClick={handleBulkReschedule}>
                    {bulkBusy ? t("bk.memproses") : t("bk.geserSemua")}
                  </button>
                </div>
              )}
            </div>
          )}

          {["SUBMITTED", "APPROVED_L1", "APPROVED_GA", "APPROVED_GA_APPROVAL"].includes(item.status) && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>{t("bk.diajukanColon")}</strong> {formatDateTime(item.createdAt)}
            </div>
          )}

          {item.rejectReason && (
            <div className="text-secondary" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
              <strong>{t("eks.catatanPenolakan")}</strong> {item.rejectReason}
            </div>
          )}

          <div className="error-text">{error}</div>
          <div className="modal-actions">
            {canSubmitDraft && (
              <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleSubmitDraft}>{t("common.submit")}</button>
            )}
            {canL1Act && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "booking-l1", bookingOriginActorLabel(item, language)); }}>{t("common.reject")}</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveL1}>{t("common.approve")}</button>
              </>
            )}
            {canGaAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "booking-ga", bookingOriginActorLabel(item, language)); }}>{t("common.reject")}</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGa}>{t("common.approve")}</button>
              </>
            )}
            {canGaApprovalAct && (
              <>
                <button type="button" className="btn btn-danger" style={{ width: "auto" }} onClick={() => { onClose(); onRequestReject(item.id, "booking-ga-approval", bookingOriginActorLabel(item, language)); }}>{t("common.reject")}</button>
                <button type="button" className="btn btn-approve" style={{ width: "auto" }} onClick={handleApproveGaApproval}>{t("common.approve")}</button>
              </>
            )}
            {isEdit && (
              <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>{t("common.save")}</button>
            )}
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
