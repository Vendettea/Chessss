// Простой бот для генерирования ходов, когда Stockfish недоступен
window.simpleBot = {
    // Генерирует простой ход на основе переданного массива возможных ходов
    generateMove: function(possibleMoves, difficulty) {
        if (!possibleMoves || possibleMoves.length === 0) {
            return null;
        }
        
        console.log("Возможные ходы:", possibleMoves);
        
        // Для простого бота просто выбираем случайный ход
        // В будущем можно добавить более сложную логику
        const randomIndex = Math.floor(Math.random() * possibleMoves.length);
        return possibleMoves[randomIndex];
    }
};
