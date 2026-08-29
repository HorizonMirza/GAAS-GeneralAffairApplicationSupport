"use client";

import { useEffect, useRef, useState } from "react";
import { useClickOutside } from "@/lib/useClickOutside";

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  // When set, shows a clearable first row with this label that selects "" - used for optional
  // fields (e.g. Departemen) where the user can explicitly pick "no specific value".
  clearLabel?: string;
  disabled?: boolean;
  emptyOptionsText?: string;
}

// Click-to-open, type-to-filter single select - same collapsed-by-default trigger/panel pattern
// as RoomMultiSelect, but for picking one value out of a long list (e.g. every Divisi/Departemen
// in the org tree) without having to scroll through it one by one.
export default function SearchableSelect({ id, value, onChange, options, placeholder, clearLabel, disabled, emptyOptionsText }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useClickOutside([wrapRef], () => setOpen(false), open);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Focus after the panel actually mounts, not on the same tick as setOpen.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = query.trim()
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
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
        <span className={value ? "" : "searchable-select-placeholder"}>{value || placeholder}</span>
        <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && !disabled && (
        <div className="searchable-select-panel">
          <input
            ref={inputRef}
            type="text"
            className="searchable-select-search"
            placeholder="Ketik untuk mencari..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="searchable-select-options">
            {clearLabel && (
              <div className="searchable-select-option searchable-select-clear" onClick={() => select("")}>
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
                  {o}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
