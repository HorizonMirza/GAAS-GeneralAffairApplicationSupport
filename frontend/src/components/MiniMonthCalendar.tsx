"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { BookingRuang } from "@/lib/types";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function todayIso(): string {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth(), d.getDate());
}

// Same 3-way grouping as the main calendar's block coloring (draft/pending/approved) - rejected
// bookings are a dead end nobody needs a dot for here, so they're deliberately left out.
function statusDotClass(status: BookingRuang["status"]): string | null {
  if (status === "DRAFT") return "mini-calendar-dot-draft";
  if (status === "APPROVED_GA_APPROVAL") return "mini-calendar-dot-approved";
  if (status === "SUBMITTED" || status === "APPROVED_L1" || status === "APPROVED_GA") return "mini-calendar-dot-pending";
  return null;
}

interface Props {
  selectedDate: string;
  onSelect: (date: string) => void;
  namaRuang?: string;
  // When the caller already has the exact same month's entries loaded (e.g. the Bulanan tab
  // fetches this identical 42-day range for its own grid), pass them here to skip this
  // component's own fetch entirely instead of doubling up on the same network request.
  entries?: BookingRuang[];
}

export default function MiniMonthCalendar({ selectedDate, onSelect, namaRuang, entries: providedEntries }: Props) {
  const initial = new Date(selectedDate + "T00:00:00");
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [dotsByDate, setDotsByDate] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => {
    const d = new Date(selectedDate + "T00:00:00");
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [selectedDate]);

  const today = todayIso();
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInThisMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { iso: string; day: number; muted: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    const day = daysInPrevMonth - startOffset + 1 + i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ iso: toIso(y, m, day), day, muted: true });
  }
  for (let d = 1; d <= daysInThisMonth; d++) {
    cells.push({ iso: toIso(viewYear, viewMonth, d), day: d, muted: false });
  }
  let nextDay = 1;
  const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  while (cells.length < 42) {
    cells.push({ iso: toIso(nextYear, nextMonthIdx, nextDay), day: nextDay, muted: true });
    nextDay += 1;
  }

  const rangeStart = cells[0].iso;
  const rangeEnd = cells[41].iso;

  function buildDotsMap(data: BookingRuang[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const entry of data) {
      const dotClass = statusDotClass(entry.status);
      if (!dotClass) continue;
      const set = map.get(entry.tanggal) || new Set<string>();
      set.add(dotClass);
      map.set(entry.tanggal, set);
    }
    return map;
  }

  // Fetches the whole visible 42-day grid (not just the current month) so the leading/trailing
  // muted days from adjacent months show their dots too, matching what's actually on screen -
  // skipped entirely when the caller already passed the same range's entries (see Props.entries).
  useEffect(() => {
    if (providedEntries) return;
    let cancelled = false;
    api
      .getBookingScheduleRange(rangeStart, rangeEnd, namaRuang)
      .then((data) => {
        if (cancelled) return;
        setDotsByDate(buildDotsMap(data));
      })
      .catch(() => setDotsByDate(new Map()));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd, namaRuang, providedEntries]);

  const providedDotsByDate = useMemo(
    () => (providedEntries ? buildDotsMap(providedEntries) : null),
    [providedEntries]
  );
  const effectiveDotsByDate = providedDotsByDate ?? dotsByDate;

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonthNav() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <div className="mini-calendar">
      <div className="mini-calendar-header">
        <span className="mini-calendar-title">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <div className="mini-calendar-nav">
          <button type="button" onClick={prevMonth} aria-label="Bulan sebelumnya">‹</button>
          <button type="button" onClick={nextMonthNav} aria-label="Bulan berikutnya">›</button>
        </div>
      </div>
      <div className="mini-calendar-weekdays">
        {DAY_LABELS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mini-calendar-grid">
        {cells.map((c) => {
          const isToday = c.iso === today;
          const isSelected = c.iso === selectedDate;
          const cls = ["mini-calendar-day"];
          if (c.muted) cls.push("mini-calendar-day-muted");
          // Selected always wins the filled-circle treatment, even when it's also today - today
          // only gets its own (text-only) styling while something else is selected.
          if (isSelected) cls.push("mini-calendar-day-selected");
          else if (isToday) cls.push("mini-calendar-day-today");
          const dots = Array.from(effectiveDotsByDate.get(c.iso) || []);
          return (
            <button key={c.iso} type="button" className={cls.join(" ")} onClick={() => onSelect(c.iso)}>
              <span className="mini-calendar-day-circle">
                <span className="mini-calendar-day-num">{c.day}</span>
              </span>
              {dots.length > 0 && (
                <span className="mini-calendar-day-dots">
                  {dots.map((d) => <span key={d} className={`mini-calendar-dot ${d}`} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
