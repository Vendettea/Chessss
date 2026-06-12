namespace Chessss.Models
{
    public class UserGame
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public DateTime PlayedAt { get; set; }
        public string WhitePlayer { get; set; } = string.Empty;
        public string BlackPlayer { get; set; } = string.Empty;
        public string Result { get; set; } = string.Empty;
        public int MoveCount { get; set; }
        public int DurationMinutes { get; set; }
        public string Source { get; set; } = string.Empty;
        public string? ExternalId { get; set; }
        public bool? PlayedAsWhite { get; set; }
        public bool IsAnalyzed { get; set; }
        public double? WhiteAccuracy { get; set; }
        public double? BlackAccuracy { get; set; }
        public string PgnContent { get; set; } = string.Empty;
    }
}
