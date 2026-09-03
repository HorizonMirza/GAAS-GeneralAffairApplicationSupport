"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureStarted, NOTIFICATION_TRANSAKSI_PATH, onActivityNotification, onChatNotification } from "@/lib/chatHub";
import { playActivityNotificationSound, playChatNotificationSound } from "@/lib/notificationSound";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n/language-context";
import type { ActivityNotification, ChatNotification } from "@/lib/types";

const DISMISS_AFTER_MS = 6000;
const LEAVE_ANIM_MS = 300;

// Transaksi page per module - a chat notification's click adds ?chat=<itemId> so that page can
// deep-link straight into the thread (see booking-ruang-meeting/transaksi's `chat` query param
// handling); an activity notification just lands on the plain list, no item-specific handling
// needed to satisfy "go to the transaction".

type BannerState =
  | ({ id: number; leaving: boolean; source: "chat" } & ChatNotification)
  | ({ id: number; leaving: boolean; source: "activity" } & ActivityNotification);

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function bannerHref(banner: BannerState): string {
  const base = NOTIFICATION_TRANSAKSI_PATH[banner.kind];
  return banner.source === "chat" ? `${base}?chat=${banner.itemId}` : base;
}

// Always-mounted (rendered once from AppShell, for every authenticated page) WhatsApp-style
// notification: brings the shared SignalR connection up as soon as someone's logged in (instead
// of only when a chat modal happens to be open), and on every incoming chat message or workflow
// event (new transaction submitted, approve/reject step) shows a top-center banner + plays a
// sound - independent of which page, if any, is open. The two event kinds share this one banner
// UI but get a different sound and a different click target (straight into the chat vs. the
// plain Transaksi list).
export default function ChatNotificationListener() {
  const { me } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [banner, setBanner] = useState<BannerState | null>(null);
  const idRef = useRef(0);
  const timers = useRef<{ leave?: ReturnType<typeof setTimeout>; remove?: ReturnType<typeof setTimeout> }>({});

  const dismiss = useCallback(() => {
    clearTimeout(timers.current.leave);
    clearTimeout(timers.current.remove);
    const id = idRef.current;
    setBanner((current) => (current && current.id === id ? { ...current, leaving: true } : current));
    timers.current.remove = setTimeout(() => {
      setBanner((current) => (current && current.id === id ? null : current));
    }, LEAVE_ANIM_MS);
  }, []);

  const show = useCallback((next: Omit<BannerState, "id" | "leaving">) => {
    clearTimeout(timers.current.leave);
    clearTimeout(timers.current.remove);
    const id = ++idRef.current;
    setBanner({ ...next, id, leaving: false } as BannerState);
    timers.current.leave = setTimeout(dismiss, DISMISS_AFTER_MS);
  }, [dismiss]);

  useEffect(() => {
    if (!me) return;
    ensureStarted().catch(() => {});
    const unsubChat = onChatNotification((notification) => {
      playChatNotificationSound();
      show({ source: "chat", ...notification });
    });
    const unsubActivity = onActivityNotification((notification) => {
      playActivityNotificationSound();
      show({ source: "activity", ...notification });
    });
    return () => {
      unsubChat();
      unsubActivity();
      clearTimeout(timers.current.leave);
      clearTimeout(timers.current.remove);
    };
  }, [me, show]);

  if (!banner) return null;

  const actorNama = banner.source === "chat" ? banner.senderNama : banner.actorNama;
  const detail = banner.source === "chat" ? banner.preview : banner.message;

  return (
    <button
      type="button"
      className={`chat-notification-banner${banner.leaving ? " chat-notification-banner-leaving" : ""}`}
      onClick={() => {
        dismiss();
        router.push(bannerHref(banner));
      }}
    >
      <span className="chat-notification-avatar">{initials(actorNama)}</span>
      <span className="chat-notification-body">
        <span className="chat-notification-title">
          <strong>{actorNama}</strong> · {banner.itemLabel}
        </span>
        <span className="chat-notification-preview">{detail}</span>
      </span>
      <span
        className="chat-notification-close"
        role="button"
        aria-label={t("common.closeNotification")}
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
      >
        &times;
      </span>
    </button>
  );
}
