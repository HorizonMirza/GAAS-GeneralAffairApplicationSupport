"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/ToastProvider";
import type { BookingRuang, BookingRuangCreatePayload, RoomOption } from "@/lib/types";
import RoomCalendarView, { addDays, addMonths, mondayOf, type CalendarViewMode } from "@/components/RoomCalendarView";
import MiniMonthCalendar from "@/components/MiniMonthCalendar";
import RoomBookingFormModal from "@/components/RoomBookingFormModal";
import RoomBookingDetailModal from "@/components/RoomBookingDetailModal";
import RejectModal, { type RejectType } from "@/components/RejectModal";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeForView(view: CalendarViewMode, refDate: string): { from: string; to: string } {
  if (view === "day") return { from: refDate, to: refDate };
  if (view === "week") {
    const monday = mondayOf(refDate);
    return { from: monday, to: addDays(monday, 4) };
  }
  const d = new Date(refDate + "T00:00:00");
  const firstOfMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  const start = mondayOf(firstOfMonth);
  return { from: start, to: addDays(start, 41) };
}

export default function BookingCalendarPage() {
  const { me, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [view, setView] = useState<CalendarViewMode>("day");
  const [refDate, setRefDate] = useState<string>(todayIso());
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [entries, setEntries] = useState<BookingRuang[]>([]);
  const [search, setSearch] = useState("");
  const [scheduleBusy, setScheduleBusy] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<BookingRuangCreatePayload> | undefined>(undefined);
  const [detail, setDetail] = useState<{ item: BookingRuang; mode: "view" | "edit" } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; type: RejectType; originLabel: string } | null>(null);

  const isOrigin = me
    ? ["ADMIN_DEPARTEMEN", "APPROVAL_DEPARTEMEN", "ADMIN_DIVISI", "APPROVAL_DIVISI"].includes(me.role)
    : false;

  useEffect(() => {
    if (!loading && me?.role === "SUPER_ADMIN") router.replace("/superadmin");
  }, [loading, me, router]);

  useEffect(() => {
    api.listRooms().then((list) => {
      setRooms(list);
      setSelectedRoom((current) => current || list[0]?.nama || "");
    }).catch(() => setRooms([]));
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!selectedRoom) return;
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
    loadSchedule();
  }, [loadSchedule]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      e.namaKegiatan.toLowerCase().includes(q)
      || (e.departemen || "").toLowerCase().includes(q)
      || (e.divisi || "").toLowerCase().includes(q)
    );
  }, [entries, search]);

  function goToday() {
    setRefDate(todayIso());
  }

  function goPrev() {
    if (view === "day") setRefDate((d) => addDays(d, -1));
    else if (view === "week") setRefDate((d) => addDays(d, -7));
    else setRefDate((d) => addMonths(d, -1));
  }

  function goNext() {
    if (view === "day") setRefDate((d) => addDays(d, 1));
    else if (view === "week") setRefDate((d) => addDays(d, 7));
    else setRefDate((d) => addMonths(d, 1));
  }

  function openCreateForm() {
    setFormInitial({ namaRuang: selectedRoom, tanggal: refDate });
    setFormOpen(true);
  }

  if (!me || me.role === "SUPER_ADMIN") return null;

  return (
    <>
      <div className="calendar-shell">
        <div className="calendar-sidebar">
          {isOrigin && (
            <button type="button" className="btn btn-primary btn-header-action" style={{ width: "auto" }} onClick={openCreateForm}>
              + Booking Ruang Meeting
            </button>
          )}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="calendar-room-select">Ruangan</label>
            <select id="calendar-room-select" value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}>
              {rooms.map((r) => (
                <option key={r.nama} value={r.nama}>{r.nama}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="calendar-search-input">Cari Kegiatan</label>
            <input
              type="text"
              id="calendar-search-input"
              className="calendar-search-input"
              placeholder="Cari kegiatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="calendar-date-input">Tanggal</label>
            <input type="date" id="calendar-date-input" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
          </div>
          <MiniMonthCalendar selectedDate={refDate} onSelect={setRefDate} />
        </div>

        <div className="calendar-main">
          <div className="calendar-topbar">
            <div className="calendar-topbar-left">
              <button type="button" className="btn btn-secondary btn-sm" style={{ width: "auto" }} onClick={goToday}>Hari Ini</button>
              <button className="page-btn" onClick={goPrev} aria-label="Sebelumnya">‹</button>
              <button className="page-btn" onClick={goNext} aria-label="Berikutnya">›</button>
              <div className="calendar-topbar-room">{selectedRoom}</div>
            </div>
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
          </div>

          {scheduleBusy ? (
            <p className="text-secondary">Memuat jadwal...</p>
          ) : (
            <RoomCalendarView
              view={view}
              refDate={refDate}
              entries={filteredEntries}
              canCreate={isOrigin}
              onSlotClick={(date, jam) => {
                if (!isOrigin) return;
                setFormInitial({
                  namaRuang: selectedRoom,
                  tanggal: date,
                  jamMulai: `${String(jam).padStart(2, "0")}:00`,
                  jamSelesai: `${String(jam + 1).padStart(2, "0")}:00`,
                });
                setFormOpen(true);
              }}
              onEntryClick={(entry) => setDetail({ item: entry, mode: "view" })}
              onJumpToDay={(date) => {
                setRefDate(date);
                setView("day");
              }}
            />
          )}
        </div>
      </div>

      {me && (
        <RoomBookingFormModal
          open={formOpen}
          me={me}
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onCreated={loadSchedule}
        />
      )}

      {me && (
        <RoomBookingDetailModal
          open={!!detail}
          mode={detail?.mode || "view"}
          item={detail?.item || null}
          me={me}
          onClose={() => setDetail(null)}
          onSaved={loadSchedule}
          onRequestReject={(id, type, originLabel) => setRejectTarget({ id, type, originLabel })}
        />
      )}

      <RejectModal
        open={!!rejectTarget}
        targetId={rejectTarget?.id ?? null}
        targetType={rejectTarget?.type ?? null}
        originLabel={rejectTarget?.originLabel ?? ""}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          loadSchedule();
        }}
      />
    </>
  );
}
