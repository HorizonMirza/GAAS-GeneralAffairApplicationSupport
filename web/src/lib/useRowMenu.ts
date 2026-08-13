"use client";

import { useEffect, useState } from "react";

export function useRowMenu<T extends { id: number }>(items: T[]) {
  const [menuItemId, setMenuItemId] = useState<number | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function handleClickOutside() {
      setMenuItemId(null);
      setPosition(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

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
