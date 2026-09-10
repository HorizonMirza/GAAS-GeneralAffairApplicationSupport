"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { itemVariants, sidebarVariants } from "./ui/menu";
import { useClickOutside } from "@/lib/useClickOutside";

// Rough upper bound on the panel's own height (year nav + 4-row month grid) - same estimate
// pattern as SearchableSelect's PANEL_HEIGHT_ESTIMATE, decided before paint so the panel never
// flashes downward for a frame before flipping.
const PANEL_HEIGHT_ESTIMATE = 260;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

interface Props {
  id: string;
  // "" = no month chosen (filter off). Otherwise "YYYY-MM", same shape as a native
  // <input type="month">'s value so this drops in as its replacement without touching callers'
  // state shape.
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Replaces the plain <input type="month"> used for every "Filter Bulan" across the app - the
// native control renders the OS/browser's own picker UI, which CSS cannot restyle at all, so
// matching the requested card-with-month-grid design meant building this instead.
export default function MonthFilterPicker({ id, value, onChange, placeholder = "Semua Bulan" }: Props) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([wrapRef], () => setOpen(false), open);

  const [selectedYear, selectedMonthIdx] = value
    ? [Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1]
    : [null, null];
  const [viewYear, setViewYear] = useState(selectedYear ?? new Date().getFullYear());

  useLayoutEffect(() => {
    if (!open) return;
    setViewYear(selectedYear ?? new Date().getFullYear());
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

  function selectMonth(monthIdx: number) {
    onChange(`${viewYear}-${pad(monthIdx + 1)}`);
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
        <span className={value ? "" : "searchable-select-placeholder"}>
          {value ? `${MONTH_LONG[selectedMonthIdx!]} ${selectedYear}` : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      </button>
      {open && (
        <motion.div
          className={`filter-picker-panel${dropUp ? " filter-picker-panel-up" : ""}`}
          initial="hidden"
          animate="visible"
          variants={sidebarVariants}
        >
          <motion.div className="month-picker-year-nav" variants={itemVariants}>
            <button type="button" onClick={() => setViewYear((y) => y - 1)} aria-label="Tahun sebelumnya">‹</button>
            <span>{viewYear}</span>
            <button type="button" onClick={() => setViewYear((y) => y + 1)} aria-label="Tahun berikutnya">›</button>
          </motion.div>
          <motion.div className="month-picker-grid" variants={itemVariants}>
            {MONTH_SHORT.map((label, idx) => {
              const isSelected = viewYear === selectedYear && idx === selectedMonthIdx;
              return (
                <button
                  key={label}
                  type="button"
                  className={`month-picker-cell${isSelected ? " month-picker-cell-selected" : ""}`}
                  onClick={() => selectMonth(idx)}
                >
                  {label}
                </button>
              );
            })}
          </motion.div>
          {value && (
            <motion.button
              type="button"
              className="filter-picker-clear"
              variants={itemVariants}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Hapus
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  );
}
