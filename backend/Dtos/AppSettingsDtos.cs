namespace PengirimanApi.Dtos;

public record AppSettingsOut(string CompanyName, bool HasCustomLogo, string OperatingStart, string OperatingEnd, DateTime UpdatedAt)
{
    public static AppSettingsOut From(Models.AppSettings s) =>
        new(s.CompanyName, s.LogoPath != null, s.OperatingStart.ToString("HH:mm"), s.OperatingEnd.ToString("HH:mm"), s.UpdatedAt);
}

public record UpdateAppSettingsRequest(string CompanyName, string OperatingStart, string OperatingEnd, string Password);

public record HolidayOut(int Id, string Date, string Label)
{
    public static HolidayOut From(Models.Holiday h) => new(h.Id, h.Date.ToString("yyyy-MM-dd"), h.Label);
}

public record HolidayListResponse(List<HolidayOut> Holidays);

public record CreateHolidayRequest(string Date, string Label, string Password);

// Shared by every Super Admin write here that needs nothing but a password re-entry check:
// DeleteHoliday and DeleteLogo both just need {Password}.
public record PasswordOnlyRequest(string Password);
