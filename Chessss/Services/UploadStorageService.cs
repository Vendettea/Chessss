namespace Chessss.Services;

public sealed class UploadStorageService
{
    private readonly IWebHostEnvironment _environment;
    private readonly string _storageRoot;

    public UploadStorageService(IWebHostEnvironment environment)
    {
        _environment = environment;
        _storageRoot = Path.Combine(Path.GetTempPath(), "Chessss", "uploads");
    }

    public string GetUploadsDirectory()
    {
        return EnsureDirectoryExists(_storageRoot);
    }

    public string GetAvatarsDirectory()
    {
        return EnsureDirectoryExists(Path.Combine(_storageRoot, "avatars"));
    }

    public string GetPublicUploadUrl(string fileName)
    {
        return $"/uploads/{fileName}";
    }

    public string GetPublicAvatarUrl(string fileName)
    {
        return $"/uploads/avatars/{fileName}";
    }

    public string? ResolvePhysicalPath(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || Uri.TryCreate(url, UriKind.Absolute, out _))
        {
            return null;
        }

        var normalized = url.Replace('\\', '/').TrimStart('/');
        if (!normalized.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var relativePath = normalized.Substring("uploads/".Length).Replace('/', Path.DirectorySeparatorChar);
        var externalPath = Path.GetFullPath(Path.Combine(_storageRoot, relativePath));

        if (File.Exists(externalPath))
        {
            return externalPath;
        }

        var legacyPath = Path.GetFullPath(Path.Combine(_environment.WebRootPath, normalized.Replace('/', Path.DirectorySeparatorChar)));
        return File.Exists(legacyPath) ? legacyPath : null;
    }

    private static string EnsureDirectoryExists(string path)
    {
        Directory.CreateDirectory(path);
        return path;
    }
}
