using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Chessss.Models;

namespace Chessss.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        public DbSet<TrainingMaterial> TrainingMaterials { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<Feedback> Feedbacks { get; set; }
        public DbSet<UserGame> UserGames { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Обязательно вызываем базовый метод иначе таблицы Identity не создадутся
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<ApplicationUser>(entity =>
            {
                entity.Property(u => u.Nickname)
                    .HasMaxLength(20);

                entity.Property(u => u.NormalizedNickname)
                    .HasMaxLength(20);

                entity.Property(u => u.AvatarUrl)
                    .HasMaxLength(512);

                entity.Property(u => u.MaxAIDifficultyBeaten);

                entity.HasIndex(u => u.NormalizedNickname)
                    .IsUnique()
                    .HasDatabaseName("UserNicknameIndex");
            });

            modelBuilder.Entity<TrainingMaterial>()
                .HasMany(m => m.Tags)
                .WithMany(t => t.Materials)
                .UsingEntity(j => j.ToTable("MaterialTags"));

            modelBuilder.Entity<UserGame>(entity =>
            {
                entity.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(x => new { x.UserId, x.PlayedAt });
                entity.HasIndex(x => new { x.UserId, x.ExternalId }).IsUnique();
            });
        }
    }
}
