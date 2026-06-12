namespace Chessss.Models.Analysis;

public sealed record GameAnalysisReport
{
    public string GameId { get; init; } = string.Empty;
    public string UserId { get; init; } = string.Empty;
    public double? WhiteAccuracy { get; init; }
    public double? BlackAccuracy { get; init; }
    public double? FinalEvaluation { get; init; }
    public IReadOnlyList<double> EvaluationTrace { get; init; } = Array.Empty<double>();
    public IReadOnlyList<MoveAnalysisEntry> Moves { get; init; } = Array.Empty<MoveAnalysisEntry>();
    public IReadOnlyDictionary<MoveClassification, int> WhiteClassifications { get; init; }
        = new Dictionary<MoveClassification, int>();
    public IReadOnlyDictionary<MoveClassification, int> BlackClassifications { get; init; }
        = new Dictionary<MoveClassification, int>();
}
