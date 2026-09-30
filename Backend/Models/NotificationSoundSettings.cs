namespace PengirimanApi.Models;

// Singleton row (Id is always 1) - which sound each notification type plays, chosen by
// Superadmin and shared by every logged-in user. There is no per-user override; the frontend
// fetches this once on load and again live via ChatHub's "ReceiveNotificationSettingsChanged"
// broadcast whenever Superadmin changes it.
public class NotificationSoundSettings
{
    public int Id { get; set; }
    public string ChatSoundId { get; set; } = null!;
    public string ActivitySoundId { get; set; } = null!;
    public DateTime UpdatedAt { get; set; }
}
