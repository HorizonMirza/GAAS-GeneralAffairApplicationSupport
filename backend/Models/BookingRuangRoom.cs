namespace PengirimanApi.Models;

// An additional room reserved alongside a BookingRuang's own primary NamaRuang, for a single
// event that needs more than one room at once (e.g. two adjoining rooms combined for a large
// meeting). The primary room stays on BookingRuang itself; this table only ever holds the
// extras, so every existing single-room code path keeps working against NamaRuang unchanged.
public class BookingRuangRoom
{
    public int Id { get; set; }
    public int BookingRuangId { get; set; }
    public string NamaRuang { get; set; } = null!;

    public BookingRuang BookingRuang { get; set; } = null!;
}
