namespace Chessss.Services;

public sealed class UserProfileChangeNotifier
{
    public event Func<string, Task>? Changed;

    public async Task NotifyAsync(string userId)
    {
        var handlers = Changed;

        if (handlers is null || string.IsNullOrWhiteSpace(userId))
        {
            return;
        }

        foreach (var handler in handlers.GetInvocationList().Cast<Func<string, Task>>())
        {
            await handler(userId);
        }
    }
}
