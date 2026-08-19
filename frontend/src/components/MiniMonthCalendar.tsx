"use client";

import { useEffect, useState } from "react";

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

interface Props {
  selectedDate: string;
  onSelect: (date: string) => void;
}

export default function MiniMonthCalendar({ selectedDate, onSelect }: Props) {
  const initial = new Date(selectedDate + "T00:00:00");
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

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
          if (isToday) cls.push("mini-calendar-day-today");
          else if (isSelected) cls.push("mini-calendar-day-selected");
          return (
            <button key={c.iso} type="button" className={cls.join(" ")} onClick={() => onSelect(c.iso)}>
              {c.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
