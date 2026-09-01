import * as signalR from "@microsoft/signalr";
import type { ChatMessage, ChatNotification } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";
// The hub is mapped at the app root (Program.cs: app.MapHub<ChatHub>("/hubs/chat")), not under
// /api like every REST endpoint - API_BASE already carries the trailing /api, so strip it back
// off instead of hardcoding a second base URL.
const HUB_URL = `${API_BASE.replace(/\/api\/?$/, "")}/hubs/chat`;

export type ChatKind = "pengiriman" | "booking" | "kendaraan" | "atk" | "sarana";

let connection: signalR.HubConnection | null = null;
let startPromise: Promise<void> | null = null;
// Tracks which "kind:id" groups this connection is supposed to be in - re-joined automatically
// on reconnect, since SignalR group membership is tied to the connection ID and a reconnect gets
// a new one (the server-side group the old connection was in is simply gone).
const activeGroups = new Set<string>();

function groupKey(kind: ChatKind, id: number): string {
  return `${kind}:${id}`;
}

function joinMethod(kind: ChatKind): string {
  if (kind === "pengiriman") return "JoinPengirimanChat";
  if (kind === "kendaraan") return "JoinKendaraanChat";
  if (kind === "atk") return "JoinAtkChat";
  if (kind === "sarana") return "JoinSaranaChat";
  return "JoinBookingChat";
}

function leaveMethod(kind: ChatKind): string {
  if (kind === "pengiriman") return "LeavePengirimanChat";
  if (kind === "kendaraan") return "LeaveKendaraanChat";
  if (kind === "atk") return "LeaveAtkChat";
  if (kind === "sarana") return "LeaveSaranaChat";
  return "LeaveBookingChat";
}

function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { withCredentials: true })
      .withAutomaticReconnect()
      .build();
    connection.onreconnected(() => {
      for (const key of activeGroups) {
        const [kind, idStr] = key.split(":") as [ChatKind, string];
        connection?.invoke(joinMethod(kind), Number(idStr)).catch(() => {});
      }
    });
  }
  return connection;
}

// Exported so a global, always-mounted listener (AppShell) can bring the connection up as soon
// as someone logs in - not just lazily when a chat modal first opens - so the personal
// notification group join (ChatHub.OnConnectedAsync) happens immediately, before any message
// arrives to miss.
export async function ensureStarted(): Promise<void> {
  const conn = getConnection();
  if (conn.state === signalR.HubConnectionState.Connected) return;
  if (conn.state === signalR.HubConnectionState.Connecting || conn.state === signalR.HubConnectionState.Reconnecting) {
    // Already in flight (e.g. automatic reconnect) - wait for that instead of calling start()
    // again, which SignalR rejects with "cannot start a HubConnection that is not disconnected".
    if (startPromise) await startPromise;
    return;
  }
  if (!startPromise) {
    startPromise = conn.start().catch((err) => {
      startPromise = null;
      throw err;
    });
  }
  await startPromise;
}

// Joins a per-thread group so this connection starts receiving that thread's messages - call
// once when a chat modal opens (or its itemId changes), paired with leaveChat on close/unmount.
export async function joinChat(kind: ChatKind, id: number): Promise<void> {
  activeGroups.add(groupKey(kind, id));
  await ensureStarted();
  await getConnection().invoke(joinMethod(kind), id);
}

export async function leaveChat(kind: ChatKind, id: number): Promise<void> {
  activeGroups.delete(groupKey(kind, id));
  const conn = getConnection();
  if (conn.state !== signalR.HubConnectionState.Connected) return;
  try {
    await conn.invoke(leaveMethod(kind), id);
  } catch {
    // Best-effort - if the connection is mid-teardown the server-side group membership is
    // dropped along with it anyway.
  }
}

// Registers a handler for new messages of this kind and returns an unsubscribe function - safe
// to call even before the connection has started (SignalR queues the "on" registration).
export function onChatMessage(kind: ChatKind, handler: (message: ChatMessage) => void): () => void {
  const conn = getConnection();
  const event =
    kind === "pengiriman" ? "ReceivePengirimanMessage"
    : kind === "kendaraan" ? "ReceiveKendaraanMessage"
    : kind === "atk" ? "ReceiveAtkMessage"
    : kind === "sarana" ? "ReceiveSaranaMessage"
    : "ReceiveBookingMessage";
  conn.on(event, handler);
  return () => conn.off(event, handler);
}

// App-wide notification (ChatHub.UserGroup) - unlike onChatMessage, this fires for every chat
// kind's message the current user is allowed to see, regardless of which thread (if any) they
// have open, so it needs no `kind`/`joinChat` pairing - the server already scoped who receives it.
export function onChatNotification(handler: (notification: ChatNotification) => void): () => void {
  const conn = getConnection();
  conn.on("ReceiveChatNotification", handler);
  return () => conn.off("ReceiveChatNotification", handler);
}
