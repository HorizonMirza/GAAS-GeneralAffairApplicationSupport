"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  bookingRoomsLabel,
  canGaRescheduleBooking,
  isBookingDeletableByOrigin,
  isBookingEditableByOrigin,
  isBookingOriginRole,
  isBookingPdfAvailable,
} from "@/lib/constants";
import { useRowMenu } from "@/lib/useRowMenu";
import type { BookingRuang, BookingRuangCreatePayload, RoomOption } from "@/lib/types";
import RoomCalendarView, { addDays, addMonths, mondayOf, type CalendarViewMode } from "@/components/RoomCalendarView";
import MiniMonthCalendar from "@/components/MiniMonthCalendar";
import RowMenuDropdown from "@/components/RowMenuDropdown";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RoomBookingRescheduleModal from "@/components/RoomBookingRescheduleModal";
import RoomBookingChatModal from "@/components/RoomBookingChatModal";
import BookingStatusHistoryModal from "@/components/BookingStatusHistoryModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";

const ALL_ROOMS_VALUE = "__all__";

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

function BookingCalendarPageInner() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomFromQuery = searchParams.get("ruang") || "";
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [view, setView] = useState<CalendarViewMode>("week");
  const [refDate, setRefDate] = useState<string>(todayIso());
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [entries, setEntries] = useState<BookingRuang[]>([]);
  const [availEntries, setAvailEntries] = useState<BookingRuang[]>([]);
  const [availBusy, setAvailBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [scheduleBusy, setScheduleBusy] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<BookingRuangCreatePayload> | undefined>(undefined);
  const [detail, setDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingRuang | null>(null);
  const [statusItemId, setStatusItemId] = useState<number | null>(null);
  const [chatItem, setChatItem] = useState<BookingRuang | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const rowMenu = useRowMenu(view === "avail" ? availEntries : entries);

  const isOrigin = me ? isBookingOriginRole(me.role) : false;

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  useEffect(() => {
    api.listRooms().then((list) => {
      setRooms(list);
      setSelectedRoom((current) => current || roomFromQuery || list[0]?.nama || "");
    }).catch(() => setRooms([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomFromQuery]);

  const loadSchedule = useCallback(async () => {
    if (!selectedRoom || view === "avail") return;
    setScheduleBusy(true);
    try {
      const { from, to } = rangeForView(view, refDate);
      const data = await api.getBookingScheduleRange(from, to, selectedRoom);
      setEntries(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setScheduleBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, refDate, selectedRoom]);

  useEffect(() => {
    // Fetches from the API on mount/whenever view/date/room changes - genuinely synchronizing
    // with an external system, not state derived from a prop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSchedule();
  }, [loadSchedule]);

  const loadAvail = useCallback(async () => {
    if (view !== "avail") return;
    setAvailBusy(true);
    try {
      const data = await api.getBookingSchedule(refDate);
      setAvailEntries(data);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setAvailBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, refDate]);

  useEffect(() => {
    // Fetches from the API on mount/whenever view/date changes - genuinely synchronizing with
    // an external system, not state derived from a prop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAvail();
  }, [loadAvail]);

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
    setFormInitial({ namaRuang: selectedRoom, tanggal: refDate });
    setFormOpen(true);
  }

  function handleDelete(item: BookingRuang) {
    const message = item.seriesId
      ? "Booking ini bagian dari jadwal berulang - menghapusnya akan menghapus seluruh jadwal seri ini. Lanjutkan?"
      : "Hapus booking ruangan ini secara permanen?";
    confirm(message, async () => {
      try {
        await api.deleteBooking(item.id);
        showToast("Booking berhasil dihapus");
        if (view === "avail") loadAvail();
        else loadSchedule();
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    });
  }

  if (!me || me.role === "SUPER_ADMIN") return null;

  const reload = view === "avail" ? loadAvail : loadSchedule;

  return (
    <>
      <div className="calendar-shell">
        <div className="calendar-sidebar">
          {isOrigin && (
            <button type="button" className="btn btn-primary btn-header-action calendar-sidebar-create-btn" onClick={openCreateForm}>
              + Booking Ruang Meeting
            </button>
          )}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="calendar-room-select">Ruangan</label>
            <select
              id="calendar-room-select"
              value={view === "avail" ? ALL_ROOMS_VALUE : selectedRoom}
              onChange={(e) => {
                const v = e.target.value;
                if (v === ALL_ROOMS_VALUE) {
                  setView("avail");
                } else {
                  setSelectedRoom(v);
                  if (view === "avail") setView("day");
                }
              }}
            >
              <option value={ALL_ROOMS_VALUE}>Ketersediaan Ruangan</option>
              {rooms.map((r) => (
                <option key={r.nama} value={r.nama}>{r.nama}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="calendar-date-input">Tanggal</label>
            <input type="date" id="calendar-date-input" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="calendar-search-input">Cari Pesanan</label>
            <input
              type="text"
              id="calendar-search-input"
              className="calendar-search-input"
              placeholder="No Pesanan"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <MiniMonthCalendar
            selectedDate={refDate}
            onSelect={setRefDate}
            namaRuang={view === "avail" ? undefined : selectedRoom}
            entries={view === "month" ? entries : undefined}
          />
        </div>

        <div className="calendar-main">
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
              <div className="calendar-topbar-room">{view === "avail" ? "Ketersediaan Ruangan" : selectedRoom}</div>
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
              rooms={rooms}
              canCreate={isOrigin}
              onSlotSelect={(date, startHour, endHour, room) => {
                if (!isOrigin) return;
                setFormInitial({
                  namaRuang: room || selectedRoom,
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
              onJumpToRoom={(room) => {
                setSelectedRoom(room);
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
          ((isOrigin && isBookingEditableByOrigin(rowMenu.menuItem, me)) || canGaRescheduleBooking(rowMenu.menuItem, me))
        }
        canDelete={!!rowMenu.menuItem && isOrigin && isBookingDeletableByOrigin(rowMenu.menuItem, me)}
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
          if (isOrigin && isBookingEditableByOrigin(item, me)) setDetail({ item, mode: "edit" });
          else if (canGaRescheduleBooking(item, me)) setRescheduleTarget(item);
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
        pdfUrl={rowMenu.menuItem && isBookingPdfAvailable(rowMenu.menuItem) ? api.bookingPdfUrl(rowMenu.menuItem.id) : undefined}
        onPdfClick={async () => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          try {
            await downloadFile(api.bookingPdfUrl(item.id), `Bukti-Booking-${item.nomorPemesanan || item.id}.pdf`);
          } catch (err) {
            showToast((err as Error).message, "error");
          }
        }}
        icsUrl={rowMenu.menuItem ? api.bookingIcsUrl(rowMenu.menuItem.id) : undefined}
        onIcsClick={async () => {
          const item = rowMenu.menuItem;
          rowMenu.close();
          if (!item) return;
          try {
            await downloadFile(api.bookingIcsUrl(item.id), `Booking-${item.nomorPemesanan || item.id}.ics`);
          } catch (err) {
            showToast((err as Error).message, "error");
          }
        }}
      />

      {me && (
        <RoomBookingFormModal
          open={formOpen}
          me={me}
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onCreated={reload}
        />
      )}

      {me && (
        <RoomBookingDetailModal
          open={!!detail}
          mode={detail?.mode || "view"}
          item={detail?.item || null}
          me={me}
          onClose={() => setDetail(null)}
          onSaved={reload}
          onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
        />
      )}

      <RoomBookingRescheduleModal
        open={!!rescheduleTarget}
        item={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onSaved={reload}
      />

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          reload();
        }}
      />

      <BookingStatusHistoryModal open={statusItemId != null} itemId={statusItemId} onClose={() => setStatusItemId(null)} />

      {me && (
        <RoomBookingChatModal
          open={!!chatItem}
          itemId={chatItem?.id ?? null}
          itemLabel={chatItem ? `${chatItem.namaKegiatan} - ${bookingRoomsLabel(chatItem)} - ${chatItem.nomorPemesanan || "-"}` : ""}
          departemen={chatItem?.departemen ?? null}
          createdByRole={chatItem?.createdByRole ?? null}
          me={me}
          onClose={() => setChatItem(null)}
          onRead={reload}
        />
      )}
    </>
  );
}

export default function BookingCalendarPage() {
  return (
    <Suspense fallback={null}>
      <BookingCalendarPageInner />
    </Suspense>
  );
}
