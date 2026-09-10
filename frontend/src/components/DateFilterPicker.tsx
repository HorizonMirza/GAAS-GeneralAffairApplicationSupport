"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { itemVariants, sidebarVariants } from "./ui/menu";
import { useClickOutside } from "@/lib/useClickOutside";
import { useExclusivePanel } from "@/lib/exclusivePanel";
import { todayLocalDate } from "@/lib/format";

const PANEL_HEIGHT_ESTIMATE = 380;

const MONTH_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

// A generous fixed span rather than tied to the selected date, so the year list itself is a
// stable, quick scroll (same as the "September"/"2026" pair this mirrors) instead of shifting its
// own range around every time the filter changes.
function yearRange(): number[] {
  const nowYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = nowYear - 15; y <= nowYear + 10; y++) years.push(y);
  return years;
}

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
  // Read-only display mode (Detail modal's non-edit view) - same convention as
  // SearchableSelect's disabled prop: trigger becomes an inert <button disabled>, panel never opens.
  disabled?: boolean;
  // Required form fields (e.g. Tanggal Laporan) hide the "Hapus" link so the picker can't be
  // cleared back to empty - defaults to true (filter-picker behavior, unchanged for every
  // existing caller).
  clearable?: boolean;
  // "YYYY-MM-DD" floor (e.g. Room Booking's "Berulang Sampai Tanggal" can't precede the booking's
  // own Tanggal) - days before it render muted and can't be picked, same treatment as an
  // out-of-month day.
  minDate?: string;
}

// Replaces the plain <input type="date"> used for every "Filter Tanggal" across the app - same
// reasoning as MonthFilterPicker (the native picker's popup is OS/browser-rendered and cannot be
// restyled via CSS). Month/Year are each their own dropdown select (not prev/next arrows) so
// jumping to a distant month or year doesn't take a long click-through, then a day grid below
// reuses this app's existing MiniMonthCalendar day-cell styling (weekday header, muted outside-
// month days, today/selected circle) for visual consistency with the rest of the app.
export default function DateFilterPicker({ id, value, onChange, placeholder = "Semua Tanggal", disabled, clearable = true, minDate }: Props) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const monthSelectRef = useRef<HTMLDivElement>(null);
  const yearSelectRef = useRef<HTMLDivElement>(null);
  const activeYearOptionRef = useRef<HTMLDivElement>(null);
  useClickOutside([wrapRef], () => setOpen(false), open);
  useClickOutside([monthSelectRef], () => setMonthDropdownOpen(false), monthDropdownOpen);
  useClickOutside([yearSelectRef], () => setYearDropdownOpen(false), yearDropdownOpen);
  useExclusivePanel(open, () => setOpen(false));

  // The year list runs 26 rows deep (see yearRange) - jump straight to the current selection
  // instead of leaving whoever opens it to scroll and hunt for it themselves.
  useEffect(() => {
    if (yearDropdownOpen) activeYearOptionRef.current?.scrollIntoView({ block: "center" });
  }, [yearDropdownOpen]);

  const selected = value ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) : null;
  const [viewYear, setViewYear] = useState((selected ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected ?? new Date()).getMonth());

  useLayoutEffect(() => {
    if (!open) return;
    const base = selected ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setMonthDropdownOpen(false);
    setYearDropdownOpen(false);
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
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? "" : "searchable-select-placeholder"}>{value ? formatIso(value) : placeholder}</span>
        <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && !disabled && (
        <motion.div
          className={`filter-picker-panel${dropUp ? " filter-picker-panel-up" : ""}`}
          initial="hidden"
          animate="visible"
          variants={sidebarVariants}
        >
          <motion.div className="date-picker-header" variants={itemVariants}>
            <div className="date-picker-select-wrap" ref={monthSelectRef}>
              <button
                type="button"
                className="date-picker-select-trigger"
                aria-expanded={monthDropdownOpen}
                onClick={() => { setMonthDropdownOpen((v) => !v); setYearDropdownOpen(false); }}
              >
                {MONTH_LONG[viewMonth]}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              {monthDropdownOpen && (
                <div className="date-picker-select-dropdown">
                  {MONTH_LONG.map((m, idx) => (
                    <div
                      key={m}
                      className={`date-picker-select-option${idx === viewMonth ? " date-picker-select-option-active" : ""}`}
                      onClick={() => { setViewMonth(idx); setMonthDropdownOpen(false); }}
                    >
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="date-picker-select-wrap" ref={yearSelectRef}>
              <button
                type="button"
                className="date-picker-select-trigger"
                aria-expanded={yearDropdownOpen}
                onClick={() => { setYearDropdownOpen((v) => !v); setMonthDropdownOpen(false); }}
              >
                {viewYear}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              {yearDropdownOpen && (
                <div className="date-picker-select-dropdown date-picker-select-dropdown-scroll">
                  {yearRange().map((y) => (
                    <div
                      key={y}
                      ref={y === viewYear ? activeYearOptionRef : undefined}
                      className={`date-picker-select-option${y === viewYear ? " date-picker-select-option-active" : ""}`}
                      onClick={() => { setViewYear(y); setYearDropdownOpen(false); }}
                    >
                      {y}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
          <motion.div className="mini-calendar-weekdays" variants={itemVariants}>
            {DAY_LABELS.map((d) => <span key={d}>{d}</span>)}
          </motion.div>
          <motion.div className="mini-calendar-grid filter-picker-day-grid" variants={itemVariants}>
            {cells.map((c) => {
              const isToday = c.iso === today;
              const isSelected = c.iso === value;
              const isBeforeMin = !!minDate && c.iso < minDate;
              const cls = ["mini-calendar-day"];
              if (c.muted || isBeforeMin) cls.push("mini-calendar-day-muted");
              if (isSelected) cls.push("mini-calendar-day-selected");
              else if (isToday) cls.push("mini-calendar-day-today");
              return (
                <button key={c.iso} type="button" className={cls.join(" ")} disabled={isBeforeMin} onClick={() => selectDay(c.iso)}>
                  <span className="mini-calendar-day-circle">
                    <span className="mini-calendar-day-num">{c.day}</span>
                  </span>
                </button>
              );
            })}
          </motion.div>
          <motion.div className="filter-picker-footer" variants={itemVariants}>
            <button type="button" className="filter-picker-link" onClick={() => selectDay(today)}>Hari Ini</button>
            {clearable && value && (
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
