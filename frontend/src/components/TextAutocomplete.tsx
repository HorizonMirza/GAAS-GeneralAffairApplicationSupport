"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { itemVariants, sidebarVariants } from "./ui/menu";
import { useClickOutside } from "@/lib/useClickOutside";

interface Props {
  id?: string;
  className?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
}

const MAX_SUGGESTIONS = 8;

// A free-text input with a catalog-suggestions dropdown - unlike SearchableSelect, typing a value
// that isn't in `options` is still accepted (Nama Barang lets a user request something outside the
// ATK catalog). Replaces the plain <input list="..."> + <datalist> pattern: Chromium draws its own
// dropdown-arrow affordance on any input with a "list" attribute, rendered as a browser-chrome
// overlay rather than part of the page's paint tree, so it can't be hidden or clipped with CSS -
// only avoided by not using a native datalist at all.
export default function TextAutocomplete({ id, className, ariaLabel, value, onChange, options, placeholder, disabled, required, maxLength }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside([wrapRef], () => setOpen(false), open);

  const query = value.trim().toLowerCase();
  const filtered = (
    query ? options.filter((o) => o.toLowerCase().includes(query)) : options
  ).slice(0, MAX_SUGGESTIONS);

  function select(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div className={`searchable-select${className ? ` ${className}` : ""}`} ref={wrapRef}>
      <input
        type="text"
        id={id}
        className={className}
        aria-label={ariaLabel}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDownCapture={(e) => {
          // Capture phase, not bubble: ModalOverlay closes the whole modal on Escape via a plain
          // document-level bubble-phase listener, which a same-element bubble-phase stopPropagation
          // races against unreliably. Intercepting during capture - before the event ever reaches
          // that listener - guarantees Escape only closes this dropdown while it's open.
          if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {open && !disabled && filtered.length > 0 && (
        <motion.div className="searchable-select-panel" initial="hidden" animate="visible" variants={sidebarVariants}>
          <motion.div className="searchable-select-options" variants={itemVariants}>
            {filtered.map((o) => (
              <div
                key={o}
                className={`searchable-select-option${o === value ? " searchable-select-option-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(o)}
              >
                {o}
              </div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
