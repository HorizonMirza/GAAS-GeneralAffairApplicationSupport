namespace PengirimanApi.Models;

// Singleton row (Id is always 1) - app-wide branding + booking-hours configuration, chosen by
// Super Admin and shared by every logged-in user (and, for the logo/company name, by anyone on
// the login page too - see AppSettingsController). Same "one global settings row" shape as
// NotificationSoundSettings.
public class AppSettings
{
    public int Id { get; set; }
    public string CompanyName { get; set; } = null!;
    // Null means "use the bundled default logo" (Assets/logo-pgm-solution.png) - Super Admin has
    // never uploaded a custom one, or reverted back to it.
    public string? LogoPath { get; set; }
    public string? LogoContentType { get; set; }
    public string? LogoOriginalFilename { get; set; }
    public TimeOnly OperatingStart { get; set; }
    public TimeOnly OperatingEnd { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// A single calendar date Room/Vehicle Booking reject bookings on, on top of the existing
// Saturday/Sunday rule - e.g. a national holiday that falls on a weekday. Super Admin-managed
// (see AppSettingsController), read through AppSettingsCache the same way MeetingRooms/Vehicles
// read their own tables.
public class Holiday
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public string Label { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
