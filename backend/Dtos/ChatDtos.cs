using PengirimanApi.Models;

namespace PengirimanApi.Dtos;

public record ChatMessageOut(
    int Id,
    int SenderId,
    string SenderNama,
    RoleEnum SenderRole,
    string Message,
    DateTime CreatedAt
);

public record SendChatMessageRequest(string Message);

// Pushed to every recipient's personal SignalR group (ChatHub.UserGroup), app-wide, in addition
// to the thread's own group - lets the frontend show a WhatsApp-style banner/sound even when the
// relevant chat thread (or that page at all) isn't open. Kind matches frontend/src/lib/chatHub.ts's
// ChatKind ("pengiriman" | "booking" | "kendaraan" | "atk" | "sarana").
public record ChatNotificationOut(
    string Kind,
    int ItemId,
    string ItemLabel,
    string SenderNama,
    string Preview,
    DateTime CreatedAt
);

// Same delivery mechanism as ChatNotificationOut (ChatHub.UserGroup, event
// "ReceiveActivityNotification" instead of "ReceiveChatMessage") but for workflow events instead
// of chat messages: a new transaction submitted, or an approve/reject step taken. Type is
// "created" (Submit) or "approval" (any Approve*/Reject* action) - the frontend plays a different
// sound for this than for a chat message, and this one doesn't have a chat-thread group to also
// broadcast to, so it's always only the personal-group push.
public record ActivityNotificationOut(
    string Type,
    string Kind,
    int ItemId,
    string ItemLabel,
    string ActorNama,
    string Message,
    DateTime CreatedAt
);
