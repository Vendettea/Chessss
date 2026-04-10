using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Chessss.Models;

namespace Chessss.Data
{
    // 1. ВАЖНО: Теперь мы наследуемся от IdentityDbContext, а не просто от DbContext!
    // И передаем туда нашу новую модель ApplicationUser.
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<TrainingMaterial> TrainingMaterials { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<Feedback> Feedbacks { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // 2. ВАЖНО: Обязательно вызываем базовый метод, иначе таблицы Identity не создадутся!
            base.OnModelCreating(modelBuilder);

            // Твоя настройка Many-to-Many остается без изменений
            modelBuilder.Entity<TrainingMaterial>()
                .HasMany(m => m.Tags)
                .WithMany(t => t.Materials)
                .UsingEntity(j => j.ToTable("MaterialTags"));
        }
    }
}