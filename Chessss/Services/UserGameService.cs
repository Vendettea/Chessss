using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Chessss.Data;
using Chessss.Models;
using Microsoft.EntityFrameworkCore;

namespace Chessss.Services
{
    public sealed class UserGameService
    {
        private static readonly Regex MoveRegex = new(@"\b\d+\.(?:\.\.)?\s*\S+", RegexOptions.CultureInvariant | RegexOptions.Compiled);
        private static readonly Regex TagRegex = new(@"^\[(?<name>[A-Za-z0-9_]+)\s+""(?<value>(?:[^""\\]|\\.)*)""\]\s*$", RegexOptions.CultureInvariant | RegexOptions.Compiled);
        private static readonly string[] RequiredTags = new[] { "White", "Black", "Result", "Date" };
        private static readonly Regex ResultSuffixRegex = new(@"(?:^|\s)(1-0|0-1|1/2-1/2|\*)\s*$", RegexOptions.CultureInvariant | RegexOptions.Compiled);

        private readonly ApplicationDbContext _db;

        public UserGameService(ApplicationDbContext db)
        {
            _db = db;
        }

        public Task<PaginatedResult<UserGame>> GetUserGamesAsync(string userId, int page, int pageSize)
        {
            return GetUserGamesAsync(userId, page, pageSize, CancellationToken.None);
        }

        public async Task<PaginatedResult<UserGame>> GetUserGamesAsync(string userId, int page, int pageSize, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(userId) || pageSize <= 0)
            {
                return new PaginatedResult<UserGame>
                {
                    Items = Array.Empty<UserGame>(),
                    TotalCount = 0,
                    Page = Math.Max(page, 0),
                    PageSize = Math.Max(pageSize, 0)
                };
            }

            var normalizedPage = Math.Max(page, 0);

            var query = _db.UserGames
                .AsNoTracking()
                .Where(x => x.UserId == userId);

            var totalCount = await query.CountAsync(cancellationToken);
            var items = await query
                .OrderByDescending(x => x.PlayedAt)
                .ThenByDescending(x => x.Id)
                .Skip(normalizedPage * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PaginatedResult<UserGame>
            {
                Items = items,
                TotalCount = totalCount,
                Page = normalizedPage,
                PageSize = pageSize
            };
        }

        public async Task<bool> SaveUserGameAsync(UserGame game, CancellationToken cancellationToken = default)
        {
            if (game is null || string.IsNullOrWhiteSpace(game.UserId))
            {
                return false;
            }

            if (!string.IsNullOrWhiteSpace(game.ExternalId) &&
                await _db.UserGames.AsNoTracking().AnyAsync(x =>
                    x.UserId == game.UserId && x.ExternalId == game.ExternalId, cancellationToken))
            {
                return true;
            }

            var normalizedPgn = NormalizePgn(game);

            if (string.IsNullOrWhiteSpace(normalizedPgn) || !ValidatePgn(normalizedPgn))
            {
                return false;
            }

            game.PgnContent = normalizedPgn;
            _db.UserGames.Add(game);

            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<(bool Success, string Message)> ImportUserGameFromPgnAsync(string userId, string pgn, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return (false, "Пользователь не найден.");
            }

            if (!TryCreateImportedGame(userId, pgn, out var game, out var errorMessage))
            {
                return (false, errorMessage);
            }

            if (!string.IsNullOrWhiteSpace(game.ExternalId) &&
                await _db.UserGames.AsNoTracking().AnyAsync(x =>
                    x.UserId == game.UserId && x.ExternalId == game.ExternalId, cancellationToken))
            {
                return (false, "Такая партия уже есть в истории.");
            }

            var saved = await SaveUserGameAsync(game, cancellationToken);
            return saved
                ? (true, "Партия успешно импортирована")
                : (false, "Не удалось импортировать партию");
        }

        public static bool ValidatePgn(string pgn)
        {
            if (string.IsNullOrWhiteSpace(pgn))
            {
                return false;
            }

            var normalized = pgn.Replace("\r\n", "\n").Trim();
            var sections = normalized.Split(new[] { "\n\n" }, 2, StringSplitOptions.None);

            if (sections.Length != 2)
            {
                return false;
            }

            var headerLines = sections[0]
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (headerLines.Length == 0)
            {
                return false;
            }

            var tags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            foreach (var line in headerLines)
            {
                var match = TagRegex.Match(line);
                if (!match.Success)
                {
                    return false;
                }

                tags[match.Groups["name"].Value] = match.Groups["value"].Value;
            }

            foreach (var requiredTag in RequiredTags)
            {
                if (!tags.TryGetValue(requiredTag, out var value) || string.IsNullOrWhiteSpace(value))
                {
                    return false;
                }
            }

            var body = sections[1].Trim();

            if (string.IsNullOrWhiteSpace(body))
            {
                return false;
            }

            return MoveRegex.IsMatch(body);
        }

        private static string NormalizePgn(UserGame game)
        {
            var body = ExtractPgnBody(game.PgnContent);

            if (string.IsNullOrWhiteSpace(body))
            {
                return string.Empty;
            }

            var result = NormalizeResultToken(game.Result);

            if (!ResultSuffixRegex.IsMatch(body))
            {
                body = $"{body.TrimEnd()} {result}";
            }

            var headers = new[]
            {
                BuildHeader("White", game.WhitePlayer),
                BuildHeader("Black", game.BlackPlayer),
                BuildHeader("Result", result),
                BuildHeader("Date", game.PlayedAt.ToString("yyyy.MM.dd"))
            };

            return string.Join("\n", headers) + "\n\n" + body.Trim();
        }

        private static string ExtractPgnBody(string pgn)
        {
            if (string.IsNullOrWhiteSpace(pgn))
            {
                return string.Empty;
            }

            var normalized = pgn.Replace("\r\n", "\n").Trim();
            var sections = normalized.Split(new[] { "\n\n" }, 2, StringSplitOptions.None);

            return sections.Length == 2
                ? sections[1].Trim()
                : normalized;
        }

        private static string NormalizeResultToken(string? result)
        {
            return result?.Trim() switch
            {
                "1-0" => "1-0",
                "0-1" => "0-1",
                "1/2-1/2" => "1/2-1/2",
                _ => "*"
            };
        }

        private static string BuildHeader(string name, string? value)
        {
            var escapedValue = EscapePgnValue(string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim());
            return $"[{name} \"{escapedValue}\"]";
        }

        private static string EscapePgnValue(string value)
        {
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        private static bool TryCreateImportedGame(string userId, string pgn, out UserGame game, out string errorMessage)
        {
            game = new UserGame();
            errorMessage = string.Empty;

            if (string.IsNullOrWhiteSpace(pgn))
            {
                errorMessage = "PGN не может быть пустым.";
                return false;
            }

            var normalized = pgn.Replace("\r\n", "\n").Trim();
            if (!TryParsePgn(normalized, out var tags, out var body, out errorMessage))
            {
                return false;
            }

            var whitePlayer = tags["White"].Trim();
            var blackPlayer = tags["Black"].Trim();
            var result = NormalizeResultToken(tags["Result"]);
            var playedAt = ParsePgnDate(tags["Date"]);
            var moveCount = CountMoves(body);

            game = new UserGame
            {
                UserId = userId,
                PlayedAt = playedAt,
                WhitePlayer = whitePlayer,
                BlackPlayer = blackPlayer,
                Result = result,
                MoveCount = moveCount,
                DurationMinutes = 0,
                Source = "Manual PGN",
                ExternalId = BuildImportFingerprint(whitePlayer, blackPlayer, result, tags["Date"], body),
                IsAnalyzed = false,
                WhiteAccuracy = null,
                BlackAccuracy = null,
                PgnContent = normalized
            };

            return true;
        }

        private static bool TryParsePgn(string pgn, out Dictionary<string, string> tags, out string body, out string errorMessage)
        {
            tags = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            body = string.Empty;
            errorMessage = string.Empty;

            if (!ValidatePgn(pgn))
            {
                errorMessage = "PGN не прошёл проверку. Обязательные теги: [White], [Black], [Result], [Date] и текст ходов";
                return false;
            }

            var normalized = pgn.Replace("\r\n", "\n").Trim();
            var sections = normalized.Split(new[] { "\n\n" }, 2, StringSplitOptions.None);

            var headerLines = sections[0]
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            foreach (var line in headerLines)
            {
                var match = TagRegex.Match(line);
                if (!match.Success)
                {
                    errorMessage = "PGN содержит некорректный заголовок.";
                    return false;
                }

                tags[match.Groups["name"].Value] = match.Groups["value"].Value;
            }

            if (sections.Length < 2)
            {
                errorMessage = "PGN не содержит тела партии.";
                return false;
            }

            body = sections[1].Trim();
            return true;
        }

        private static DateTime ParsePgnDate(string? value)
        {
            if (DateTime.TryParseExact(value, "yyyy.MM.dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var exact))
            {
                return DateTime.SpecifyKind(exact.Date, DateTimeKind.Utc);
            }

            if (!string.IsNullOrWhiteSpace(value))
            {
                var parts = value.Split('.');
                if (parts.Length == 3 &&
                    int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var year) &&
                    TryParseDatePart(parts[1], 1, out var month) &&
                    TryParseDatePart(parts[2], 1, out var day))
                {
                    try
                    {
                        return new DateTime(year, month, day, 0, 0, 0, DateTimeKind.Utc);
                    }
                    catch
                    {
                    }
                }
            }

            return DateTime.UtcNow;
        }

        private static bool TryParseDatePart(string value, int defaultValue, out int parsed)
        {
            if (int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed))
            {
                return true;
            }

            parsed = defaultValue;
            return true;
        }

        private static int CountMoves(string body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return 0;
            }

            var cleaned = Regex.Replace(body, @"\{[^}]*\}", " ");
            cleaned = Regex.Replace(cleaned, @";[^\r\n]*", " ");
            cleaned = Regex.Replace(cleaned, @"\([^()]*\)", " ");

            var tokens = cleaned.Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            var count = 0;

            foreach (var token in tokens)
            {
                var trimmed = token.Trim();

                if (string.IsNullOrWhiteSpace(trimmed))
                {
                    continue;
                }

                if (trimmed.StartsWith("$", StringComparison.Ordinal))
                {
                    continue;
                }

                if (trimmed is "1-0" or "0-1" or "1/2-1/2" or "*")
                {
                    continue;
                }

                if (Regex.IsMatch(trimmed, @"^\d+\.(?:\.\.)?$", RegexOptions.CultureInvariant))
                {
                    continue;
                }

                count++;
            }

            return count;
        }

        private static string BuildImportFingerprint(string whitePlayer, string blackPlayer, string result, string dateValue, string body)
        {
            var source = string.Join("|",
                whitePlayer.Trim(),
                blackPlayer.Trim(),
                result.Trim(),
                dateValue.Trim(),
                body.Trim());

            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(source));
            return Convert.ToHexString(bytes);
        }
    }
}
