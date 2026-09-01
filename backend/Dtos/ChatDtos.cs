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
