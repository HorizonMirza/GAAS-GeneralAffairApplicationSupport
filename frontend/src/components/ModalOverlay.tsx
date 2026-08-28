"use client";

import { useEffect, useRef, type ReactNode } from "react";

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
 * Deliberately does NOT touch the History API (no pushState/popstate) - Next.js's App Router
 * patches history.pushState/replaceState for its own client-side routing, and calling the native
 * pushState directly here caused the router to swallow the very state update that opens the
 * modal, breaking every modal-opening button on the page. A back-button-closes-modal feature
 * would need to go through next/navigation's router instead, not raw history.pushState.
 */
export default function ModalOverlay({ open, onClose, className, children }: Props) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

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

  return (
    <div
      className={className}
      onClick={(e) => {
        if (open && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
