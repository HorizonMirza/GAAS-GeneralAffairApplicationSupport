namespace PengirimanApi.Models;

// The only four things every ApiControllerBase.CanAccess* rule actually reads about a user.
//
// Notification fan-out has to test that rule against every account to work out who should be
// told about an event (see ActivityRecipientIdsAsync and the six chat controllers). Loading whole
// User rows for that pulled all 19 columns - password hash included - into memory on every
// submit, approve, reject and chat message, then threw ~80% of it away. Projecting into this
// instead keeps the query to the four columns the rule needs.
//
// The implicit conversion means the predicates still accept a real User wherever one is already
// loaded, so every other call site is unchanged.
public readonly record struct AccessUser(int Id, RoleEnum Role, string? Divisi, string? Departemen)
{
    public static implicit operator AccessUser(User user) =>
        new(user.Id, user.Role, user.Divisi, user.Departemen);
}
