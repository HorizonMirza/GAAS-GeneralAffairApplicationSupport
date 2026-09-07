"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { ensureStarted, NOTIFICATION_KIND_LABEL, NOTIFICATION_TRANSAKSI_PATH, onActivityNotification, onChatNotification } from "@/lib/chatHub";
import { useAuth } from "@/lib/auth-context";
import { useClickOutside } from "@/lib/useClickOutside";
import { itemVariants, sidebarVariants } from "./ui/menu";
import type { ActivityNotification, ChatNotification } from "@/lib/types";

const MAX_ITEMS = 20;
// Persisted client-side (there's no backend notification inbox) so the history survives a
// reload, and swept both on load and periodically so an item never lingers past a day.
const STORAGE_KEY = "gaas_notification_bell_items_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

type Tab = "all" | "chat" | "activity";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "activity", label: "Transactions" },
];

type Item =
  | ({ key: string; read: boolean; source: "chat" } & ChatNotification)
  | ({ key: string; read: boolean; source: "activity" } & ActivityNotification);

function itemHref(item: Item): string {
  const base = NOTIFICATION_TRANSAKSI_PATH[item.kind];
  return item.source === "chat" ? `${base}?chat=${item.itemId}` : `${base}?highlight=${item.itemId}`;
}

function isFresh(item: Item): boolean {
  return Date.now() - new Date(item.createdAt).getTime() < MAX_AGE_MS;
}

function loadStoredItems(): Item[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Item[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFresh).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
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
// "just happened" alert; this is a short history of what arrived recently. There's no backend
// notification inbox, so the history is persisted to localStorage (survives a reload) and each
// item self-expires after MAX_AGE_MS - swept on load and on an interval, not just when a new
// notification happens to arrive.
export default function NotificationBell() {
  const { me } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const wrapRef = useRef<HTMLDivElement>(null);
  // Guards the persist effect so it doesn't immediately overwrite localStorage with the initial
  // empty array before the load effect below has a chance to populate it from storage.
  const skipNextPersistRef = useRef(true);

  useClickOutside([wrapRef], () => setOpen(false), open);

  useEffect(() => {
    setItems(loadStoredItems());
  }, []);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Best-effort - private browsing / storage-full shouldn't break the dropdown itself.
    }
  }, [items]);

  useEffect(() => {
    const sweep = setInterval(() => {
      setItems((current) => current.filter(isFresh));
    }, SWEEP_INTERVAL_MS);
    return () => clearInterval(sweep);
  }, []);

  const push = useCallback((next: Omit<Item, "key" | "read">) => {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((current) => [{ ...next, key, read: false } as Item, ...current].slice(0, MAX_ITEMS));
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((current) => current.filter((it) => it.key !== key));
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
    setItems((current) => current.map((it) => (it.key === item.key ? { ...it, read: true } : it)));
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
        <motion.div
          className="notification-dropdown"
          onClick={(e) => e.stopPropagation()}
          initial="hidden"
          animate="visible"
          variants={sidebarVariants}
        >
          <motion.div variants={itemVariants} className="notification-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-all" onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </motion.div>
          <motion.div variants={itemVariants} className="notification-dropdown-tabs">
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
          </motion.div>
          {visibleItems.length === 0 ? (
            <motion.div variants={itemVariants} className="notification-dropdown-empty">{emptyLabel}</motion.div>
          ) : (
            <ul className="notification-dropdown-list">
              {visibleItems.map((item) => {
                const actorNama = item.source === "chat" ? item.senderNama : item.actorNama;
                const detail = item.source === "chat" ? `Chat: ${item.preview}` : item.message;
                return (
                  <motion.li key={item.key} variants={itemVariants} className="notification-item-row">
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
                    <button
                      type="button"
                      className="notification-item-delete"
                      aria-label="Hapus notifikasi"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.key);
                      }}
                    >
                      <X width={14} height={14} />
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  );
}
