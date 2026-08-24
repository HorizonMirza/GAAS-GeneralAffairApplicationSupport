"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import type { BookingRuang } from "@/lib/types";

export type CalendarViewMode = "day" | "week" | "month";

const HOURS = Array.from({ length: 11 }, (_, i) => 7 + i); // 07..17, each row = "HH:00 - (HH+1):00" (07:00-18:00)
const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DAY_NAMES_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

interface ClusterItem {
  entry: BookingRuang;
  startHour: number;
  endHour: number;
  col: number;
  colCount: number;
}

type CellPlan =
  | { type: "empty" }
  | { type: "skip" }
  | { type: "cluster"; rangeStart: number; rowSpan: number; items: ClusterItem[] };

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
function layoutCluster(cluster: TimedEntry[]): ClusterItem[] {
  const columns: TimedEntry[][] = [];
  for (const item of cluster) {
    const col = columns.find((c) => c[c.length - 1].endHour <= item.startHour);
    if (col) col.push(item);
    else columns.push([item]);
  }
  const colCount = columns.length;
  return cluster.map((item) => ({
    entry: item.entry,
    startHour: item.startHour,
    endHour: item.endHour,
    col: columns.findIndex((c) => c.includes(item)),
    colCount,
  }));
}

function buildDayPlan(dateEntries: BookingRuang[]): Map<number, CellPlan> {
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
    hourMap.set(rangeStart, { type: "cluster", rangeStart, rowSpan, items: layoutCluster(group) });
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
  date: string;
  startHour: number;
  currentHour: number;
}

interface Props {
  view: CalendarViewMode;
  refDate: string;
  entries: BookingRuang[];
  canCreate: boolean;
  onSlotSelect: (date: string, startHour: number, endHour: number) => void;
  onEntryClick: (entry: BookingRuang) => void;
  onJumpToDay: (date: string) => void;
}

export default function RoomCalendarView({ view, refDate, entries, canCreate, onSlotSelect, onEntryClick, onJumpToDay }: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ date: string; start: number; end: number } | null>(null);
  const isDragging = drag !== null;

  useEffect(() => {
    if (!isDragging) return;
    function finishDrag() {
      setDrag((current) => {
        if (current) {
          const start = Math.min(current.startHour, current.currentHour);
          const end = Math.max(current.startHour, current.currentHour) + 1;
          setPendingSelection({ date: current.date, start, end });
        }
        return null;
      });
    }
    window.addEventListener("mouseup", finishDrag);
    return () => window.removeEventListener("mouseup", finishDrag);
  }, [isDragging]);

  // Notifying the parent must happen in its own effect, not synchronously inside the native
  // "mouseup" handler above - calling it there updates a parent component's state while this
  // component is still mid-render/commit for its own drag-state update, which React rejects.
  useEffect(() => {
    if (!pendingSelection) return;
    onSlotSelect(pendingSelection.date, pendingSelection.start, pendingSelection.end);
    setPendingSelection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelection]);

  function startDrag(date: string, hour: number, cell: CellPlan | undefined) {
    if (!canCreate || !cell || cell.type !== "empty") return;
    setDrag({ date, startHour: hour, currentHour: hour });
  }

  function continueDrag(date: string, hour: number) {
    setDrag((current) => (current && current.date === date ? { ...current, currentHour: hour } : current));
  }

  function isInDragRange(date: string, hour: number): boolean {
    if (!drag || drag.date !== date) return false;
    const lo = Math.min(drag.startHour, drag.currentHour);
    const hi = Math.max(drag.startHour, drag.currentHour);
    return hour >= lo && hour <= hi;
  }

  if (view === "day") {
    if (isWeekend(refDate)) return <ClosedNotice />;
    const plan = buildDayPlan(entries.filter((e) => e.tanggal === refDate));
    return (
      <div className="table-wrap" style={{ userSelect: drag ? "none" : undefined }}>
        <table className="data-table schedule-table">
          <thead>
            <tr>
              <th className="schedule-time-col schedule-th-center">Jam</th>
              <th className="schedule-th-center">{formatPeriodLabel("day", refDate)}</th>
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => {
              const cell = plan.get(hour);
              return (
                <tr key={hour}>
                  <td className="schedule-time-col">{String(hour).padStart(2, "0")}:00</td>
                  <DayCell
                    cell={cell}
                    canCreate={canCreate}
                    isDragPreview={isInDragRange(refDate, hour)}
                    onMouseDown={() => startDrag(refDate, hour, cell)}
                    onMouseEnter={() => continueDrag(refDate, hour)}
                    onEntryClick={onEntryClick}
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
      </div>
    );
  }

  if (view === "week") {
    const monday = mondayOf(refDate);
    const weekDates = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
    const plans = weekDates.map((date) => buildDayPlan(entries.filter((e) => e.tanggal === date)));
    return (
      <div className="table-wrap" style={{ userSelect: drag ? "none" : undefined }}>
        <table className="data-table schedule-table">
          <thead>
            <tr>
              <th className="schedule-time-col">Jam</th>
              {weekDates.map((date) => {
                const d = new Date(date + "T00:00:00");
                return (
                  <th key={date} className="schedule-week-head" onClick={() => onJumpToDay(date)}>
                    {DAY_NAMES_SHORT[d.getDay()]} <span className="text-secondary">{d.getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="schedule-time-col">{String(hour).padStart(2, "0")}:00</td>
                {weekDates.map((date, idx) => {
                  const cell = plans[idx].get(hour);
                  return (
                    <DayCell
                      key={date}
                      cell={cell}
                      canCreate={canCreate}
                      isDragPreview={isInDragRange(date, hour)}
                      onMouseDown={() => startDrag(date, hour, cell)}
                      onMouseEnter={() => continueDrag(date, hour)}
                      onEntryClick={onEntryClick}
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

  return (
    <div className="month-grid">
      <div className="month-grid-weekdays">
        {DAY_NAMES_SHORT.slice(1).concat(DAY_NAMES_SHORT[0]).map((n) => <span key={n}>{n}</span>)}
      </div>
      <div className="month-grid-cells">
        {cells.map((c) => {
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
                {dayEntries.slice(0, 3).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`month-event-chip ${scheduleCellStatusClass(entry.status)}`}
                    onClick={() => onEntryClick(entry)}
                  >
                    {entry.isWholeDay ? "Sepanjang Hari" : entry.jamMulai?.slice(0, 5)} {entry.namaKegiatan}{entry.hasConflict ? " ⚠" : ""}
                  </button>
                ))}
                {dayEntries.length > 3 && (
                  <button type="button" className="month-event-more" onClick={() => onJumpToDay(c.iso)}>
                    +{dayEntries.length - 3} lainnya
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
  canCreate,
  isDragPreview,
  onMouseDown,
  onMouseEnter,
  onEntryClick,
}: {
  cell: CellPlan | undefined;
  canCreate: boolean;
  isDragPreview: boolean;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  onEntryClick: (entry: BookingRuang) => void;
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
      {cell.items.map(({ entry, startHour, endHour, col, colCount }) => {
        const statusClass = scheduleCellStatusClass(entry.status);
        const topPct = ((startHour - cell.rangeStart) / cell.rowSpan) * 100;
        const heightPct = ((endHour - startHour) / cell.rowSpan) * 100;
        const widthPct = 100 / colCount;
        const leftPct = col * widthPct;
        const gapPx = colCount > 1 ? 2 : 0;
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
            onClick={() => onEntryClick(entry)}
          >
            <div className="schedule-cell-title">{entry.namaKegiatan}{entry.hasConflict ? " ⚠" : ""}</div>
            <div className="schedule-cell-time">
              {entry.isWholeDay ? "Sepanjang Hari" : `${entry.jamMulai?.slice(0, 5)} - ${entry.jamSelesai?.slice(0, 5)}`}
              {entry.status === "DRAFT" ? " · Draft" : ""}
            </div>
            {colCount > 1 && entry.status !== "DRAFT" && (
              <div className="schedule-cell-meta">Diajukan: {formatDateTime(entry.createdAt)}</div>
            )}
          </div>
        );
      })}
    </td>
  );
}
