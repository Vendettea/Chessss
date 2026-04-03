using Chessss.Models;
public class TrainingMaterial
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Content { get; set; } = ""; // Текст урока
    public string? FenPosition { get; set; } // Позиция для доски
    public string? ImageUrl { get; set; } // URL изображения гайда
    public List<Tag> Tags { get; set; } = new();
}