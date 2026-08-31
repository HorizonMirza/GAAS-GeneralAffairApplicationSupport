"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { formatDateTime } from "@/lib/format";
import type { BookingRuang, RoomOption } from "@/lib/types";

export type CalendarViewMode = "day" | "week" | "month" | "avail";

const HOURS = Array.from({ length: 11 }, (_, i) => 7 + i); // 07..17, each row = "HH:00 - (HH+1):00" (07:00-18:00)
// Mingguan's per-day column is narrow enough that more than a few side-by-side blocks become
// unreadable slivers - Harian has the whole page width so it's left uncapped (see buildDayPlan
// call sites below).
const MAX_VISIBLE_COLS_WEEK = 3;
// Ketersediaan's per-room column is even narrower than Mingguan's per-day column (many more
// rooms fit side by side), so a slot with several competing bookings gets capped tighter: 1 real
// block + an overflow chip once there's more than one.
const MAX_VISIBLE_COLS_AVAIL = 2;
const MONTH_NAMES_SHORT = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayIso(): string {
  return toIso(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return toIso(d);
}

export function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toIso(d);
}

export function isWeekend(iso: string): boolean {
  const dow = new Date(iso + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}

// Every room name in this app starts with "Ruang " - redundant once it's already a column
// header in a table titled "Ketersediaan Ruangan", and dropping it buys back width for names
// like "Ruang Solution Utama" packed 10-wide across the page. Full name stays in the tooltip.
function shortRoomName(nama: string): string {
  return nama.replace(/^Ruang\s+/i, "");
}

function parseHour(t: string): number {
  return Number(t.slice(0, 2));
}

function parseMinute(t: string): number {
  return Number(t.slice(3, 5));
}

// Draft = grey (private, not yet submitted), still-in-approval = orange (not a done deal yet),
// only the final Terkonfirmasi status gets green.
function scheduleCellStatusClass(status: BookingRuang["status"]): string {
  if (status === "DRAFT") return "schedule-cell-draft";
  if (status === "APPROVED_GA_APPROVAL") return "schedule-cell-confirmed";
  return "schedule-cell-pending";
}

// The "+N lainnya" overflow chip folds several entries into one box, which can mix statuses -
// same confirmed-beats-pending-beats-draft priority as everywhere else, so the chip's color
// reflects the most "real" booking hiding inside it rather than defaulting to one status.
function overflowStatusClass(entries: BookingRuang[]): string {
  if (entries.some((e) => e.status === "APPROVED_GA_APPROVAL")) return "schedule-cell-confirmed";
  if (entries.some((e) => e.status !== "DRAFT")) return "schedule-cell-pending";
  return "schedule-cell-draft";
}

interface ClusterItem {
  kind: "entry";
  entry: BookingRuang;
  startHour: number;
  endHour: number;
  col: number;
  colCount: number;
}

// Stands in for every entry beyond MAX_VISIBLE_COLS_WEEK's real columns - rendered as a single
// "+N lainnya" chip instead of shrinking every block into an unreadable sliver.
interface OverflowClusterItem {
  kind: "overflow";
  entries: BookingRuang[];
  col: number;
  colCount: number;
}

type AnyClusterItem = ClusterItem | OverflowClusterItem;

type CellPlan =
  | { type: "empty" }
  | { type: "skip" }
  | { type: "cluster"; rangeStart: number; rowSpan: number; items: AnyClusterItem[] };

interface TimedEntry {
  entry: BookingRuang;
  startHour: number;
  endHour: number;
}

// Active bookings can never overlap (conflict-checked at submit/approve time), but two DRAFTs -
// still private, not yet checked against each other - can, and so can a draft against something
// approved after it was created. Rather than let a later entry silently overwrite an earlier
// one's hours (corrupting the table), group overlapping entries into a cluster and lay them out
// side by side, like Google Calendar does for double-booked slots.
function layoutCluster(cluster: TimedEntry[], maxCols?: number): AnyClusterItem[] {
  const columns: TimedEntry[][] = [];
  for (const item of cluster) {
    const col = columns.find((c) => c[c.length - 1].endHour <= item.startHour);
    if (col) col.push(item);
    else columns.push([item]);
  }
  const colCount = columns.length;

  if (!maxCols || colCount <= maxCols) {
    return cluster.map((item) => ({
      kind: "entry",
      entry: item.entry,
      startHour: item.startHour,
      endHour: item.endHour,
      col: columns.findIndex((c) => c.includes(item)),
      colCount,
    }));
  }

  // Keep the first maxCols-1 columns as real blocks, fold every column from there on into one
  // overflow chip in the last slot.
  const visibleCols = maxCols - 1;
  const items: AnyClusterItem[] = [];
  const overflowEntries: BookingRuang[] = [];
  for (const item of cluster) {
    const col = columns.findIndex((c) => c.includes(item));
    if (col < visibleCols) {
      items.push({ kind: "entry", entry: item.entry, startHour: item.startHour, endHour: item.endHour, col, colCount: maxCols });
    } else {
      overflowEntries.push(item.entry);
    }
  }
  items.push({ kind: "overflow", entries: overflowEntries, col: visibleCols, colCount: maxCols });
  return items;
}

function buildDayPlan(dateEntries: BookingRuang[], maxCols?: number): Map<number, CellPlan> {
  const hourMap = new Map<number, CellPlan>();
  for (const hour of HOURS) hourMap.set(hour, { type: "empty" });

  // A whole-day entry is just a timed entry spanning the full HOURS range - folding it into the
  // same timed/cluster pipeline (instead of a separate short-circuit) means it lays out side by
  // side with any other booking on the same day/room instead of silently hiding them.
  const timed: TimedEntry[] = dateEntries
    .map((entry) => {
      if (entry.isWholeDay) return { entry, startHour: HOURS[0], endHour: HOURS[HOURS.length - 1] + 1 };
      if (!entry.jamMulai || !entry.jamSelesai) return null;
      const startHour = Math.max(HOURS[0], parseHour(entry.jamMulai));
      let endHour = parseHour(entry.jamSelesai);
      if (parseMinute(entry.jamSelesai) > 0) endHour += 1;
      endHour = Math.min(HOURS[HOURS.length - 1] + 1, Math.max(endHour, startHour + 1));
      return { entry, startHour, endHour };
    })
    .filter((e): e is TimedEntry => e !== null)
    .sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);

  // Sweep left to right, grouping any entries whose time ranges chain together (A overlaps B,
  // B overlaps C, ...) into one cluster even if A and C don't directly overlap each other.
  let cluster: TimedEntry[] = [];
  let clusterEnd = -1;
  const clusters: TimedEntry[][] = [];
  for (const item of timed) {
    if (cluster.length > 0 && item.startHour < clusterEnd) {
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endHour);
    } else {
      if (cluster.length > 0) clusters.push(cluster);
      cluster = [item];
      clusterEnd = item.endHour;
    }
  }
  if (cluster.length > 0) clusters.push(cluster);

  for (const group of clusters) {
    const rangeStart = Math.min(...group.map((g) => g.startHour));
    const rangeEnd = Math.max(...group.map((g) => g.endHour));
    const rowSpan = rangeEnd - rangeStart;
    hourMap.set(rangeStart, { type: "cluster", rangeStart, rowSpan, items: layoutCluster(group, maxCols) });
    for (let h = rangeStart + 1; h < rangeStart + rowSpan; h++) hourMap.set(h, { type: "skip" });
  }
  return hourMap;
}

export function formatPeriodLabel(view: CalendarViewMode, refDate: string): string {
  const d = new Date(refDate + "T00:00:00");
  if (view === "day") {
    return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (view === "week") {
    const mon = new Date(mondayOf(refDate) + "T00:00:00");
    const fri = new Date(addDays(mondayOf(refDate), 4) + "T00:00:00");
    if (mon.getMonth() === fri.getMonth()) {
      return `${mon.getDate()} - ${fri.getDate()} ${MONTH_NAMES_SHORT[mon.getMonth()]} ${mon.getFullYear()}`;
    }
    return `${mon.getDate()} ${MONTH_NAMES_SHORT[mon.getMonth()]} - ${fri.getDate()} ${MONTH_NAMES_SHORT[fri.getMonth()]} ${fri.getFullYear()}`;
  }
  return `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

interface DragState {
  // Column identity being dragged across: a date for Harian/Mingguan, a room name for
  // Ketersediaan (which fixes the date and varies the room per column instead).
  columnKey: string;
  startHour: number;
  currentHour: number;
  // Only meaningful for Ketersediaan (view === "avail"), where a drag can span several room
  // columns as well as hours - Harian/Mingguan drags stay pinned to a single column (see
  // continueDrag) so these two just track the drag's own starting column.
  startColIndex: number;
  currentColIndex: number;
}

interface Props {
  view: CalendarViewMode;
  refDate: string;
  entries: BookingRuang[];
  canCreate: boolean;
  // `room` is only passed when view === "avail" (the drag/click happened in that room's column).
  // `additionalRooms` is only meaningful there too - populated when the drag spanned more than
  // one room column.
  onSlotSelect: (date: string, startHour: number, endHour: number, room?: string, additionalRooms?: string[]) => void;
  onEntryMenuClick: (event: ReactMouseEvent, entry: BookingRuang) => void;
  onJumpToDay: (date: string) => void;
  // Only needed for view === "avail" - the set of room columns to lay out side by side.
  rooms?: RoomOption[];
  // Only needed for view === "avail" - the overflow chip there names a room, not a date, so it
  // can't reuse onJumpToDay (which would misinterpret the room name as a date).
  onJumpToRoom?: (room: string) => void;
}

export default function RoomCalendarView({ view, refDate, entries, canCreate, onSlotSelect, onEntryMenuClick, onJumpToDay, rooms, onJumpToRoom }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ columnKey: string; start: number; end: number; additionalRooms?: string[] } | null>(null);
  const isDragging = drag !== null;

  useEffect(() => {
    if (!isDragging) return;
    function finishDrag() {
      setDrag((current) => {
        if (current) {
          const start = Math.min(current.startHour, current.currentHour);
          const end = Math.max(current.startHour, current.currentHour) + 1;
          if (view === "avail" && rooms) {
            const loCol = Math.min(current.startColIndex, current.currentColIndex);
            const hiCol = Math.max(current.startColIndex, current.currentColIndex);
            const selectedRooms = rooms.slice(loCol, hiCol + 1).map((r) => r.nama);
            setPendingSelection({ columnKey: selectedRooms[0] ?? current.columnKey, start, end, additionalRooms: selectedRooms.slice(1) });
          } else {
            setPendingSelection({ columnKey: current.columnKey, start, end });
          }
        }
        return null;
      });
    }
    window.addEventListener("mouseup", finishDrag);
    return () => window.removeEventListener("mouseup", finishDrag);
  }, [isDragging, view, rooms]);

  // Notifying the parent must happen in its own effect, not synchronously inside the native
  // "mouseup" handler above - calling it there updates a parent component's state while this
  // component is still mid-render/commit for its own drag-state update, which React rejects.
  useEffect(() => {
    if (!pendingSelection) return;
    if (view === "avail") {
      onSlotSelect(refDate, pendingSelection.start, pendingSelection.end, pendingSelection.columnKey, pendingSelection.additionalRooms);
    } else {
      onSlotSelect(pendingSelection.columnKey, pendingSelection.start, pendingSelection.end);
    }
    setPendingSelection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelection]);

  function startDrag(columnKey: string, hour: number, cell: CellPlan | undefined, colIndex = 0) {
    if (!canCreate || !cell || cell.type !== "empty") return;
    setDrag({ columnKey, startHour: hour, currentHour: hour, startColIndex: colIndex, currentColIndex: colIndex });
  }

  // Harian/Mingguan pass no colIndex - a drag there stays pinned to the column it started in.
  // Ketersediaan passes colIndex on every cell, letting the drag range over room columns too.
  function continueDrag(columnKey: string, hour: number, colIndex?: number) {
    setDrag((current) => {
      if (!current) return current;
      if (colIndex === undefined) {
        return current.columnKey === columnKey ? { ...current, currentHour: hour } : current;
      }
      return { ...current, currentHour: hour, currentColIndex: colIndex };
    });
  }

  function isInDragRange(columnKey: string, hour: number): boolean {
    if (!drag || drag.columnKey !== columnKey) return false;
    const lo = Math.min(drag.startHour, drag.currentHour);
    const hi = Math.max(drag.startHour, drag.currentHour);
    return hour >= lo && hour <= hi;
  }

  function isInAvailDragRange(colIndex: number, hour: number): boolean {
    if (!drag) return false;
    const loCol = Math.min(drag.startColIndex, drag.currentColIndex);
    const hiCol = Math.max(drag.startColIndex, drag.currentColIndex);
    if (colIndex < loCol || colIndex > hiCol) return false;
    const loHour = Math.min(drag.startHour, drag.currentHour);
    const hiHour = Math.max(drag.startHour, drag.currentHour);
    return hour >= loHour && hour <= hiHour;
  }

  // Live "current time" indicator (like Google Calendar's red line) for the Harian/Mingguan/
  // Ketersediaan hour grid - only meaningful when today actually falls within what's on screen.
  const weekDatesForNowLine = view === "week" ? Array.from({ length: 5 }, (_, i) => addDays(mondayOf(refDate), i)) : [];
  const nowLineActive =
    (view === "day" && refDate === todayIso())
    || (view === "week" && weekDatesForNowLine.includes(todayIso()))
    || (view === "avail" && refDate === todayIso());

  const nowLineWrapRef = useRef<HTMLDivElement>(null);
  const nowLineRowRef = useRef<HTMLTableCellElement>(null);
  // Harian/Mingguan: the line sits under one column (the day/room being viewed). Ketersediaan
  // fixes the date and varies the room per column instead, so "now" applies to every room at
  // once - the line spans from the first room column's left edge to the last one's right edge.
  const nowLineColRef = useRef<HTMLTableCellElement>(null);
  const nowLineFirstColRef = useRef<HTMLTableCellElement>(null);
  const nowLineLastColRef = useRef<HTMLTableCellElement>(null);
  const [nowLineRect, setNowLineRect] = useState<{ top: number; height: number; left: number; width: number } | null>(null);
  const [, forceNowLineTick] = useState(0);

  // The line only needs to actually move once a minute - a cheap re-render is enough to recompute
  // its position from the current clock time against the already-measured row height below.
  useEffect(() => {
    if (!nowLineActive) return;
    const id = setInterval(() => forceNowLineTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [nowLineActive]);

  // Row height/column bounds only change on resize or when the grid's own content changes (e.g.
  // switching room/date) - re-measured whenever the view is active rather than tied to the clock.
  useEffect(() => {
    if (!nowLineActive) {
      setNowLineRect(null);
      return;
    }
    function measure() {
      const wrap = nowLineWrapRef.current;
      const row = nowLineRowRef.current;
      if (!wrap || !row) return;
      const wrapBox = wrap.getBoundingClientRect();
      const rowBox = row.getBoundingClientRect();
      let left: number;
      let width: number;
      if (view === "avail") {
        const first = nowLineFirstColRef.current;
        const last = nowLineLastColRef.current;
        if (!first || !last) return;
        const firstBox = first.getBoundingClientRect();
        const lastBox = last.getBoundingClientRect();
        left = firstBox.left - wrapBox.left;
        width = lastBox.left + lastBox.width - firstBox.left;
      } else {
        const col = nowLineColRef.current;
        if (!col) return;
        const colBox = col.getBoundingClientRect();
        left = colBox.left - wrapBox.left;
        width = colBox.width;
      }
      setNowLineRect({ top: rowBox.top - wrapBox.top, height: rowBox.height, left, width });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [nowLineActive, view, refDate, entries]);

  const nowLineHourFrac = (() => {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  })();
  const nowLineWithinHours = nowLineHourFrac >= HOURS[0] && nowLineHourFrac <= HOURS[HOURS.length - 1] + 1;
  const nowLineTop = nowLineRect ? nowLineRect.top + (nowLineHourFrac - HOURS[0]) * nowLineRect.height : null;
  const showNowLine = nowLineActive && nowLineWithinHours && nowLineRect != null && nowLineTop != null;

  if (view === "day") {
    if (isWeekend(refDate)) return <ClosedNotice />;
    const plan = buildDayPlan(entries.filter((e) => e.tanggal === refDate));
    return (
      <div className="table-wrap" ref={nowLineWrapRef} style={{ userSelect: drag ? "none" : undefined }}>
        <table className="data-table schedule-table">
          <thead>
            <tr>
              <th className="schedule-time-col schedule-th-center">Jam</th>
              <th className="schedule-th-center" ref={nowLineColRef}>{formatPeriodLabel("day", refDate)}</th>
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => {
              const cell = plan.get(hour);
              return (
                <tr key={hour}>
                  <td className="schedule-time-col" ref={hour === HOURS[0] ? nowLineRowRef : undefined}>{String(hour).padStart(2, "0")}:00</td>
                  <DayCell
                    cell={cell}
                    date={refDate}
                    canCreate={canCreate}
                    isDragPreview={isInDragRange(refDate, hour)}
                    onMouseDown={() => startDrag(refDate, hour, cell)}
                    onMouseEnter={() => continueDrag(refDate, hour)}
                    onEntryMenuClick={onEntryMenuClick}
                    onJumpToDay={onJumpToDay}
                  />
                </tr>
              );
            })}
            <tr className="schedule-closing-row">
              <td className="schedule-time-col">{String(HOURS[HOURS.length - 1] + 1).padStart(2, "0")}:00</td>
              <td />
            </tr>
          </tbody>
        </table>
        {showNowLine && (
          <div className="schedule-now-line" style={{ top: nowLineTop!, left: nowLineRect!.left, width: nowLineRect!.width }}>
            <span className="schedule-now-dot" />
          </div>
        )}
      </div>
    );
  }

  if (view === "week") {
    const monday = mondayOf(refDate);
    const weekDates = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
    const plans = weekDates.map((date) => buildDayPlan(entries.filter((e) => e.tanggal === date), MAX_VISIBLE_COLS_WEEK));
    return (
      <div className="table-wrap" ref={nowLineWrapRef} style={{ userSelect: drag ? "none" : undefined }}>
        <table className="data-table schedule-table">
          <thead>
            <tr>
              <th className="schedule-time-col schedule-th-center">Jam</th>
              {weekDates.map((date) => {
                const d = new Date(date + "T00:00:00");
                const isToday = date === todayIso();
                return (
                  <th
                    key={date}
                    ref={isToday ? nowLineColRef : undefined}
                    className={`schedule-week-head schedule-th-center${isToday ? " schedule-week-head-today" : ""}`}
                    onClick={() => onJumpToDay(date)}
                  >
                    {DAY_NAMES[d.getDay()]}{" "}
                    <span className={isToday ? "schedule-week-head-today-badge" : "text-secondary"}>{d.getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="schedule-time-col" ref={hour === HOURS[0] ? nowLineRowRef : undefined}>{String(hour).padStart(2, "0")}:00</td>
                {weekDates.map((date, idx) => {
                  const cell = plans[idx].get(hour);
                  return (
                    <DayCell
                      key={date}
                      cell={cell}
                      date={date}
                      canCreate={canCreate}
                      isDragPreview={isInDragRange(date, hour)}
                      onMouseDown={() => startDrag(date, hour, cell)}
                      onMouseEnter={() => continueDrag(date, hour)}
                      onEntryMenuClick={onEntryMenuClick}
                      onJumpToDay={onJumpToDay}
                      hideMeta
                    />
                  );
                })}
              </tr>
            ))}
            <tr className="schedule-closing-row">
              <td className="schedule-time-col">{String(HOURS[HOURS.length - 1] + 1).padStart(2, "0")}:00</td>
              <td colSpan={weekDates.length} />
            </tr>
          </tbody>
        </table>
        {showNowLine && (
          <div className="schedule-now-line" style={{ top: nowLineTop!, left: nowLineRect!.left, width: nowLineRect!.width }}>
            <span className="schedule-now-dot" />
          </div>
        )}
      </div>
    );
  }

  if (view === "avail") {
    if (isWeekend(refDate)) return <ClosedNotice />;
    const roomList = rooms || [];
    // Shows every status (like Harian/Mingguan) rather than Approved-only - competing pending
    // bookings for the same slot are real contention a room-hunter needs to see, not noise.
    const plans = roomList.map((r) => buildDayPlan(entries.filter((e) => e.namaRuang === r.nama || e.additionalRooms.includes(r.nama)), MAX_VISIBLE_COLS_AVAIL));
    return (
      <div className="table-wrap" ref={nowLineWrapRef} style={{ userSelect: drag ? "none" : undefined }}>
        <table className="data-table schedule-table">
          <thead>
            <tr>
              <th className="schedule-time-col schedule-th-center">Jam</th>
              {roomList.map((r, idx) => (
                <th
                  key={r.nama}
                  ref={(el) => {
                    if (idx === 0) nowLineFirstColRef.current = el;
                    if (idx === roomList.length - 1) nowLineLastColRef.current = el;
                  }}
                  className="schedule-th-center"
                  title={r.nama}
                >
                  {shortRoomName(r.nama)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="schedule-time-col" ref={hour === HOURS[0] ? nowLineRowRef : undefined}>{String(hour).padStart(2, "0")}:00</td>
                {roomList.map((r, idx) => {
                  const cell = plans[idx].get(hour);
                  return (
                    <DayCell
                      key={r.nama}
                      cell={cell}
                      date={r.nama}
                      canCreate={canCreate}
                      isDragPreview={isInAvailDragRange(idx, hour)}
                      onMouseDown={() => startDrag(r.nama, hour, cell, idx)}
                      onMouseEnter={() => continueDrag(r.nama, hour, idx)}
                      onEntryMenuClick={onEntryMenuClick}
                      onJumpToDay={(room) => onJumpToRoom?.(room)}
                      hideMeta
                    />
                  );
                })}
              </tr>
            ))}
            <tr className="schedule-closing-row">
              <td className="schedule-time-col">{String(HOURS[HOURS.length - 1] + 1).padStart(2, "0")}:00</td>
              <td colSpan={roomList.length} />
            </tr>
          </tbody>
        </table>
        {showNowLine && (
          <div className="schedule-now-line" style={{ top: nowLineTop!, left: nowLineRect!.left, width: nowLineRect!.width }}>
            <span className="schedule-now-dot" />
          </div>
        )}
      </div>
    );
  }

  // month view
  const d = new Date(refDate + "T00:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInThisMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { iso: string; day: number; muted: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    const day = daysInPrevMonth - startOffset + 1 + i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ iso: `${y}-${pad(m + 1)}-${pad(day)}`, day, muted: true });
  }
  for (let day = 1; day <= daysInThisMonth; day++) {
    cells.push({ iso: `${year}-${pad(month + 1)}-${pad(day)}`, day, muted: false });
  }
  let nextDay = 1;
  const nextMonthIdx = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  while (cells.length < 42) {
    cells.push({ iso: `${nextYear}-${pad(nextMonthIdx + 1)}-${pad(nextDay)}`, day: nextDay, muted: true });
    nextDay += 1;
  }

  const entriesByDate = new Map<string, BookingRuang[]>();
  for (const e of entries) {
    const list = entriesByDate.get(e.tanggal) || [];
    list.push(e);
    entriesByDate.set(e.tanggal, list);
  }

  const today = toIso(new Date());
  // Chunked into weeks (not one flat 42-cell grid) so each row can be a flex item that grows to
  // fill .month-grid's height (see .month-grid-row in globals.css) - keeps the grid's bottom
  // edge flush with the sidebar's instead of leaving blank space under it whenever the sidebar
  // ends up taller than the grid's own content.
  const weeks: { iso: string; day: number; muted: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="month-grid">
      <div className="month-grid-weekdays">
        {DAY_NAMES.slice(1).concat(DAY_NAMES[0]).map((n) => <span key={n}>{n}</span>)}
      </div>
      <div className="month-grid-body">
        {weeks.map((week, wi) => (
          <div className="month-grid-row" key={wi}>
            {week.map((c) => {
              const dayEntries = (entriesByDate.get(c.iso) || []).slice().sort((a, b) => {
                if (a.isWholeDay) return -1;
                if (b.isWholeDay) return 1;
                return (a.jamMulai || "").localeCompare(b.jamMulai || "");
              });
              const isToday = c.iso === today;
              return (
                <div key={c.iso} className={`month-cell${c.muted ? " month-cell-muted" : ""}`}>
                  <button type="button" className={`month-cell-daynum${isToday ? " month-cell-daynum-today" : ""}`} onClick={() => onJumpToDay(c.iso)}>
                    {c.day}
                  </button>
                  <div className="month-cell-events">
                    {dayEntries.slice(0, 2).map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`month-event-chip ${scheduleCellStatusClass(entry.status)}`}
                        onClick={(e) => onEntryMenuClick(e, entry)}
                      >
                        {entry.isWholeDay ? "Sepanjang Hari" : entry.jamMulai?.slice(0, 5)} {entry.namaKegiatan}{entry.hasConflict ? " ⚠" : ""}
                      </button>
                    ))}
                    {dayEntries.length > 2 && (
                      <button type="button" className="month-event-more" onClick={() => onJumpToDay(c.iso)}>
                        +{dayEntries.length - 2} lainnya
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosedNotice() {
  return (
    <div className="schedule-closed-notice">
      Ruang Meeting tutup pada hari sabtu dan minggu. Ruang Meeting tersedia pada hari Senin - Jumat, 07:00 - 18:00.
    </div>
  );
}

function DayCell({
  cell,
  date,
  canCreate,
  isDragPreview,
  onMouseDown,
  onMouseEnter,
  onEntryMenuClick,
  onJumpToDay,
  hideMeta,
}: {
  cell: CellPlan | undefined;
  date: string;
  canCreate: boolean;
  isDragPreview: boolean;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  onEntryMenuClick: (event: ReactMouseEvent, entry: BookingRuang) => void;
  onJumpToDay: (date: string) => void;
  // Mingguan's narrow per-day column already caps competing bookings to a few columns (see
  // MAX_VISIBLE_COLS_WEEK) - the "Diajukan: ..." submission-order line is one line too many at
  // that width, so it's dropped there and left only for Harian's much wider blocks. A single,
  // uncontested booking never shows this line either way (see the colCount > 1 check below).
  hideMeta?: boolean;
}) {
  if (!cell || cell.type === "skip") return null;

  if (cell.type === "empty") {
    if (!canCreate) return <td className="schedule-cell-empty-wrap schedule-cell-readonly" />;
    return (
      <td className="schedule-cell-empty-wrap" onMouseDown={onMouseDown} onMouseEnter={onMouseEnter}>
        <div className={`schedule-cell-empty${isDragPreview ? " schedule-cell-drag-preview" : ""}`} />
      </td>
    );
  }

  return (
    <td rowSpan={cell.rowSpan} className="schedule-cell-booked-wrap">
      {cell.items.map((item) => {
        const { col, colCount } = item;
        const widthPct = 100 / colCount;
        const leftPct = col * widthPct;
        const gapPx = colCount > 1 ? 2 : 0;

        if (item.kind === "overflow") {
          return (
            <div
              key={`overflow-${col}`}
              className={`schedule-cell-overflow ${overflowStatusClass(item.entries)}`}
              style={{
                top: "2px",
                height: "calc(100% - 4px)",
                left: `calc(${leftPct}% + ${gapPx}px)`,
                width: `calc(${widthPct}% - ${gapPx * 2}px)`,
              }}
              onClick={() => onJumpToDay(date)}
            >
              +{item.entries.length} lainnya
            </div>
          );
        }

        const { entry, startHour, endHour } = item;
        const statusClass = scheduleCellStatusClass(entry.status);
        const topPct = ((startHour - cell.rangeStart) / cell.rowSpan) * 100;
        const heightPct = ((endHour - startHour) / cell.rowSpan) * 100;
        // A 1-hour block is too short to fit the title and time as separate stacked lines
        // without the second line getting clipped by the next row - fold them onto one line.
        const isShort = endHour - startHour <= 1;
        // No spaces around the dash - every character counts to keep the full range on one line
        // inside Mingguan's narrow, capped-width columns (see MAX_VISIBLE_COLS_WEEK).
        const timeLabel = entry.isWholeDay ? "Sepanjang Hari" : `${entry.jamMulai?.slice(0, 5)}-${entry.jamSelesai?.slice(0, 5)}`;
        return (
          <div
            key={entry.id}
            className={`schedule-cell-booked ${statusClass}`}
            style={{
              top: `calc(${topPct}% + 2px)`,
              height: `calc(${heightPct}% - 4px)`,
              left: `calc(${leftPct}% + ${gapPx}px)`,
              width: `calc(${widthPct}% - ${gapPx * 2}px)`,
            }}
            onClick={(e) => onEntryMenuClick(e, entry)}
          >
            {isShort ? (
              <div className="schedule-cell-title-oneline">
                <span className="schedule-cell-title-inline">{entry.namaKegiatan}{entry.hasConflict ? " ⚠" : ""}</span>
                {" · "}
                {timeLabel}{entry.status === "DRAFT" ? " · Draft" : ""}
              </div>
            ) : (
              <>
                <div className="schedule-cell-title">{entry.namaKegiatan}{entry.hasConflict ? " ⚠" : ""}</div>
                <div className="schedule-cell-time">
                  {timeLabel}
                  {entry.status === "DRAFT" ? " · Draft" : ""}
                </div>
              </>
            )}
            {colCount > 1 && !hideMeta && entry.status !== "DRAFT" && (
              <div className="schedule-cell-meta">Diajukan: {formatDateTime(entry.createdAt)}</div>
            )}
          </div>
        );
      })}
    </td>
  );
}
