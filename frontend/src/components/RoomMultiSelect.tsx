"use client";

import { useRef, useState } from "react";
import { useClickOutside } from "@/lib/useClickOutside";
import { useLanguage } from "@/lib/i18n/language-context";
import type { RoomOption } from "@/lib/types";

interface Props {
  id: string;
  rooms: RoomOption[];
  excludeRoom: string;
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  // View-only usage (e.g. Detail modal): the trigger still opens/closes, but the panel just lists
  // the already-picked rooms one per line instead of every room as a checkable option - lets a
  // long list stay fully readable without either truncating in a single line or forcing it open.
  readOnly?: boolean;
}

// Click-to-open checklist, not a wall of always-visible chips - same collapsed-by-default pattern
// as the toolbar's "Semua Filter" dropdown (.filter-dropdown-panel), so picking from a long room
// list stays compact regardless of how many rooms are selected.
export default function RoomMultiSelect({ id, rooms, excludeRoom, selected, onChange, disabled, readOnly }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([wrapRef], () => setOpen(false), open);

  const options = rooms.filter((r) => r.nama !== excludeRoom);
  const summary = selected.length === 0 ? (readOnly ? t("bk.noRuanganTambahan") : t("bk.pilihRuanganTambahan")) : selected.join(", ");

  function toggle(nama: string) {
    onChange(selected.includes(nama) ? selected.filter((r) => r !== nama) : [...selected, nama]);
  }

  return (
    <div className="room-multiselect" ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="room-multiselect-trigger"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected.length === 0 ? "room-multiselect-placeholder" : ""}>{summary}</span>
        <svg className="account-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && !disabled && (
        <div className="room-multiselect-panel">
          {readOnly ? (
            selected.length === 0 ? (
              <div className="text-secondary" style={{ fontSize: "0.85rem", padding: "8px 10px" }}>{t("bk.noRuanganTambahan")}</div>
            ) : (
              selected.map((nama) => (
                <div key={nama} className="room-multiselect-option" style={{ cursor: "default" }}>{nama}</div>
              ))
            )
          ) : options.length === 0 ? (
            <div className="text-secondary" style={{ fontSize: "0.85rem", padding: "8px 10px" }}>{t("bk.noRuanganLain")}</div>
          ) : (
            options.map((r) => (
              <label key={r.nama} className="room-multiselect-option">
                <input type="checkbox" checked={selected.includes(r.nama)} onChange={() => toggle(r.nama)} />
                {r.nama}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
