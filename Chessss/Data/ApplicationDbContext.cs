using Microsoft.EntityFrameworkCore;
using Chessss.Models;

namespace Chessss.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<TrainingMaterial> TrainingMaterials { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<Feedback> Feedbacks { get; set; }
    }
}