namespace PengirimanApi.Models;

public class RoomBookingCounter
{
    public string NamaRuang { get; set; } = null!;
    public int Year { get; set; }
    public int Month { get; set; }
    public int LastSequence { get; set; }
}
