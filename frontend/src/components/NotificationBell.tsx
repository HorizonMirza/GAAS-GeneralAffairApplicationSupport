"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { ensureStarted, NOTIFICATION_KIND_LABEL, NOTIFICATION_TRANSAKSI_PATH, onActivityNotification, onChatNotification } from "@/lib/chatHub";
import { useAuth } from "@/lib/auth-context";
import { useClickOutside } from "@/lib/useClickOutside";
import type { ActivityNotification, ChatNotification } from "@/lib/types";

const MAX_ITEMS = 20;

type Tab = "all" | "chat" | "activity";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "activity", label: "Transactions" },
];

type Item =
  | ({ id: number; read: boolean; source: "chat" } & ChatNotification)
  | ({ id: number; read: boolean; source: "activity" } & ActivityNotification);

function itemHref(item: Item): string {
  const base = NOTIFICATION_TRANSAKSI_PATH[item.kind];
  return item.source === "chat" ? `${base}?chat=${item.itemId}` : base;
}

// Coarse relative label ("5 menit lalu") - this history is session-only and never more than a
// few hours deep in practice, so a full timestamp would be more precision than useful.
function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

// Bell dropdown fed by the same SignalR stream as ChatNotificationListener's toast banner
// (ReceiveChatNotification/ReceiveActivityNotification - SignalR supports multiple independent
// "on" handlers per event, so both components subscribing separately is fine). The toast is the
// "just happened" alert; this is a short history of what arrived since the tab was opened. It's
// deliberately session-only (resets on reload) - there's no backend notification inbox to hydrate
// from, so this stays a lightweight accumulator instead of pretending to be a durable one.
export default function NotificationBell() {
  const { me } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const idRef = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useClickOutside([wrapRef], () => setOpen(false), open);

  const push = useCallback((next: Omit<Item, "id" | "read">) => {
    setItems((current) => [{ ...next, id: ++idRef.current, read: false } as Item, ...current].slice(0, MAX_ITEMS));
  }, []);

  useEffect(() => {
    if (!me) return;
    ensureStarted().catch(() => {});
    const unsubChat = onChatNotification((notification) => push({ source: "chat", ...notification }));
    const unsubActivity = onActivityNotification((notification) => push({ source: "activity", ...notification }));
    return () => {
      unsubChat();
      unsubActivity();
    };
  }, [me, push]);

  if (!me) return null;

  const unreadCount = items.filter((item) => !item.read).length;
  const visibleItems = tab === "all" ? items : items.filter((item) => item.source === tab);
  const emptyLabel =
    tab === "chat" ? "Belum ada chat baru" : tab === "activity" ? "Belum ada transaksi baru" : "Belum ada notifikasi baru";

  function openItem(item: Item) {
    setItems((current) => current.map((it) => (it.id === item.id ? { ...it, read: true } : it)));
    setOpen(false);
    router.push(itemHref(item));
  }

  function markAllRead() {
    setItems((current) => current.map((it) => ({ ...it, read: true })));
  }

  return (
    <div className="notification-bell" ref={wrapRef}>
      <button
        type="button"
        className="icon-btn notification-bell-trigger"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell width={18} height={18} />
        {unreadCount > 0 && <span className="chat-count-badge notification-bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <div className="notification-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="notification-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-all" onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="notification-dropdown-tabs">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`notification-dropdown-tab${tab === t.value ? " notification-dropdown-tab-active" : ""}`}
                onClick={() => setTab(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {visibleItems.length === 0 ? (
            <div className="notification-dropdown-empty">{emptyLabel}</div>
          ) : (
            <ul className="notification-dropdown-list">
              {visibleItems.map((item) => {
                const actorNama = item.source === "chat" ? item.senderNama : item.actorNama;
                const detail = item.source === "chat" ? `Chat: ${item.preview}` : item.message;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`notification-item${item.read ? "" : " notification-item-unread"}`}
                      onClick={() => openItem(item)}
                    >
                      <span className="notification-item-title">
                        <strong>{actorNama}</strong> - {NOTIFICATION_KIND_LABEL[item.kind]}
                      </span>
                      <span className="notification-item-preview">{detail}</span>
                      <span className="notification-item-time">{relativeTime(item.createdAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
