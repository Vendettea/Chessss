using Microsoft.AspNetCore.Identity;

namespace Chessss.Models
{
    // Наследуемся от базового пользователя Identity
    public class ApplicationUser : IdentityUser
    {
        // Добавляем свои кастомные поля для UltraChess
        public string? Nickname { get; set; }
        public int EloRating { get; set; } = 1000; // Стартовый рейтинг по умолчанию
        public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;
        // Сохраненный уровень сложности ИИ для данного пользователя
        public int? PreferredAIDifficulty { get; set; }
    }
}
