using System.ComponentModel.DataAnnotations;

namespace Chessss.Models
{
    public class Feedback
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Напишите хотя бы пару слов!")]
        public string Message { get; set; }

        public DateTime SubmittedAt { get; set; } = DateTime.Now;

        // позже будет для User
        public string? UserId { get; set; }
    }
}