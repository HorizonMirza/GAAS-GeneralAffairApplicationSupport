"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  className: string;
  children: ReactNode;
}

/**
 * Drop-in replacement for the plain `<div className="modal-overlay ...">` every modal used to
 * render directly - adds two ways users expect a modal to close, on top of whatever "X" or
 * "Batal" button the modal already has:
 *  - Escape key
 *  - clicking the backdrop itself (not a click that started inside the modal box and bubbled up)
 *
 * Portals directly into `document.body` so fixed positioning is always relative to the viewport
 * and never trapped or clipped inside parent containers with transforms, filters, or overflow:hidden.
 */
export default function ModalOverlay({ open, onClose, className, children }: Props) {
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef(onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
    }
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!mounted) return null;

  const content = (
    <div
      className={className}
      onClick={(e) => {
        if (open && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );

  return createPortal(content, document.body);
}
