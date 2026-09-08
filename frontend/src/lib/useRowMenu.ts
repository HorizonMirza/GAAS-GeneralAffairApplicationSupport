"use client";

import { useEffect, useRef, useState } from "react";

export function useRowMenu<T extends { id: number }>(items: T[]) {
  const [menuItemId, setMenuItemId] = useState<number | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  // The "Aksi" button that opened the menu, so Escape can hand focus back to it - a keyboard
  // user who arrived at the menu via that button expects to land back on it, not lose their
  // place on the page entirely (the click-outside path doesn't do this: the user clicked
  // somewhere else on purpose, so their focus should go where they clicked, not be yanked back).
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handleClickOutside() {
      setMenuItemId(null);
      setPosition(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    if (menuItemId == null) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMenuItemId(null);
      setPosition(null);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuItemId]);

  function toggle(event: React.MouseEvent, id: number, estimatedMenuHeight = 280) {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const isOpenForSame = menuItemId === id;
    if (isOpenForSame) {
      setMenuItemId(null);
      setPosition(null);
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    triggerRef.current = event.currentTarget as HTMLElement;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < estimatedMenuHeight
      ? Math.max(8, rect.top - estimatedMenuHeight - 6)
      : rect.bottom + 6;
    setPosition({ top, left: Math.min(rect.left, window.innerWidth - 180) });
    setMenuItemId(id);
  }

  function close() {
    setMenuItemId(null);
    setPosition(null);
  }

  const menuItem = items.find((it) => it.id === menuItemId) || null;

  return { menuItem, position, toggle, close };
}
