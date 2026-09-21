"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { itemVariants, sidebarVariants } from "./ui/menu";
import { useClickOutside } from "@/lib/useClickOutside";

// A data-driven estimate of the panel's own rendered height, used to decide whether it fits below
// the trigger without having to wait for a real layout measurement of the panel itself (which
// would mean rendering it top-anchored first and flipping a frame later - a visible flash). Built
// from the same numbers the CSS actually uses, rather than one flat worst-case number: a 2-option
// dropdown (e.g. Asuransi's "Tidak"/"Ya") is a fraction of a long searchable list's height, and
// treating every dropdown as if it were the tallest one flips even a tiny list upward whenever
// it's merely somewhere in the lower half of a tall scrollable modal - covering fields below it
// that would have had plenty of room.
const PANEL_PADDING = 16; // .searchable-select-panel: 8px top + 8px bottom
const OPTION_ROW_HEIGHT = 36; // .searchable-select-option: ~8px+8px padding + one line of text
const SEARCH_INPUT_HEIGHT = 42; // .searchable-select-search: ~8px+8px padding + line + 6px margin
const OPTIONS_LIST_MAX_HEIGHT = 220; // .searchable-select-options: max-height

function estimatePanelHeight(optionCount: number, hasSearch: boolean): number {
  const optionsHeight = Math.min(optionCount * OPTION_ROW_HEIGHT, OPTIONS_LIST_MAX_HEIGHT);
  return PANEL_PADDING + (hasSearch ? SEARCH_INPUT_HEIGHT : 0) + optionsHeight;
}

interface Props {
  id: string;
  // undefined = nothing chosen yet (shows `placeholder`, greyed out - callers should treat this
  // as invalid/incomplete for a required field). "" is a real, deliberate selection distinct from
  // "unset" - only reachable via `clearLabel`'s pinned row - and any other string is a normal
  // option. This three-state split lets a field stay required (must click *something*) while
  // still letting one of the choices explicitly mean "none of the below" (e.g. Departemen's
  // "Kebutuhan Divisi ini" pinned row, which the caller maps to a null Departemen on submit).
  value: string | undefined;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  // When set, shows a pinned first row with this label, always visible regardless of the search
  // query, that selects "" - e.g. Departemen's "Kebutuhan Divisi ini (tanpa Departemen spesifik)".
  clearLabel?: string;
  disabled?: boolean;
  emptyOptionsText?: string;
  // Maps an option's underlying value (e.g. a status code) to what's actually shown/searched -
  // e.g. "APPROVED_GA_APPROVAL" -> "Approved". Defaults to the value itself when omitted, so every
  // existing plain-string caller is unaffected.
  getLabel?: (value: string) => string;
  // When explicitly false, disables/hides the search input regardless of option count
  searchable?: boolean;
}

// Click-to-open, type-to-filter single select - same collapsed-by-default trigger/panel pattern
// as RoomMultiSelect, but for picking one value out of a long list (e.g. every Divisi/Departemen
// in the org tree) without having to scroll through it one by one.
export default function SearchableSelect({ id, value, onChange, options, placeholder, clearLabel, disabled, emptyOptionsText, getLabel, searchable }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useClickOutside([wrapRef], () => setOpen(false), open);
  const label = (v: string) => (getLabel ? getLabel(v) : v);
  // A handful of options is faster to just scan by eye - the search box only earns its keep
  // (and the extra click-to-focus step) once there's enough of a list to actually search through.
  const showSearch = searchable !== undefined ? searchable : options.length > 5;

  // Decided before paint (useLayoutEffect, not useEffect) so the panel never flashes downward
  // for a frame before flipping - a trigger near the bottom of a tall modal would otherwise open
  // its panel straight off the bottom of the viewport, forcing the whole page to be scrolled just
  // to see the rest of the list.
  useLayoutEffect(() => {
    if (!open) return;
    const panelHeightEstimate = estimatePanelHeight(options.length + (clearLabel ? 1 : 0), showSearch);
    function recompute() {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDropUp(spaceBelow < panelHeightEstimate && spaceAbove > spaceBelow);
    }
    recompute();
    // `true` = capture phase, so this also fires for scroll events on an ancestor scroll
    // container (e.g. the modal overlay) rather than only on window itself - scroll doesn't
    // bubble, but capture-phase listeners on an ancestor still see it on the way down.
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [open, options.length, clearLabel, showSearch]);

  useEffect(() => {
    if (open && showSearch) {
      setQuery("");
      // Focus after the panel actually mounts, not on the same tick as setOpen.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, showSearch]);

  const filtered = showSearch && query.trim()
    ? options.filter((o) => label(o).toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function select(next: string) {
    onChange(next);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Stopped unconditionally (not just on the branches below) - this is a plain <input>, so
    // without this an Enter/Escape here would otherwise also reach the parent <form>'s
    // focusNextFieldOnEnter/ModalOverlay's Escape-to-close, jumping focus or closing the whole
    // modal out from under an open search panel instead of just acting on the search itself.
    e.stopPropagation();
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && filtered.length === 1) {
      e.preventDefault();
      select(filtered[0]);
    }
  }

  return (
    <div className="searchable-select" ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="searchable-select-trigger"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value === undefined ? "searchable-select-placeholder" : ""}>
          {value === undefined ? placeholder : value === "" ? clearLabel || placeholder : label(value)}
        </span>
        <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && !disabled && (
        <motion.div
          className={`searchable-select-panel${dropUp ? " searchable-select-panel-up" : ""}`}
          initial="hidden"
          animate="visible"
          variants={sidebarVariants}
        >
          {showSearch && (
            <motion.input
              ref={inputRef}
              type="text"
              className="searchable-select-search"
              placeholder="Ketik untuk mencari..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              variants={itemVariants}
            />
          )}
          <motion.div className="searchable-select-options" variants={itemVariants}>
            {clearLabel && (
              <div
                className={`searchable-select-option searchable-select-clear${value === "" ? " searchable-select-option-active" : ""}`}
                onClick={() => select("")}
              >
                {clearLabel}
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="text-secondary" style={{ fontSize: "0.85rem", padding: "8px 10px" }}>
                {emptyOptionsText || "Tidak ditemukan"}
              </div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o}
                  className={`searchable-select-option${o === value ? " searchable-select-option-active" : ""}`}
                  onClick={() => select(o)}
                >
                  {label(o)}
                </div>
              ))
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
