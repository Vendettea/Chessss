using System.Text.RegularExpressions;
using Chessss.Data;
using Chessss.Models;
using Microsoft.EntityFrameworkCore;

namespace Chessss.Services
{
    public sealed class PlayerProfileService
    {
        private readonly ApplicationDbContext _db;

        public PlayerProfileService(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<PlayerProfileSummary?> GetProfileAsync(string userId, bool includeEmail = false)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return null;
            }

            var user = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.Id,
                    u.Nickname,
                    u.Email,
                    u.EloRating,
                    u.GamesPlayed,
                    u.Wins,
                    u.Losses,
                    u.Draws,
                    u.RegisteredAt
                })
                .FirstOrDefaultAsync();

            if (user is null)
            {
                return null;
            }

            var leaderboard = user.GamesPlayed > 0
                ? await GetLeaderboardAsync()
                : [];

            var rank = leaderboard.FirstOrDefault(p => p.Id == user.Id)?.Rank;

            return new PlayerProfileSummary
            {
                Id = user.Id,
                Nickname = UserProfileRules.GetDisplayName(user.Nickname, user.Email),
                Email = includeEmail ? user.Email : null,
                EloRating = user.EloRating,
                GamesPlayed = user.GamesPlayed,
                Wins = user.Wins,
                Losses = user.Losses,
                Draws = user.Draws,
                RegisteredAt = user.RegisteredAt,
                Rank = rank
            };
        }

        public async Task<IReadOnlyList<PlayerProfileSummary>> GetLeaderboardAsync()
        {
            var users = await _db.Users
                .AsNoTracking()
                .Where(u => u.GamesPlayed > 0)
                .OrderByDescending(u => u.EloRating)
                .ThenByDescending(u => u.Wins)
                .ThenBy(u => u.Losses)
                .ThenBy(u => u.RegisteredAt)
                .ThenBy(u => u.Id)
                .Select(u => new
                {
                    u.Id,
                    u.Nickname,
                    u.Email,
                    u.EloRating,
                    u.GamesPlayed,
                    u.Wins,
                    u.Losses,
                    u.Draws,
                    u.RegisteredAt
                })
                .ToListAsync();

            return users.Select((u, index) => new PlayerProfileSummary
                {
                    Id = u.Id,
                    Nickname = UserProfileRules.GetDisplayName(u.Nickname, u.Email),
                    EloRating = u.EloRating,
                    GamesPlayed = u.GamesPlayed,
                    Wins = u.Wins,
                    Losses = u.Losses,
                    Draws = u.Draws,
                    RegisteredAt = u.RegisteredAt,
                    Rank = index + 1
                })
                .ToList();
        }

        public async Task<bool> IsNicknameAvailableAsync(string nickname, string currentUserId)
        {
            var normalized = UserProfileRules.NormalizeNickname(nickname);
            var users = await _db.Users
                .AsNoTracking()
                .Where(u => u.Id != currentUserId)
                .Select(u => new { u.Nickname, u.NormalizedNickname })
                .ToListAsync();

            return users.All(u =>
                !string.Equals(u.NormalizedNickname, normalized, StringComparison.Ordinal) &&
                !string.Equals(UserProfileRules.NormalizeNickname(u.Nickname), normalized, StringComparison.Ordinal));
        }

        public async Task<string> GenerateUniqueNicknameAsync(string email)
        {
            var baseNickname = UserProfileRules.CreateFallbackNickname(email);

            for (var attempt = 0; attempt < 1000; attempt++)
            {
                var suffix = attempt == 0 ? string.Empty : attempt.ToString();
                var candidateBaseLength = UserProfileRules.MaxNicknameLength - suffix.Length;
                var candidate = baseNickname[..Math.Min(baseNickname.Length, candidateBaseLength)] + suffix;

                if (await IsNicknameAvailableAsync(candidate, string.Empty))
                {
                    return candidate;
                }
            }

            return $"user{Guid.NewGuid():N}"[..UserProfileRules.MaxNicknameLength];
        }
    }

    public sealed class PlayerProfileSummary
    {
        public string Id { get; init; } = string.Empty;
        public string Nickname { get; init; } = string.Empty;
        public string? Email { get; init; }
        public int EloRating { get; init; }
        public int GamesPlayed { get; init; }
        public int Wins { get; init; }
        public int Losses { get; init; }
        public int Draws { get; init; }
        public DateTime RegisteredAt { get; init; }
        public int? Rank { get; init; }

        public decimal WinRate => GamesPlayed == 0
            ? 0
            : Math.Round((decimal)Wins / GamesPlayed * 100, 1);

        public string WinRateText => $"{WinRate:0.#}%";
    }

    public static partial class UserProfileRules
    {
        public const int MinNicknameLength = 3;
        public const int MaxNicknameLength = 20;

        public static string? ValidateNickname(string? nickname)
        {
            if (string.IsNullOrWhiteSpace(nickname))
            {
                return "Никнейм обязателен.";
            }

            var trimmed = nickname.Trim();

            if (trimmed.Length < MinNicknameLength || trimmed.Length > MaxNicknameLength)
            {
                return $"Никнейм должен быть длиной от {MinNicknameLength} до {MaxNicknameLength} символов.";
            }

            if (!NicknameRegex().IsMatch(trimmed))
            {
                return "Никнейм может содержать только латинские буквы, цифры, _ и -.";
            }

            return null;
        }

        public static string NormalizeNickname(string? nickname)
        {
            return string.IsNullOrWhiteSpace(nickname)
                ? string.Empty
                : nickname.Trim().ToUpperInvariant();
        }

        public static string GetDisplayName(string? nickname, string? email)
        {
            if (!string.IsNullOrWhiteSpace(nickname))
            {
                return nickname.Trim();
            }

            return CreateFallbackNickname(email);
        }

        public static string CreateFallbackNickname(string? email)
        {
            var localPart = string.IsNullOrWhiteSpace(email)
                ? "user"
                : email.Split('@', 2)[0];

            var cleaned = InvalidNicknameCharacterRegex().Replace(localPart, "_").Trim('_', '-');

            if (cleaned.Length < MinNicknameLength)
            {
                cleaned = "user";
            }

            return cleaned[..Math.Min(cleaned.Length, MaxNicknameLength)];
        }

        [GeneratedRegex("^[A-Za-z0-9_-]+$")]
        private static partial Regex NicknameRegex();

        [GeneratedRegex("[^A-Za-z0-9_-]+")]
        private static partial Regex InvalidNicknameCharacterRegex();
    }
}
