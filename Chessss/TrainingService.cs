using Microsoft.EntityFrameworkCore;
using Chessss.Models;
using Chessss.Data;
namespace Chessss
{
    public class TrainingService
    {
        private readonly ApplicationDbContext _context;

        public TrainingService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<TrainingMaterial>> GetFilteredMaterials(string search, List<string> selectedTags)
        {
            var query = _context.TrainingMaterials
                .Include(m => m.Tags)
                .AsQueryable();

            // 1. Поиск по названию
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(m => m.Title.Contains(search));
            }

            // 2. Фильтр по тегам
            if (selectedTags != null && selectedTags.Any())
            {
                query = query.Where(m => m.Tags.Any(t => selectedTags.Contains(t.Name)));
            }

            return await query.ToListAsync();
        }
    }
}