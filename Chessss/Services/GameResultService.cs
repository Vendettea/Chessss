using Chessss.Data;
using Microsoft.EntityFrameworkCore;

namespace Chessss.Services
{
    public sealed class GameResultService
    {
        private readonly ApplicationDbContext _db;

        public GameResultService(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<bool> RecordAiGameResultAsync(string userId, string resultCode, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return false;
            }

            var normalizedResult = NormalizeResultCode(resultCode);

            if (normalizedResult is null || normalizedResult == AiGameResult.None)
            {
                return false;
            }

            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

            if (user is null)
            {
                return false;
            }

            user.GamesPlayed++;

            switch (normalizedResult)
            {
                case AiGameResult.Win:
                    user.Wins++;
                    break;
                case AiGameResult.Loss:
                    user.Losses++;
                    break;
                case AiGameResult.Draw:
                    user.Draws++;
                    break;
            }

            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }

        public static bool IsTerminalResultCode(string? resultCode)
        {
            var normalizedResult = NormalizeResultCode(resultCode);
            return normalizedResult is AiGameResult.Win or AiGameResult.Loss or AiGameResult.Draw;
        }

        private static AiGameResult? NormalizeResultCode(string? resultCode)
        {
            return resultCode?.Trim().ToLowerInvariant() switch
            {
                "none" => AiGameResult.None,
                "win" => AiGameResult.Win,
                "loss" => AiGameResult.Loss,
                "draw" => AiGameResult.Draw,
                _ => null
            };
        }

        private enum AiGameResult
        {
            None,
            Win,
            Loss,
            Draw
        }
    }
}
