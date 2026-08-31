"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  canGaRescheduleKendaraan,
  isBookingOriginRole,
  isKendaraanCancellableByOrigin,
  isKendaraanDeletableByOrigin,
  isKendaraanEditableByOrigin,
} from "@/lib/constants";
import { useRowMenu } from "@/lib/useRowMenu";
import type { BookingKendaraan, BookingKendaraanCreatePayload, BookingRuang, VehicleOption } from "@/lib/types";
import { kendaraanAsBookingRuangShape } from "@/lib/kendaraanCalendarAdapter";
import RoomCalendarView, { addDays, addMonths, mondayOf, type CalendarViewMode } from "@/components/RoomCalendarView";
import MiniMonthCalendar from "@/components/MiniMonthCalendar";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import VehicleBookingFormModal from "@/components/VehicleBookingFormModal";
import VehicleBookingDetailModal from "@/components/VehicleBookingDetailModal";
import VehicleBookingRescheduleModal from "@/components/VehicleBookingRescheduleModal";
import VehicleBookingChatModal from "@/components/VehicleBookingChatModal";
import VehicleBookingStatusHistoryModal from "@/components/VehicleBookingStatusHistoryModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";
import CancelBookingModal from "@/components/CancelBookingModal";

const ALL_VEHICLES_VALUE = "__all__";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeForView(view: CalendarViewMode, refDate: string): { from: string; to: string } {
  if (view === "week") {
    const monday = mondayOf(refDate);
    return { from: monday, to: addDays(monday, 4) };
  }
  if (view === "month") {
    const d = new Date(refDate + "T00:00:00");
    const firstOfMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    const start = mondayOf(firstOfMonth);
    return { from: start, to: addDays(start, 41) };
  }
  return { from: refDate, to: refDate };
}

function monthGridRange(refDate: string): { from: string; to: string } {
  const d = new Date(refDate + "T00:00:00");
  const firstOfMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  const start = mondayOf(firstOfMonth);
  return { from: start, to: addDays(start, 41) };
}

function VehicleCalendarPageInner() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleFromQuery = searchParams.get("kendaraan") || "";
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [view, setView] = useState<CalendarViewMode>("week");
  const [refDate, setRefDate] = useState<string>(todayIso());
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [rawEntries, setRawEntries] = useState<BookingKendaraan[]>([]);
  const [rawAvailEntries, setRawAvailEntries] = useState<BookingKendaraan[]>([]);
  const [availBusy, setAvailBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [scheduleBusy, setScheduleBusy] = useState(true);
  // The mini-calendar's dots need this exact 42-day range regardless of which main view is
  // active (day/week views don't otherwise fetch it) - see MiniMonthCalendar's `entries` prop.
  const [miniEntries, setMiniEntries] = useState<BookingRuang[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<BookingKendaraanCreatePayload> | undefined>(undefined);
  const [detail, setDetail] = useState<{ item: BookingKendaraan; mode: "view" | "edit" } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingKendaraan | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<BookingKendaraan | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarHeight, setSidebarHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSidebarHeight(el.getBoundingClientRect().height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowMenu = useRowMenu(view === "avail" ? rawAvailEntries : rawEntries);

  const isOrigin = me ? isBookingOriginRole(me.role) : false;

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
    if (!loading && me?.role === "KPU") router.replace("/dashboard");
  }, [loading, me, router]);

  useEffect(() => {
    api.listVehicles().then((list) => {
      setVehicles(list);
      setSelectedVehicle((current) => current || vehicleFromQuery || list[0]?.nama || "");
    }).catch(() => setVehicles([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleFromQuery]);

  const loadSchedule = useCallback(async () => {
    if (!selectedVehicle || view === "avail") return;
    setScheduleBusy(true);
    try {
      const { from, to } = rangeForView(view, refDate);
      const data = await api.getKendaraanScheduleRange(from, to, selectedVehicle);
      setRawEntries(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setScheduleBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, refDate, selectedVehicle]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSchedule();
  }, [loadSchedule]);

  const loadAvail = useCallback(async () => {
    if (view !== "avail") return;
    setAvailBusy(true);
    try {
      const data = await api.getKendaraanSchedule(refDate);
      setRawAvailEntries(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setAvailBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, refDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAvail();
  }, [loadAvail]);

  const loadMiniEntries = useCallback(async () => {
    if (!selectedVehicle) return;
    try {
      const { from, to } = monthGridRange(refDate);
      const data = await api.getKendaraanScheduleRange(from, to, selectedVehicle);
      setMiniEntries(data.map(kendaraanAsBookingRuangShape));
    } catch {
      setMiniEntries([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refDate, selectedVehicle]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMiniEntries();
  }, [loadMiniEntries]);

  const entries = useMemo(() => rawEntries.map(kendaraanAsBookingRuangShape), [rawEntries]);
  const availEntries = useMemo(() => rawAvailEntries.map(kendaraanAsBookingRuangShape), [rawAvailEntries]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      (e.nomorPemesanan || "").toLowerCase().includes(q)
      || e.namaKegiatan.toLowerCase().includes(q)
      || (e.departemen || "").toLowerCase().includes(q)
      || (e.divisi || "").toLowerCase().includes(q)
    );
  }, [entries, search]);

  const filteredAvailEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availEntries;
    return availEntries.filter((e) =>
      (e.nomorPemesanan || "").toLowerCase().includes(q)
      || e.namaKegiatan.toLowerCase().includes(q)
      || (e.departemen || "").toLowerCase().includes(q)
      || (e.divisi || "").toLowerCase().includes(q)
    );
  }, [availEntries, search]);

  function reloadAll() {
    if (view === "avail") loadAvail();
    else loadSchedule();
    loadMiniEntries();
  }

  function goToday() {
    setRefDate(todayIso());
  }

  function goPrev() {
    if (view === "week") setRefDate((d) => addDays(d, -7));
    else if (view === "month") setRefDate((d) => addMonths(d, -1));
    else setRefDate((d) => addDays(d, -1));
  }

  function goNext() {
    if (view === "week") setRefDate((d) => addDays(d, 7));
    else if (view === "month") setRefDate((d) => addMonths(d, 1));
    else setRefDate((d) => addDays(d, 1));
  }

  function openCreateForm() {
    setFormInitial({ namaKendaraan: selectedVehicle, tanggal: refDate });
    setFormOpen(true);
  }

  function handleDelete(item: BookingKendaraan) {
    confirm("Hapus booking kendaraan ini secara permanen?", async () => {
      try {
        await api.deleteKendaraanBooking(item.id);
        showToast("Booking berhasil dihapus");
        reloadAll();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  if (!me || me.role === "SUPER_ADMIN" || me.role === "KPU") return null;

  return (
    <>
      <div className="calendar-shell">
        <div className="calendar-sidebar" ref={sidebarRef}>
          {isOrigin && (
            <button type="button" className="btn btn-primary btn-header-action calendar-sidebar-create-btn" onClick={openCreateForm}>
              + Booking Kendaraan
            </button>
          )}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="calendar-kendaraan-select">Kendaraan</label>
            <select
              id="calendar-kendaraan-select"
              value={view === "avail" ? ALL_VEHICLES_VALUE : selectedVehicle}
              onChange={(e) => {
                const v = e.target.value;
                if (v === ALL_VEHICLES_VALUE) {
                  setView("avail");
                } else {
                  setSelectedVehicle(v);
                  if (view === "avail") setView("day");
                }
              }}
            >
              <option value={ALL_VEHICLES_VALUE}>Ketersediaan Kendaraan</option>
              {vehicles.map((v) => (
                <option key={v.nama} value={v.nama}>{v.nama}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="calendar-kendaraan-date-input">Tanggal</label>
            <input type="date" id="calendar-kendaraan-date-input" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="calendar-kendaraan-search-input">Cari Pesanan</label>
            <input
              type="text"
              id="calendar-kendaraan-search-input"
              className="calendar-search-input"
              placeholder="No Pesanan"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <MiniMonthCalendar
            selectedDate={refDate}
            onSelect={setRefDate}
            entries={miniEntries}
          />
        </div>

        <div
          className={`calendar-main${view === "month" ? " calendar-main-month" : ""}`}
          style={view === "month" && sidebarHeight ? { minHeight: sidebarHeight } : undefined}
        >
          <div className="calendar-topbar">
            <div className="calendar-topbar-left">
              <button type="button" className="btn btn-secondary btn-sm" style={{ width: "auto" }} onClick={goToday}>Hari Ini</button>
              <div
                className="calendar-nav-arrows"
                style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <button
                  className="page-btn"
                  onClick={goPrev}
                  aria-label="Sebelumnya"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, padding: 0 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  className="page-btn"
                  onClick={goNext}
                  aria-label="Berikutnya"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, padding: 0 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
              <div className="calendar-topbar-room">{view === "avail" ? "Ketersediaan Kendaraan" : selectedVehicle}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="calendar-view-toggle">
                {(["day", "week", "month"] as CalendarViewMode[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`calendar-view-btn${view === v ? " calendar-view-btn-active" : ""}`}
                    onClick={() => setView(v)}
                  >
                    {v === "day" ? "Harian" : v === "week" ? "Mingguan" : "Bulanan"}
                  </button>
                ))}
              </div>
              <div className="calendar-view-toggle">
                <button
                  type="button"
                  className={`calendar-view-btn${view === "avail" ? " calendar-view-btn-active" : ""}`}
                  onClick={() => setView("avail")}
                >
                  Ketersediaan
                </button>
              </div>
            </div>
          </div>

          {(view === "avail" ? availBusy : scheduleBusy) ? (
            <p className="text-secondary">Memuat jadwal...</p>
          ) : (
            <RoomCalendarView
              view={view}
              refDate={refDate}
              entries={view === "avail" ? filteredAvailEntries : filteredEntries}
              rooms={vehicles}
              canCreate={isOrigin}
              onSlotSelect={(date, startHour, endHour, kendaraan) => {
                if (!isOrigin) return;
                setFormInitial({
                  namaKendaraan: kendaraan || selectedVehicle,
                  tanggal: date,
                  jamMulai: `${String(startHour).padStart(2, "0")}:00`,
                  jamSelesai: `${String(endHour).padStart(2, "0")}:00`,
                });
                setFormOpen(true);
              }}
              onEntryMenuClick={(event, entry) => rowMenu.toggle(event, entry.id, 220)}
              onJumpToDay={(date) => {
                setRefDate(date);
                setView("day");
              }}
              onJumpToRoom={(kendaraan) => {
                setSelectedVehicle(kendaraan);
                setView("day");
              }}
            />
          )}
        </div>
      </div>

      <RowMenuDropdown
        position={rowMenu.position}
        canEditDelete={
          !!rowMenu.menuItem &&
          ((isOrigin && isKendaraanEditableByOrigin(rowMenu.menuItem, me)) || canGaRescheduleKendaraan(rowMenu.menuItem, me))
        }
        canDelete={!!rowMenu.menuItem && isOrigin && isKendaraanDeletableByOrigin(rowMenu.menuItem, me)}
        canCancel={!!rowMenu.menuItem && isKendaraanCancellableByOrigin(rowMenu.menuItem, me)}
        onCancel={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setCancelTargetId(item.id);
        }}
        onDetail={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setDetail({ item, mode: "view" });
        }}
        onChat={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setChatItem(item);
        }}
        onUpdates={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          if (isOrigin && isKendaraanEditableByOrigin(item, me)) setDetail({ item, mode: "edit" });
          else if (canGaRescheduleKendaraan(item, me)) setRescheduleTarget(item);
        }}
        onStatus={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) setStatusItemId(item.id);
        }}
        onDelete={() => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (item) handleDelete(item);
        }}
      />

      {me && (
        <VehicleBookingFormModal
          open={formOpen}
          me={me}
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onCreated={reloadAll}
        />
      )}

      {me && (
        <VehicleBookingDetailModal
          open={!!detail}
          mode={detail?.mode || "view"}
          item={detail?.item || null}
          me={me}
          onClose={() => setDetail(null)}
          onSaved={reloadAll}
          onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
        />
      )}

      <VehicleBookingRescheduleModal
        open={!!rescheduleTarget}
        item={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSaved={reloadAll}
      />

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          reloadAll();
        }}
      />

      <CancelBookingModal
        open={cancelTargetId != null}
        targetId={cancelTargetId}
        targetType="kendaraan"
        onClose={() => setCancelTargetId(null)}
        onDone={() => {
          setCancelTargetId(null);
          reloadAll();
        }}
      />

      <VehicleBookingStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <VehicleBookingChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.keperluan} - ${chatItem.namaKendaraan} - ${chatItem.nomorPemesanan || "-"}` : ""}
          departemen={chatItem?.departemen ?? null}
          createdByRole={chatItem?.createdByRole ?? null}
          me={me}
          onClose={() => setChatItem(null)}
          onRead={reloadAll}
        />
      )}
    </>
  );
}

export default function VehicleCalendarPage() {
  return (
    <Suspense fallback={null}>
      <VehicleCalendarPageInner />
    </Suspense>
  );
}
