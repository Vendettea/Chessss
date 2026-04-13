window.chessBridge = {
    game: null,
    board: null,
    engine: null,
    dotNetHelper: null,
    difficulty: 6,
    gameStarted: false,
    aiThinking: false,
    resizeHandler: null,

    initGame: function (dotNetHelper, boardId, difficulty) {
        this.destroy();

        this.dotNetHelper = dotNetHelper;
        this.difficulty = this.normalizeDifficulty(difficulty);
        this.game = new Chess();
        this.engine = this.createEngine();

        const onDragStart = (source, piece) => {
            if (!this.gameStarted || this.aiThinking || this.game.game_over()) {
                return false;
            }

            if (this.game.turn() !== 'w') {
                return false;
            }

            return piece.search(/^b/) === -1;
        };

        const onDrop = (source, target) => {
            if (!this.gameStarted || this.aiThinking || this.game.turn() !== 'w') {
                return 'snapback';
            }

            const move = this.game.move({
                from: source,
                to: target,
                promotion: 'q'
            });

            if (move === null) {
                return 'snapback';
            }

            this.syncBoard();
            this.notifyState();

            if (this.game.game_over()) {
                return;
            }

            this.aiThinking = true;
            this.notifyState('ИИ думает над ответом...');
            window.setTimeout(() => this.askBot(), 250);
        };

        const onSnapEnd = () => this.syncBoard();

        this.board = Chessboard(boardId, {
            draggable: true,
            position: 'start',
            pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd
        });

        this.resizeHandler = () => this.syncBoardSize();
        window.addEventListener('resize', this.resizeHandler);
        this.syncBoardSize();
        this.notifyState('Выберите сложность и нажмите "Начать игру".');
    },

    startNewGame: function (difficulty) {
        this.difficulty = this.normalizeDifficulty(difficulty);
        this.aiThinking = false;
        this.gameStarted = true;

        if (!this.game) {
            this.game = new Chess();
        } else {
            this.game.reset();
        }

        this.syncBoard(true);
        this.notifyState();
    },

    askBot: function () {
        if (!this.gameStarted || !this.game || this.game.game_over()) {
            this.aiThinking = false;
            this.notifyState();
            return;
        }

        const requestedHistoryLength = this.game.history().length;

        if (this.engine) {
            this.engine.onmessage = (event) => {
                const line = typeof event === 'string' ? event : event?.data;

                if (!line || !line.startsWith('bestmove')) {
                    return;
                }

                const bestMove = line.split(' ')[1];

                if (!this.isLatestBotRequest(requestedHistoryLength)) {
                    return;
                }

                if (!bestMove || bestMove === '(none)') {
                    this.aiThinking = false;
                    this.notifyState();
                    return;
                }

                this.applyEngineMove(bestMove);
            };

            try {
                this.engine.postMessage('position fen ' + this.game.fen());
                this.engine.postMessage('go depth ' + this.difficulty);
                return;
            } catch (error) {
                console.warn('Stockfish unavailable, falling back to simple bot.', error);
            }
        }

        this.applySimpleBotMove(requestedHistoryLength);
    },

    applyEngineMove: function (bestMove) {
        const appliedMove = this.game.move({
            from: bestMove.substring(0, 2),
            to: bestMove.substring(2, 4),
            promotion: bestMove.length > 4 ? bestMove.substring(4, 5) : 'q'
        });

        this.aiThinking = false;

        if (appliedMove === null) {
            this.notifyState('ИИ не смог выполнить ход. Нажмите "Заново".');
            return;
        }

        this.syncBoard();
        this.notifyState();
    },

    applySimpleBotMove: function (requestedHistoryLength) {
        const possibleMoves = this.game.moves({ verbose: true });
        const botMove = window.simpleBot
            ? window.simpleBot.generateMove(this.game, possibleMoves, this.difficulty)
            : null;

        if (!botMove) {
            this.aiThinking = false;
            this.notifyState('Для ИИ не нашлось хода. Нажмите "Заново".');
            return;
        }

        window.setTimeout(() => {
            if (!this.isLatestBotRequest(requestedHistoryLength)) {
                return;
            }

            this.game.move({
                from: botMove.from,
                to: botMove.to,
                promotion: botMove.promotion || 'q'
            });

            this.aiThinking = false;
            this.syncBoard();
            this.notifyState();
        }, 200);
    },

    notifyState: function (customStatus) {
        if (!this.dotNetHelper || !this.game) {
            return;
        }

        this.dotNetHelper.invokeMethodAsync(
            'OnGameStateChanged',
            this.game.fen(),
            customStatus || this.getStatusText(),
            this.game.history(),
            this.gameStarted,
            this.game.game_over()
        );
    },

    getStatusText: function () {
        if (!this.gameStarted) {
            return 'Выберите сложность и нажмите "Начать игру".';
        }

        if (this.game.in_checkmate()) {
            return this.game.turn() === 'w'
                ? 'Мат. Победил ИИ.'
                : 'Мат. Победа за вами.';
        }

        if (this.game.in_stalemate()) {
            return 'Пат. Партия завершилась вничью.';
        }

        if (this.game.in_draw()) {
            return 'Ничья. Больше допустимых продолжений нет.';
        }

        let status = this.game.turn() === 'w'
            ? 'Ваш ход белыми.'
            : 'Ход ИИ за чёрных.';

        if (this.game.in_check()) {
            status += ' Шах.';
        }

        return status;
    },

    syncBoard: function (resetToStart) {
        if (!this.board || !this.game) {
            return;
        }

        if (resetToStart) {
            this.board.position('start', false);
        } else {
            this.board.position(this.game.fen(), false);
        }
    },

    syncBoardSize: function () {
        if (this.board && typeof this.board.resize === 'function') {
            this.board.resize();
        }
    },

    createEngine: function () {
        if (typeof Stockfish === 'undefined') {
            return null;
        }

        try {
            const engine = Stockfish();
            engine.postMessage('uci');
            return engine;
        } catch (error) {
            console.warn('Unable to create Stockfish instance.', error);
            return null;
        }
    },

    isLatestBotRequest: function (requestedHistoryLength) {
        return this.gameStarted
            && this.game
            && this.aiThinking
            && this.game.history().length === requestedHistoryLength;
    },

    normalizeDifficulty: function (difficulty) {
        const parsed = parseInt(difficulty, 10);

        if (Number.isNaN(parsed)) {
            return 6;
        }

        return Math.min(20, Math.max(1, parsed));
    },

    destroy: function () {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        if (this.engine) {
            try {
                this.engine.postMessage('quit');
            } catch (error) {
                console.warn('Unable to stop Stockfish.', error);
            }
        }

        if (this.board && typeof this.board.destroy === 'function') {
            try {
                this.board.destroy();
            } catch (error) {
                console.warn('Unable to destroy chessboard instance.', error);
            }
        }

        this.engine = null;
        this.board = null;
        this.game = null;
        this.dotNetHelper = null;
        this.gameStarted = false;
        this.aiThinking = false;
    }
};
