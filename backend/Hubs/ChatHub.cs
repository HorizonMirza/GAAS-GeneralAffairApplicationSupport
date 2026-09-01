using Microsoft.AspNetCore.SignalR;
using PengirimanApi.Controllers;
using PengirimanApi.Data;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Hubs;

// Real-time push for chat messages, replacing ChatModal/RoomBookingChatModal's fixed-interval
// polling - ChatController.Send/BookingChatController.Send broadcast to these groups right after
// saving a message (see IHubContext<ChatHub> usage there). This app has no ASP.NET Core
// [Authorize]/cookie-auth middleware wired up (see CurrentUserService - every controller reads
// the "access_token" cookie and validates it itself), so the same manual check is repeated here
// per group-join instead of relying on an [Authorize] attribute that would silently no-op.
public class ChatHub : Hub
{
    private readonly CurrentUserService _currentUser;
    private readonly AppDbContext _db;

    public ChatHub(CurrentUserService currentUser, AppDbContext db)
    {
        _currentUser = currentUser;
        _db = db;
    }

    public override async Task OnConnectedAsync()
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null)
        {
            Context.Abort();
            return;
        }
        // Every connection (every open tab) joins its own user's personal group - this is what
        // lets a *ChatController.Send broadcast a "someone messaged you" notification app-wide,
        // to whichever pages/tabs a user has open, not just to whoever has that exact chat thread
        // open (see JoinBookingChat etc. above, which is thread-scoped, not user-scoped).
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(user.Id));
        await base.OnConnectedAsync();
    }

    // Called by the client right after it opens a chat thread - scoping broadcasts to a
    // per-thread SignalR group (rather than broadcasting every message to every connection) means
    // a connection only ever receives messages for threads it actually has open and is allowed to
    // see, checked here the same way ChatController.List/Send check it per request.
    public async Task JoinPengirimanChat(int pengirimanId)
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null) return;
        var item = await _db.Pengiriman.FindAsync(pengirimanId);
        if (item == null || !ApiControllerBase.CanAccessPengiriman(user, item)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, PengirimanGroup(pengirimanId));
    }

    public async Task LeavePengirimanChat(int pengirimanId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, PengirimanGroup(pengirimanId));
    }

    // Same as JoinPengirimanChat, but also excludes KPU - matching
    // BookingChatController.List/Send, which reject KPU entirely (Room Booking isn't part of
    // their workflow, see AppShell's KPU_HIDDEN_CATEGORIES) before even checking
    // CanAccessBookingRuang.
    public async Task JoinBookingChat(int bookingRuangId)
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null || user.Role == RoleEnum.KPU) return;
        var item = await _db.BookingRuangs.FindAsync(bookingRuangId);
        if (item == null || !ApiControllerBase.CanAccessBookingRuang(user, item)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, BookingGroup(bookingRuangId));
    }

    public async Task LeaveBookingChat(int bookingRuangId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, BookingGroup(bookingRuangId));
    }

    // Same as JoinBookingChat, but for Vehicle Booking - also excludes KPU, matching
    // BookingKendaraanChatController.List/Send.
    public async Task JoinKendaraanChat(int bookingKendaraanId)
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null || user.Role == RoleEnum.KPU) return;
        var item = await _db.BookingKendaraans.FindAsync(bookingKendaraanId);
        if (item == null || !ApiControllerBase.CanAccessBookingKendaraan(user, item)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, KendaraanGroup(bookingKendaraanId));
    }

    public async Task LeaveKendaraanChat(int bookingKendaraanId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, KendaraanGroup(bookingKendaraanId));
    }

    // Same as JoinKendaraanChat, but for Office Supplies (Permintaan ATK) - also excludes KPU,
    // matching PermintaanAtkChatController.List/Send.
    public async Task JoinAtkChat(int permintaanAtkId)
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null || user.Role == RoleEnum.KPU) return;
        var item = await _db.PermintaanAtks.FindAsync(permintaanAtkId);
        if (item == null || !ApiControllerBase.CanAccessPermintaanAtk(user, item)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, AtkGroup(permintaanAtkId));
    }

    public async Task LeaveAtkChat(int permintaanAtkId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, AtkGroup(permintaanAtkId));
    }

    // Same as JoinAtkChat, but for Maintenance (Perbaikan Sarana) - also excludes KPU, matching
    // PerbaikanSaranaChatController.List/Send.
    public async Task JoinSaranaChat(int perbaikanSaranaId)
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null || user.Role == RoleEnum.KPU) return;
        var item = await _db.PerbaikanSaranas.FindAsync(perbaikanSaranaId);
        if (item == null || !ApiControllerBase.CanAccessPerbaikanSarana(user, item)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, SaranaGroup(perbaikanSaranaId));
    }

    public async Task LeaveSaranaChat(int perbaikanSaranaId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, SaranaGroup(perbaikanSaranaId));
    }

    public static string PengirimanGroup(int pengirimanId) => $"pengiriman-chat-{pengirimanId}";
    public static string BookingGroup(int bookingRuangId) => $"booking-chat-{bookingRuangId}";
    public static string KendaraanGroup(int bookingKendaraanId) => $"kendaraan-chat-{bookingKendaraanId}";
    public static string AtkGroup(int permintaanAtkId) => $"atk-chat-{permintaanAtkId}";
    public static string SaranaGroup(int perbaikanSaranaId) => $"sarana-chat-{perbaikanSaranaId}";
    public static string UserGroup(int userId) => $"user-{userId}";
}
