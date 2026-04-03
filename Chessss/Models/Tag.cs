namespace Chessss.Models;
public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public List<TrainingMaterial> Materials { get; set; } = new();
}