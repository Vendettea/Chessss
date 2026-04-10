using System.Threading.Tasks;
using Chessss.Data;
using Chessss.Models;
using Microsoft.EntityFrameworkCore;

namespace Chessss.Services
{
    /// <summary>
    /// Service for persisting and retrieving the preferred AI difficulty for a user.
    /// </summary>
    public class UserDifficultyService
    {
        private readonly ApplicationDbContext _context;

        public UserDifficultyService(ApplicationDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Gets the stored difficulty for the specified user. Returns null if not set.
        /// </summary>
        public async Task<int?> GetDifficultyAsync(string userId)
        {
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);
            return user?.PreferredAIDifficulty;
        }

        /// <summary>
        /// Saves the preferred difficulty for the specified user.
        /// </summary>
        public async Task SetDifficultyAsync(string userId, int difficulty)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return;
            user.PreferredAIDifficulty = difficulty;
            await _context.SaveChangesAsync();
        }
    }
}
