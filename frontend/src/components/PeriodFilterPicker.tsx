"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { itemVariants, sidebarVariants } from "./ui/menu";
import { useClickOutside } from "@/lib/useClickOutside";
import { useExclusivePanel } from "@/lib/exclusivePanel";
import { todayLocalDate } from "@/lib/format";

const PANEL_HEIGHT_ESTIMATE = 420;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
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

// Generous fixed span (independent of the current selection) so the year list is a stable, quick
// scroll instead of shifting its own range around every time the filter changes.
function yearRange(): number[] {
  const nowYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = nowYear - 15; y <= nowYear + 10; y++) years.push(y);
  return years;
}

type Mode = "tanggal" | "bulan" | "tahun";

interface Props {
  id: string;
  // Same shapes as MonthFilterPicker/DateFilterPicker's own value props - "" means unset, and the
  // two are always mutually exclusive (only one of them ever holds a value at a time). bulan also
  // doubles as the year-only value: a bare "YYYY" (no dash) means "this whole year", matching what
  // every ApplyBulanFilter on the backend already accepts.
  bulan: string;
  tanggal: string;
  onChangeBulan: (value: string) => void;
  onChangeTanggal: (value: string) => void;
  placeholder?: string;
}

function detectMode(bulan: string, tanggal: string): Mode {
  if (tanggal) return "tanggal";
  if (bulan && bulan.length === 4) return "tahun";
  return "bulan";
}

// Merges what used to be two separate fields (Filter Bulan via MonthFilterPicker, Filter Tanggal
// via DateFilterPicker) into one picker with three explicit modes - search by a specific date,
// by month only, or by year only - since both underlying filters were always mutually exclusive
// anyway. Sits at "Filter Periode"; the standalone DateFilterPicker is retired everywhere this
// pairing existed.
export default function PeriodFilterPicker({ id, bulan, tanggal, onChangeBulan, onChangeTanggal, placeholder = "Semua Periode" }: Props) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [mode, setMode] = useState<Mode>(() => detectMode(bulan, tanggal));
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([wrapRef], () => setOpen(false), open);
  useExclusivePanel(open, () => setOpen(false));

  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const monthSelectRef = useRef<HTMLDivElement>(null);
  const yearSelectRef = useRef<HTMLDivElement>(null);
  const activeYearOptionRef = useRef<HTMLDivElement>(null);
  const activeTahunOptionRef = useRef<HTMLButtonElement>(null);
  useClickOutside([monthSelectRef], () => setMonthDropdownOpen(false), monthDropdownOpen);
  useClickOutside([yearSelectRef], () => setYearDropdownOpen(false), yearDropdownOpen);

  const selectedDate = tanggal ? new Date(Number(tanggal.slice(0, 4)), Number(tanggal.slice(5, 7)) - 1, Number(tanggal.slice(8, 10))) : null;
  const [viewYear, setViewYear] = useState((selectedDate ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState((selectedDate ?? new Date()).getMonth());

  const [selectedBulanYear, selectedBulanMonthIdx] = bulan && bulan.length === 7
    ? [Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)) - 1]
    : [null, null];
  const [bulanViewYear, setBulanViewYear] = useState(selectedBulanYear ?? new Date().getFullYear());

  const selectedTahun = bulan && bulan.length === 4 ? bulan : null;

  useEffect(() => {
    if (yearDropdownOpen) activeYearOptionRef.current?.scrollIntoView({ block: "center" });
  }, [yearDropdownOpen]);

  useEffect(() => {
    if (open && mode === "tahun") activeTahunOptionRef.current?.scrollIntoView({ block: "center" });
  }, [open, mode]);

  useLayoutEffect(() => {
    if (!open) return;
    setMode(detectMode(bulan, tanggal));
    const base = selectedDate ?? new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setBulanViewYear(selectedBulanYear ?? new Date().getFullYear());
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
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
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

  // Each of onChangeBulan/onChangeTanggal is wired by every caller to clear the other field as a
  // side effect (mirroring how MonthFilterPicker/DateFilterPicker's own onChange always did) - so
  // calling only the one that actually changed is enough; calling both back-to-back would have the
  // second call's "clear the other field" clobber the first call's own update.
  function selectDay(iso: string) {
    onChangeTanggal(iso);
    setOpen(false);
  }

  function selectBulanMonth(monthIdx: number) {
    onChangeBulan(`${bulanViewYear}-${pad(monthIdx + 1)}`);
    setOpen(false);
  }

  function selectTahun(year: number) {
    onChangeBulan(String(year));
    setOpen(false);
  }

  function clear() {
    onChangeBulan("");
    setOpen(false);
  }

  const triggerLabel = tanggal
    ? formatIso(tanggal)
    : bulan && bulan.length === 7
      ? `${MONTH_LONG[selectedBulanMonthIdx!]} ${selectedBulanYear}`
      : bulan && bulan.length === 4
        ? `Tahun ${bulan}`
        : placeholder;
  const hasValue = !!(tanggal || bulan);

  return (
    <div className="filter-picker" ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="filter-picker-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={hasValue ? "" : "searchable-select-placeholder"}>{triggerLabel}</span>
        <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && (
        <motion.div
          className={`filter-picker-panel filter-picker-panel-month${dropUp ? " filter-picker-panel-up" : ""}`}
          initial="hidden"
          animate="visible"
          variants={sidebarVariants}
        >
          <motion.div className="period-picker-tabs" variants={itemVariants}>
            <button type="button" className={`period-picker-tab${mode === "tanggal" ? " period-picker-tab-active" : ""}`} onClick={() => setMode("tanggal")}>Tanggal</button>
            <button type="button" className={`period-picker-tab${mode === "bulan" ? " period-picker-tab-active" : ""}`} onClick={() => setMode("bulan")}>Bulan</button>
            <button type="button" className={`period-picker-tab${mode === "tahun" ? " period-picker-tab-active" : ""}`} onClick={() => setMode("tahun")}>Tahun</button>
          </motion.div>

          {mode === "tanggal" && (
            <>
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
                  const isSelected = c.iso === tanggal;
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
                {hasValue && <button type="button" className="filter-picker-link" onClick={clear}>Hapus</button>}
              </motion.div>
            </>
          )}

          {mode === "bulan" && (
            <>
              <motion.div className="month-picker-year-nav" variants={itemVariants}>
                <button type="button" onClick={() => setBulanViewYear((y) => y - 1)} aria-label="Tahun sebelumnya">‹</button>
                <span>{bulanViewYear}</span>
                <button type="button" onClick={() => setBulanViewYear((y) => y + 1)} aria-label="Tahun berikutnya">›</button>
              </motion.div>
              <motion.div className="month-picker-grid" variants={itemVariants}>
                {MONTH_SHORT.map((label, idx) => {
                  const isSelected = bulanViewYear === selectedBulanYear && idx === selectedBulanMonthIdx;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`month-picker-cell${isSelected ? " month-picker-cell-selected" : ""}`}
                      onClick={() => selectBulanMonth(idx)}
                    >
                      {label}
                    </button>
                  );
                })}
              </motion.div>
              {hasValue && (
                <motion.button type="button" className="filter-picker-clear" variants={itemVariants} onClick={clear}>Hapus</motion.button>
              )}
            </>
          )}

          {mode === "tahun" && (
            <>
              <motion.div className="year-picker-grid" variants={itemVariants}>
                {yearRange().map((y) => (
                  <button
                    key={y}
                    ref={y === Number(selectedTahun) ? activeTahunOptionRef : undefined}
                    type="button"
                    className={`month-picker-cell${y === Number(selectedTahun) ? " month-picker-cell-selected" : ""}`}
                    onClick={() => selectTahun(y)}
                  >
                    {y}
                  </button>
                ))}
              </motion.div>
              {hasValue && (
                <motion.button type="button" className="filter-picker-clear" variants={itemVariants} onClick={clear}>Hapus</motion.button>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
