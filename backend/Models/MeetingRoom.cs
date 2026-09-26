namespace PengirimanApi.Models;

// DB-backed replacement for the hardcoded literal Services/MeetingRooms.cs used to carry (see
// MeetingRooms.SeedData/LoadFromDb) - same "renaming/deleting doesn't rewrite history" principle
// as the Org tree: BookingRuang/BookingRuangRoom store a room's Nama as a plain string snapshot,
// not an FK to this table, so editing or removing a row here never touches an existing booking.
public class MeetingRoom
{
    public int Id { get; set; }
    public string Nama { get; set; } = null!;
    public int Kapasitas { get; set; }
    public string Lantai { get; set; } = null!;
    // Comma-separated (e.g. "TV,AC,Proyektor") rather than a Postgres array column - keeps this
    // entity free of the ValueComparer boilerplate EF Core needs for a mutable List<string>
    // property; MeetingRoomAdminDtos splits/joins it at the API boundary.
    public string FasilitasCsv { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
