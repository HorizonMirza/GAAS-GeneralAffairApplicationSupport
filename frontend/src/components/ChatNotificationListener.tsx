"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureStarted, onChatNotification } from "@/lib/chatHub";
import { playChatNotificationSound } from "@/lib/notificationSound";
import { useAuth } from "@/lib/auth-context";
import type { ChatNotification } from "@/lib/types";

const DISMISS_AFTER_MS = 6000;
const LEAVE_ANIM_MS = 300;

// Where the banner's click lands - a general "go see it" landing page per kind, not a deep link
// into the exact chat thread (that would need every Overview/Transaksi page to accept a
// chat-to-open query param, which is a larger follow-up, not part of this notification feature).
const LANDING_PATH: Record<ChatNotification["kind"], string> = {
  pengiriman: "/ekspedisi/overview",
  booking: "/booking-ruang-meeting/overview",
  kendaraan: "/booking-kendaraan/overview",
  atk: "/office-supplies/overview",
  sarana: "/maintenance/overview",
};

interface BannerState extends ChatNotification {
  id: number;
  leaving: boolean;
}

// Always-mounted (rendered once from AppShell, for every authenticated page) WhatsApp-style
// notification: brings the shared SignalR connection up as soon as someone's logged in (instead
// of only when a chat modal happens to be open), and on every ReceiveChatNotification shows a
// top-center banner + plays a sound - independent of which page/chat thread, if any, is open.
export default function ChatNotificationListener() {
  const { me } = useAuth();
  const router = useRouter();
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

  useEffect(() => {
    if (!me) return;
    ensureStarted().catch(() => {});
    const unsubscribe = onChatNotification((notification) => {
      playChatNotificationSound();
      clearTimeout(timers.current.leave);
      clearTimeout(timers.current.remove);
      const id = ++idRef.current;
      setBanner({ ...notification, id, leaving: false });
      timers.current.leave = setTimeout(dismiss, DISMISS_AFTER_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timers.current.leave);
      clearTimeout(timers.current.remove);
    };
  }, [me, dismiss]);

  if (!banner) return null;

  return (
    <button
      type="button"
      className={`chat-notification-banner${banner.leaving ? " chat-notification-banner-leaving" : ""}`}
      onClick={() => {
        dismiss();
        router.push(LANDING_PATH[banner.kind]);
      }}
    >
      <span className="chat-notification-avatar">{banner.senderNama.trim().charAt(0).toUpperCase() || "?"}</span>
      <span className="chat-notification-body">
        <span className="chat-notification-title">
          <strong>{banner.senderNama}</strong> · {banner.itemLabel}
        </span>
        <span className="chat-notification-preview">{banner.preview}</span>
      </span>
      <span
        className="chat-notification-close"
        role="button"
        aria-label="Tutup notifikasi"
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
