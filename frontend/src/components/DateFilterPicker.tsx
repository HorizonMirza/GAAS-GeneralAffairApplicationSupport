"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { itemVariants, sidebarVariants } from "./ui/menu";
import { useClickOutside } from "@/lib/useClickOutside";
import { todayLocalDate } from "@/lib/format";

const PANEL_HEIGHT_ESTIMATE = 340;

const MONTH_LONG = [
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

function formatIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

interface Props {
  id: string;
  // "" = no date chosen. Otherwise "YYYY-MM-DD", same shape as a native <input type="date">'s
  // value so this drops in as its replacement without touching callers' state shape.
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Replaces the plain <input type="date"> used for every "Filter Tanggal" across the app - same
// reasoning as MonthFilterPicker (the native picker's popup is OS/browser-rendered and cannot be
// restyled via CSS). Reuses the exact day-grid this app already draws in MiniMonthCalendar
// (weekday header, muted outside-month days, today/selected circle) rather than a new visual
// language, just without that component's per-day status dots.
export default function DateFilterPicker({ id, value, onChange, placeholder = "Semua Tanggal" }: Props) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([wrapRef], () => setOpen(false), open);

  const selected = value ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) : null;
  const [viewYear, setViewYear] = useState((selected ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected ?? new Date()).getMonth());

  useLayoutEffect(() => {
    if (!open) return;
    const base = selected ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    function recompute() {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDropUp(spaceBelow < PANEL_HEIGHT_ESTIMATE && spaceAbove > spaceBelow);
    }
    recompute();
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = todayLocalDate();
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

  function selectDay(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <div className="filter-picker" ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="filter-picker-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? "" : "searchable-select-placeholder"}>{value ? formatIso(value) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      </button>
      {open && (
        <motion.div
          className={`filter-picker-panel${dropUp ? " filter-picker-panel-up" : ""}`}
          initial="hidden"
          animate="visible"
          variants={sidebarVariants}
        >
          <motion.div className="mini-calendar-header" variants={itemVariants}>
            <span className="mini-calendar-title">{MONTH_LONG[viewMonth]} {viewYear}</span>
            <div className="mini-calendar-nav">
              <button type="button" onClick={prevMonth} aria-label="Bulan sebelumnya">‹</button>
              <button type="button" onClick={nextMonthNav} aria-label="Bulan berikutnya">›</button>
            </div>
          </motion.div>
          <motion.div className="mini-calendar-weekdays" variants={itemVariants}>
            {DAY_LABELS.map((d) => <span key={d}>{d}</span>)}
          </motion.div>
          <motion.div className="mini-calendar-grid" variants={itemVariants}>
            {cells.map((c) => {
              const isToday = c.iso === today;
              const isSelected = c.iso === value;
              const cls = ["mini-calendar-day"];
              if (c.muted) cls.push("mini-calendar-day-muted");
              if (isSelected) cls.push("mini-calendar-day-selected");
              else if (isToday) cls.push("mini-calendar-day-today");
              return (
                <button key={c.iso} type="button" className={cls.join(" ")} onClick={() => selectDay(c.iso)}>
                  <span className="mini-calendar-day-circle">
                    <span className="mini-calendar-day-num">{c.day}</span>
                  </span>
                </button>
              );
            })}
          </motion.div>
          <motion.div className="filter-picker-footer" variants={itemVariants}>
            <button type="button" className="filter-picker-link" onClick={() => selectDay(today)}>Hari Ini</button>
            {value && (
              <button
                type="button"
                className="filter-picker-link"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Hapus
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
