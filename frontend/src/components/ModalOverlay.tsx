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
 * render directly - adds the three ways users expect a modal to close, on top of whatever "X" or
 * "Batal" button the modal already has:
 *  - Escape key
 *  - clicking the backdrop itself (not a click that started inside the modal box and bubbled up)
 *  - the phone/browser back button, via a pushed history entry consumed by popstate
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

    // Pushing a history entry means the phone/browser back button fires popstate instead of
    // navigating the page underneath away. If the modal closes some other way (X, Escape,
    // backdrop) instead, cleanup consumes that same entry with one history.back() so it doesn't
    // leave a dangling "forward" step behind.
    history.pushState({ modalOverlay: true }, "");
    function handlePopState() {
      closeRef.current();
    }
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("popstate", handlePopState);
      if (history.state?.modalOverlay) history.back();
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
