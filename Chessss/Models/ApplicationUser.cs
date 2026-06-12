using Microsoft.AspNetCore.Identity;

namespace Chessss.Models
{
    public class ApplicationUser : IdentityUser
    {
        // Добавляем свои кастомные поля для UltraChess
        public string? Nickname { get; set; }
        public string? NormalizedNickname { get; set; }
        public int EloRating { get; set; } = 1000;
        public int GamesPlayed { get; set; }
        public int Wins { get; set; }
        public int Losses { get; set; }
        public int Draws { get; set; }
        public string? AvatarUrl { get; set; }
        public int? MaxAIDifficultyBeaten { get; set; }
        public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;
        // Сохраненный уровень сложности ИИ для данного пользователя
        public int? PreferredAIDifficulty { get; set; }
    }
}
