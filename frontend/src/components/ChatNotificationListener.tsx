"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureStarted, NOTIFICATION_KIND_LABEL, NOTIFICATION_TRANSAKSI_PATH, onActivityNotification, onChatNotification, onNotificationSettingsChanged } from "@/lib/chatHub";
import { playActivityNotificationSound, playChatNotificationSound, setNotificationSoundIds } from "@/lib/notificationSound";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ActivityNotification, ChatNotification } from "@/lib/types";

const DISMISS_AFTER_MS = 10000;
const LEAVE_ANIM_MS = 300;
// Caps how many banners can be visibly stacked at once - a burst of events (e.g. a recurring
// booking's mass approval) drops the oldest immediately rather than growing the stack forever.
const MAX_VISIBLE = 4;

// Transaksi page per module - a chat notification's click adds ?chat=<itemId> so that page can
// deep-link straight into the thread (see booking-ruang-meeting/transaksi's `chat` query param
// handling); an activity notification adds ?highlight=<itemId> so that page can scroll to and
// briefly flash the row it refers to (see each Transaksi page's `highlight` query param handling).

type BannerState =
  | ({ id: number; leaving: boolean; source: "chat" } & ChatNotification)
  | ({ id: number; leaving: boolean; source: "activity" } & ActivityNotification);

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function bannerHref(banner: BannerState): string {
  const base = NOTIFICATION_TRANSAKSI_PATH[banner.kind];
  return banner.source === "chat" ? `${base}?chat=${banner.itemId}` : `${base}?highlight=${banner.itemId}`;
}

// Always-mounted (rendered once from AppShell, for every authenticated page) WhatsApp-style
// notification stack: brings the shared SignalR connection up as soon as someone's logged in
// (instead of only when a chat modal happens to be open), and on every incoming chat message or
// workflow event (new transaction submitted, approve/reject step) pops a card onto a top-center
// stack + plays a sound - independent of which page, if any, is open. Several cards can be
// visible at once (each with its own auto-dismiss timer), newest on top, mirroring a real
// notification feed instead of replacing one banner with the next.
export default function ChatNotificationListener() {
  const { me } = useAuth();
  const router = useRouter();
  const [banners, setBanners] = useState<BannerState[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, { leave: ReturnType<typeof setTimeout>; remove?: ReturnType<typeof setTimeout> }>>(new Map());

  const dismiss = useCallback((id: number) => {
    const entry = timers.current.get(id);
    if (entry) clearTimeout(entry.leave);
    clearTimeout(entry?.remove);
    setBanners((current) => current.map((b) => (b.id === id ? { ...b, leaving: true } : b)));
    const removeTimer = setTimeout(() => {
      setBanners((current) => current.filter((b) => b.id !== id));
      timers.current.delete(id);
    }, LEAVE_ANIM_MS);
    timers.current.set(id, { leave: entry?.leave as ReturnType<typeof setTimeout>, remove: removeTimer });
  }, []);

  const show = useCallback((next: Omit<BannerState, "id" | "leaving">) => {
    const id = ++idRef.current;
    const leaveTimer = setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    timers.current.set(id, { leave: leaveTimer });
    setBanners((current) => {
      const updated = [{ ...next, id, leaving: false } as BannerState, ...current];
      if (updated.length <= MAX_VISIBLE) return updated;
      // Drop the oldest overflow instantly (no exit animation) and clear its timers.
      const overflow = updated.slice(MAX_VISIBLE);
      overflow.forEach((b) => {
        const entry = timers.current.get(b.id);
        clearTimeout(entry?.leave);
        clearTimeout(entry?.remove);
        timers.current.delete(b.id);
      });
      return updated.slice(0, MAX_VISIBLE);
    });
  }, [dismiss]);

  useEffect(() => {
    if (!me) return;
    ensureStarted().catch(() => {});
    // Fetched once here (this component is always mounted for every logged-in page, see the
    // module comment above) rather than at every playChatNotificationSound() call - the setting
    // rarely changes, and the live push below keeps an already-open tab in sync regardless.
    api.getNotificationSoundSettings().then(setNotificationSoundIds).catch(() => {});
    const unsubSettings = onNotificationSettingsChanged(setNotificationSoundIds);
    const unsubChat = onChatNotification((notification) => {
      playChatNotificationSound();
      show({ source: "chat", ...notification });
    });
    const unsubActivity = onActivityNotification((notification) => {
      playActivityNotificationSound();
      show({ source: "activity", ...notification });
    });
    return () => {
      unsubSettings();
      unsubChat();
      unsubActivity();
      timers.current.forEach((entry) => {
        clearTimeout(entry.leave);
        clearTimeout(entry.remove);
      });
      timers.current.clear();
    };
  }, [me, show]);

  if (banners.length === 0) return null;

  return (
    <div className="chat-notification-stack">
      {banners.map((banner) => {
        const actorNama = banner.source === "chat" ? banner.senderNama : banner.actorNama;
        const detail = banner.source === "chat" ? `Chat: ${banner.preview}` : banner.message;
        return (
          <button
            key={banner.id}
            type="button"
            className={`chat-notification-banner${banner.source === "activity" ? " chat-notification-banner-activity" : ""}${banner.leaving ? " chat-notification-banner-leaving" : ""}`}
            onClick={() => {
              dismiss(banner.id);
              router.push(bannerHref(banner));
            }}
          >
            <span className={`chat-notification-avatar${banner.source === "activity" ? " chat-notification-avatar-activity" : ""}`}>{initials(actorNama)}</span>
            <span className="chat-notification-body">
              <span className="chat-notification-title">
                <strong>{actorNama}</strong> - {NOTIFICATION_KIND_LABEL[banner.kind]}
              </span>
              <span className="chat-notification-preview">{detail}</span>
            </span>
            <span
              className="chat-notification-close"
              role="button"
              aria-label="Tutup notifikasi"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(banner.id);
              }}
            >
              &times;
            </span>
          </button>
        );
      })}
    </div>
  );
}
