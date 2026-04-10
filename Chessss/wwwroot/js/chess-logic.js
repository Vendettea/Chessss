window.chessBridge = {
    game: null,
    board: null,
    engine: null,

    initGame: function (dotNetHelper, boardId) {
        // Инициализация chess.js для логики
        this.game = new Chess();

        // Запуск Stockfish в фоновом потоке (Worker)
        // Убедись, что файл stockfish.js лежит в wwwroot/js/
        this.engine = new Worker('/js/stockfish.js');

        const onDrop = (source, target) => {
            let move = this.game.move({
                from: source,
                to: target,
                promotion: 'q'
            });

            if (move === null) return 'snapback';

            // Передаем FEN в C# для отображения или сохранения
            dotNetHelper.invokeMethodAsync('OnMovePerformed', this.game.fen());

            // Просим бота ответить через 250мс для реалистичности
            window.setTimeout(() => this.askBot(), 250);
        };

        const config = {
            draggable: true,
            position: 'start',
            onDrop: onDrop,
            pieceTheme: 'img/chesspieces/wikipedia/{piece}.png' // Проверь путь к фигурам
        };

        this.board = Chessboard(boardId, config);
    },

    askBot: function () {
        this.engine.postMessage('position fen ' + this.game.fen());
        this.engine.postMessage('go depth 12'); // Глубина поиска

        this.engine.onmessage = (event) => {
            if (event.data.startsWith('bestmove')) {
                const moveParts = event.data.split(' ');
                const bestMove = moveParts[1];

                if (bestMove) {
                    this.game.move({
                        from: bestMove.substring(0, 2),
                        to: bestMove.substring(2, 4),
                        promotion: 'q'
                    });
                    this.board.position(this.game.fen());
                }
            }
        };
    },

    reset: function () {
        if (this.game) {
            this.game.reset();
            this.board.start();
        }
    }
};