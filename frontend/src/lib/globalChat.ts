import type { ChatKind } from "./chatHub";

// Lets a chat notification's click (NotificationBell, ChatNotificationListener) open the
// relevant thread directly - via GlobalChatModal, mounted once in AppShell - instead of
// navigating to that module's Transaction page first. Plain module-level pub-sub (same shape as
// chatHub.ts's onChatNotification/onActivityNotification) rather than React context, since the
// emitter side (notification components) and the listener side (GlobalChatModal) don't share a
// tree position that context would help with.
type Listener = (kind: ChatKind, itemId: number) => void;

const listeners = new Set<Listener>();

export function openGlobalChat(kind: ChatKind, itemId: number): void {
  listeners.forEach((listener) => listener(kind, itemId));
}

export function onOpenGlobalChat(handler: Listener): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}
