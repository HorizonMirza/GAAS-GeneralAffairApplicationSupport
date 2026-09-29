namespace PengirimanApi.Dtos;

public record MasterDataItemOut(int Id, string Category, string Key, string Label, string? Extra)
{
    public static MasterDataItemOut From(Models.MasterDataItem m) => new(m.Id, m.Category, m.Key, m.Label, m.Extra);
}

public record MasterDataListResponse(List<MasterDataItemOut> Items);

public record CreateMasterDataRequest(string Category, string Label, string? Extra, string Password);

public record UpdateMasterDataRequest(string Label, string? Extra, string Password);

public record DeleteMasterDataRequest(string Password);
