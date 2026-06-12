using System.Text.RegularExpressions;
using Chessss.Models;
using Microsoft.AspNetCore.Components.Forms;

namespace Chessss.Services;

public sealed class UserAvatarService
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    };

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
        "image/pjpeg"
    };

    private readonly UploadStorageService _storage;

    public UserAvatarService(UploadStorageService storage)
    {
        _storage = storage;
    }

    public async Task<AvatarUploadResult> SaveAvatarAsync(string userId, IBrowserFile file, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return AvatarUploadResult.FromFailure("Пользователь не найден.");
        }

        if (file is null)
        {
            return AvatarUploadResult.FromFailure("Файл не выбран.");
        }

        var extension = NormalizeExtension(Path.GetExtension(file.Name));
        if (extension is null || !AllowedExtensions.Contains(extension))
        {
            return AvatarUploadResult.FromFailure("Разрешены только jpg, jpeg, png и webp.");
        }

        if (!AllowedContentTypes.Contains(file.ContentType))
        {
            return AvatarUploadResult.FromFailure("Разрешены только изображения jpg, jpeg, png и webp.");
        }

        var avatarsDirectory = _storage.GetAvatarsDirectory();
        Directory.CreateDirectory(avatarsDirectory);

        var safeUserId = Regex.Replace(userId, @"[^A-Za-z0-9_-]+", "_");
        var fileName = $"{safeUserId}-{Guid.NewGuid():N}{extension}";
        var physicalPath = Path.Combine(avatarsDirectory, fileName);

        try
        {
            await using var input = file.OpenReadStream(maxAllowedSize: 5 * 1024 * 1024, cancellationToken: cancellationToken);
            await using var output = File.Create(physicalPath);
            await input.CopyToAsync(output, cancellationToken);

            return AvatarUploadResult.FromSuccess(_storage.GetPublicAvatarUrl(fileName));
        }
        catch (IOException)
        {
            TryDeleteFile(physicalPath);
            return AvatarUploadResult.FromFailure("Не удалось сохранить аватар.");
        }
        catch (UnauthorizedAccessException)
        {
            TryDeleteFile(physicalPath);
            return AvatarUploadResult.FromFailure("Недостаточно прав для сохранения аватара.");
        }
    }

    public Task DeleteAvatarAsync(string? avatarUrl)
    {
        return DeleteLocalAvatarAsync(avatarUrl);
    }

    public string? NormalizeAvatarUrl(string? avatarUrl)
    {
        if (string.IsNullOrWhiteSpace(avatarUrl))
        {
            return null;
        }

        return avatarUrl.StartsWith("/", StringComparison.Ordinal)
            ? avatarUrl
            : "/" + avatarUrl.TrimStart('~', '/');
    }

    private Task DeleteLocalAvatarAsync(string? avatarUrl)
    {
        var physicalPath = ResolveLocalAvatarPath(avatarUrl);

        if (physicalPath is null || !File.Exists(physicalPath))
        {
            return Task.CompletedTask;
        }

        try
        {
            File.Delete(physicalPath);
        }
        catch
        {
        }

        return Task.CompletedTask;
    }

    private string GetAvatarsDirectory()
    {
        return _storage.GetAvatarsDirectory();
    }

    private string? ResolveLocalAvatarPath(string? avatarUrl)
    {
        if (string.IsNullOrWhiteSpace(avatarUrl) || Uri.TryCreate(avatarUrl, UriKind.Absolute, out _))
        {
            return null;
        }

        var normalized = avatarUrl.Replace('\\', '/').TrimStart('/');

        if (!normalized.StartsWith("uploads/avatars/", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return _storage.ResolvePhysicalPath(avatarUrl);
    }

    private static string? NormalizeExtension(string? extension)
    {
        if (string.IsNullOrWhiteSpace(extension))
        {
            return null;
        }

        extension = extension.ToLowerInvariant();
        return extension.StartsWith('.') ? extension : "." + extension;
    }

    private static void TryDeleteFile(string physicalPath)
    {
        try
        {
            if (File.Exists(physicalPath))
            {
                File.Delete(physicalPath);
            }
        }
        catch
        {
        }
    }
}

public sealed record AvatarUploadResult(bool Success, string? AvatarUrl, string? ErrorMessage)
{
    public static AvatarUploadResult FromSuccess(string avatarUrl) => new(true, avatarUrl, null);

    public static AvatarUploadResult FromFailure(string errorMessage) => new(false, null, errorMessage);
}
