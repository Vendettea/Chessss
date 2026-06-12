namespace Chessss.Models.Analysis;

public sealed record MoveAnalysisEntry
{
    public int MoveNumber { get; init; }
    public AnalysisPlayerColor PlayerColor { get; init; }
    public string San { get; init; } = string.Empty;
    public string? Lan { get; init; }
    public string FenBefore { get; init; } = string.Empty;
    public string FenAfter { get; init; } = string.Empty;
    public double? EvaluationBefore { get; init; }
    public double? EvaluationAfter { get; init; }
    public double? CentipawnLoss { get; init; }
    public MoveClassification Classification { get; init; }
    public string? BestMove { get; init; }
    public int? MateIn { get; init; }
}

public enum AnalysisPlayerColor
{
    White,
    Black
}
