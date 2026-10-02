using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using PengirimanApi.Controllers;
using PengirimanApi.Data;
using PengirimanApi.Models;
using PengirimanApi.Services;

namespace PengirimanApi.Hubs;

[Authorize]
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

    // Office Supplies includes Mitra in its workflow, so this uses the same access rule as
    // PermintaanAtkChatController.List/Send without excluding KPU.
    public async Task JoinAtkChat(int permintaanAtkId)
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null) return;
        var item = await _db.PermintaanAtks.FindAsync(permintaanAtkId);
        if (item == null || !CanJoinAtkChat(user, item)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, AtkGroup(permintaanAtkId));
    }

    public async Task LeaveAtkChat(int permintaanAtkId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, AtkGroup(permintaanAtkId));
    }

    public static bool CanJoinAtkChat(AccessUser user, PermintaanAtk item) =>
        ApiControllerBase.CanAccessPermintaanAtk(user, item);

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

    // Same as JoinSaranaChat, but for Archive (Permintaan Arsip) - also excludes KPU, matching
    // PermintaanArsipChatController.List/Send.
    public async Task JoinArsipChat(int permintaanArsipId)
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null || user.Role == RoleEnum.KPU) return;
        var item = await _db.PermintaanArsips.FindAsync(permintaanArsipId);
        if (item == null || !ApiControllerBase.CanAccessPermintaanArsip(user, item)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, ArsipGroup(permintaanArsipId));
    }

    public async Task LeaveArsipChat(int permintaanArsipId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, ArsipGroup(permintaanArsipId));
    }

    // Same idea as JoinAtkChat (includes KPU/Mitra, since Invoice's own workflow is built around
    // them), scoped by CanViewInvoice instead of CanAccessX - matches InvoiceChatController.
    public async Task JoinInvoiceChat(int invoiceId)
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null) return;
        var item = await _db.Invoices.FindAsync(invoiceId);
        if (item == null || !ApiControllerBase.CanViewInvoice(user, item)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, InvoiceGroup(invoiceId));
    }

    public async Task LeaveInvoiceChat(int invoiceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, InvoiceGroup(invoiceId));
    }

    // Same as JoinInvoiceChat, but for Office Supplies' own AtkInvoice - matches
    // AtkInvoiceChatController.
    public async Task JoinAtkInvoiceChat(int invoiceId)
    {
        var user = await _currentUser.GetCurrentUserAsync();
        if (user == null) return;
        var item = await _db.AtkInvoices.FindAsync(invoiceId);
        if (item == null || !ApiControllerBase.CanViewInvoice(user, item)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, AtkInvoiceGroup(invoiceId));
    }

    public async Task LeaveAtkInvoiceChat(int invoiceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, AtkInvoiceGroup(invoiceId));
    }

    public static string PengirimanGroup(int pengirimanId) => $"pengiriman-chat-{pengirimanId}";
    public static string BookingGroup(int bookingRuangId) => $"booking-chat-{bookingRuangId}";
    public static string KendaraanGroup(int bookingKendaraanId) => $"kendaraan-chat-{bookingKendaraanId}";
    public static string AtkGroup(int permintaanAtkId) => $"atk-chat-{permintaanAtkId}";
    public static string SaranaGroup(int perbaikanSaranaId) => $"sarana-chat-{perbaikanSaranaId}";
    public static string ArsipGroup(int permintaanArsipId) => $"arsip-chat-{permintaanArsipId}";
    public static string InvoiceGroup(int invoiceId) => $"invoice-chat-{invoiceId}";
    public static string AtkInvoiceGroup(int invoiceId) => $"atk-invoice-chat-{invoiceId}";
    public static string UserGroup(int userId) => $"user-{userId}";
}
