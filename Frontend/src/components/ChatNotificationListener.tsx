"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureStarted, NOTIFICATION_KIND_LABEL, NOTIFICATION_TRANSAKSI_PATH, onActivityNotification, onChatNotification, onNotificationSettingsChanged } from "@/lib/chatHub";
import { openGlobalChat } from "@/lib/globalChat";
import { playActivityNotificationSound, playChatNotificationSound, setNotificationSoundIds } from "@/lib/notificationSound";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ROLE_COLOR } from "@/lib/constants";
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

function PersonIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"></circle>
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path>
    </svg>
  );
}

function ChatBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a7 7 0 0 1 7-7h2a7 7 0 0 1 0 14h-1l-3 3v-3a7 7 0 0 1-5-6.7z"></path>
    </svg>
  );
}

function ClockBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6v6l4 2"></path>
    </svg>
  );
}

function CheckBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7"></path>
    </svg>
  );
}

function CrossBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18"></path>
    </svg>
  );
}

// Blue chat bubble for a message; otherwise orange while still moving through the approval
// chain (just created, or approved at a non-final tier), green once it reaches the final
// approved status, red once rejected at any tier - same convention as the bell dropdown's
// unread dot, now carried by the avatar badge instead of the banner's left border.
function badgeClass(banner: BannerState): string {
  if (banner.source === "chat") return "chat-notification-badge-chat";
  if (banner.type === "approved") return "chat-notification-badge-approved";
  if (banner.type === "rejected") return "chat-notification-badge-rejected";
  return "chat-notification-badge-progress";
}

function BadgeIcon({ banner }: { banner: BannerState }) {
  if (banner.source === "chat") return <ChatBadgeIcon />;
  if (banner.type === "approved") return <CheckBadgeIcon />;
  if (banner.type === "rejected") return <CrossBadgeIcon />;
  return <ClockBadgeIcon />;
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
  // Tracks which banners' actor photo failed to load (no photo uploaded, or a fetch error) - once
  // marked, that banner falls back to the initials avatar instead of retrying the broken <img>.
  const [photoErrors, setPhotoErrors] = useState<Set<number>>(new Set());
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
    const activeTimers = timers.current;
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
      activeTimers.forEach((entry) => {
        clearTimeout(entry.leave);
        clearTimeout(entry.remove);
      });
      activeTimers.clear();
    };
  }, [me, show]);

  if (banners.length === 0) return null;

  return (
    <div className="chat-notification-stack">
      {banners.map((banner) => {
        const actorNama = banner.source === "chat" ? banner.senderNama : banner.actorNama;
        const actorId = banner.source === "chat" ? banner.senderId : banner.actorId;
        const actorRole = banner.source === "chat" ? banner.senderRole : banner.actorRole;
        const detail = banner.source === "chat" ? `Chat: ${banner.preview}` : banner.message;
        return (
          <button
            key={banner.id}
            type="button"
            className={`chat-notification-banner${banner.leaving ? " chat-notification-banner-leaving" : ""}`}
            onClick={() => {
              dismiss(banner.id);
              // Same split as NotificationBell.openItem: a chat banner opens its thread on top of
              // the current page (GlobalChatModal) instead of navigating away, since there's
              // nothing about "read a chat message" that requires leaving where you already are.
              if (banner.source === "chat") {
                openGlobalChat(banner.kind, banner.itemId);
              } else {
                router.push(bannerHref(banner));
              }
            }}
          >
            <span className="chat-notification-avatar-wrap">
              <span className="chat-notification-avatar" style={{ background: ROLE_COLOR[actorRole] }}>
                {photoErrors.has(banner.id) ? (
                  <PersonIcon />
                ) : (
                  <img
                    src={api.userPhotoUrl(actorId)}
                    alt=""
                    className="chat-notification-avatar-photo"
                    onError={() => setPhotoErrors((current) => new Set(current).add(banner.id))}
                  />
                )}
              </span>
              <span className={`chat-notification-badge ${badgeClass(banner)}`}>
                <BadgeIcon banner={banner} />
              </span>
            </span>
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
