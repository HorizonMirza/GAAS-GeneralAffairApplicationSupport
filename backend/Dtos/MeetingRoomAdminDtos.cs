namespace PengirimanApi.Dtos;

public record MeetingRoomOut(int Id, string Nama, int Kapasitas, string Lantai, List<string> Fasilitas)
{
    public static MeetingRoomOut From(Models.MeetingRoom r) =>
        new(r.Id, r.Nama, r.Kapasitas, r.Lantai, r.FasilitasCsv.Length == 0 ? new List<string>() : r.FasilitasCsv.Split(',').ToList());
}

public record MeetingRoomListResponse(List<MeetingRoomOut> Rooms);

public record CreateMeetingRoomRequest(string Nama, int Kapasitas, string Lantai, List<string>? Fasilitas);
public record UpdateMeetingRoomRequest(string Nama, int Kapasitas, string Lantai, List<string>? Fasilitas);
