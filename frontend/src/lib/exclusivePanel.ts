"use client";

import { useEffect, useRef } from "react";

// App-wide "only one toolbar dropdown panel open at a time" coordinator. Each independent panel
// (Filter Bulan/Tanggal/Tahun, the "Semua Filter" panel, etc.) manages its own open/closed state
// locally, so nothing previously stopped two of them from being open - and rendered overlapping
// each other - at once. Every panel registers its own close function here when it opens; opening
// a new one closes whatever was open before it, so only ever one is visible app-wide.
let currentClose: (() => void) | null = null;

function notifyPanelOpen(closeSelf: () => void) {
  if (currentClose && currentClose !== closeSelf) currentClose();
  currentClose = closeSelf;
}

function notifyPanelClosed(closeSelf: () => void) {
  if (currentClose === closeSelf) currentClose = null;
}

// Call with the panel's own `open` boolean and a stable-enough close callback (e.g. `() =>
// setOpen(false)`) - wire this into every toolbar dropdown's open state so they all share the
// same "opening me closes everyone else" behavior.
export function useExclusivePanel(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const closeSelf = () => closeRef.current();
    if (open) notifyPanelOpen(closeSelf);
    else notifyPanelClosed(closeSelf);
    return () => notifyPanelClosed(closeSelf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
