window.chessBridge = {
    game: null,
    board: null,
    engine: null,
    dotNetHelper: null,
    boardElement: null,
    resizeHandler: null,
    resizeObserver: null,
    squareClickHandler: null,
    difficulty: 6,
    gameStarted: false,
    aiThinking: false,
    playerColor: 'white',
    gameFinishedByResignation: false,
    botRequestId: 0,
    selectedSquare: null,
    highlightedSquares: [],

    initGame: function (dotNetHelper, boardId, difficulty) {
        this.destroy();

        this.dotNetHelper = dotNetHelper;
        this.difficulty = this.normalizeDifficulty(difficulty);
        this.game = new Chess();
        this.engine = this.createEngine();
        this.playerColor = 'white';
        this.gameFinishedByResignation = false;
        this.selectedSquare = null;
        this.highlightedSquares = [];
        this.boardElement = document.getElementById(boardId);

        const onDragStart = (source, piece) => {
            if (!this.canPlayerMove()) {
                this.clearSelection();
                return false;
            }

            const playerPrefix = this.playerColor === 'white' ? /^w/ : /^b/;

            if (!playerPrefix.test(piece)) {
                return false;
            }

            this.selectSquare(source);
            return true;
        };

        const onDrop = (source, target) => {
            if (!this.canPlayerMove()) {
                this.clearSelection();
                return 'snapback';
            }

            return this.tryPlayerMove(source, target) ? undefined : 'snapback';
        };

        const onSnapEnd = () => this.syncBoard();

        this.board = Chessboard(boardId, {
            draggable: true,
            position: 'start',
            orientation: 'white',
            pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd
        });

        if (this.boardElement) {
            this.squareClickHandler = (event) => this.handleBoardClick(event);
            this.boardElement.addEventListener('click', this.squareClickHandler);

            if (window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(() => this.syncBoardSize());
                this.resizeObserver.observe(this.boardElement);
            }
        }

        this.resizeHandler = () => this.syncBoardSize();
        window.addEventListener('resize', this.resizeHandler);

        this.syncBoardSize();
        this.notifyState('Выберите сложность, сторону и нажмите "Играть".');
    },

    startNewGame: function (difficulty, requestedSide) {
        this.difficulty = this.normalizeDifficulty(difficulty);
        this.aiThinking = false;
        this.gameStarted = true;
        this.gameFinishedByResignation = false;
        this.botRequestId++;
        this.playerColor = this.resolvePlayerColor(requestedSide);
        this.clearSelection();

        if (!this.game) {
            this.game = new Chess();
        } else {
            this.game.reset();
        }

        if (this.board && typeof this.board.orientation === 'function') {
            this.board.orientation(this.playerColor);
        }

        this.syncBoard(true);
        this.notifyState(this.playerColor === 'black'
            ? 'ИИ делает первый ход.'
            : 'Ваш ход.');

        if (this.playerColor === 'black') {
            this.queueAiMove(300);
        }
    },

    prepareForNewGame: function () {
        this.gameStarted = false;
        this.aiThinking = false;
        this.gameFinishedByResignation = false;
        this.botRequestId++;
        this.playerColor = 'white';
        this.clearSelection();

        if (!this.game) {
            this.game = new Chess();
        } else {
            this.game.reset();
        }

        if (this.board && typeof this.board.orientation === 'function') {
            this.board.orientation('white');
        }

        this.syncBoard(true);
        this.notifyState('Выберите сложность, сторону и нажмите "Играть".');
    },

    resignGame: function () {
        if (!this.gameStarted || this.isGameOver()) {
            return;
        }

        this.aiThinking = false;
        this.gameFinishedByResignation = true;
        this.botRequestId++;
        this.clearSelection();
        this.notifyState('Вы сдались. Победа засчитана ИИ.');
    },

    queueAiMove: function (delay) {
        if (!this.gameStarted || !this.game || this.isGameOver()) {
            return;
        }

        this.aiThinking = true;
        this.clearSelection();
        this.notifyState('Ход ИИ.');
        window.setTimeout(() => this.askBot(), delay ?? 250);
    },

    askBot: function () {
        if (!this.gameStarted || !this.game || this.isGameOver()) {
            this.aiThinking = false;
            this.notifyState();
            return;
        }

        if (this.game.turn() !== this.getAiColorCode()) {
            this.aiThinking = false;
            this.notifyState();
            return;
        }

        const requestedHistoryLength = this.game.history().length;
        const requestId = ++this.botRequestId;

        if (this.engine) {
            this.engine.onmessage = (event) => {
                const line = typeof event === 'string' ? event : event?.data;

                if (!line || !line.startsWith('bestmove')) {
                    return;
                }

                const bestMove = line.split(' ')[1];

                if (!this.isLatestBotRequest(requestedHistoryLength, requestId)) {
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

        this.applySimpleBotMove(requestedHistoryLength, requestId);
    },

    applyEngineMove: function (bestMove) {
        if (!this.gameStarted || this.isGameOver()) {
            return;
        }

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

        this.clearSelection();
        this.syncBoard();
        this.notifyState();
    },

    applySimpleBotMove: function (requestedHistoryLength, requestId) {
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
            if (!this.isLatestBotRequest(requestedHistoryLength, requestId)) {
                return;
            }

            this.game.move({
                from: botMove.from,
                to: botMove.to,
                promotion: botMove.promotion || 'q'
            });

            this.aiThinking = false;
            this.clearSelection();
            this.syncBoard();
            this.notifyState();
        }, 200);
    },

    tryPlayerMove: function (source, target) {
        const legalMoves = this.game.moves({ verbose: true });
        const isPromotion = legalMoves.some(m => m.from === source && m.to === target && m.promotion);

        if (isPromotion) {
            if (this.dotNetHelper) {
                this.dotNetHelper.invokeMethodAsync('PromptForPromotion', source, target);
                return true;
            }
        }

        return this.executePlayerMove(source, target, 'q');
    },

    executePlayerMove: function (source, target, promotion) {
        const move = this.game.move({
            from: source,
            to: target,
            promotion: promotion
        });

        if (move === null) {
            const piece = this.game.get(target);

            if (piece && piece.color === this.getPlayerColorCode()) {
                this.selectSquare(target);
            } else {
                this.clearSelection();
            }

            return false;
        }

        this.clearSelection();
        this.syncBoard();
        this.notifyState();

        if (!this.isGameOver()) {
            this.queueAiMove();
        }

        return true;
    },

    completePromotion: function (source, target, piece) {
        if (!piece || !this.executePlayerMove(source, target, piece)) {
            this.syncBoard();
            this.clearSelection();
        }
    },

    handleBoardClick: function (event) {
        if (!this.boardElement) {
            return;
        }

        const squareElement = event.target.closest('[data-square]');

        if (!squareElement || !this.boardElement.contains(squareElement)) {
            return;
        }

        const square = squareElement.getAttribute('data-square');

        if (!square) {
            return;
        }

        if (!this.canPlayerMove()) {
            this.clearSelection();
            return;
        }

        if (this.selectedSquare === square) {
            this.clearSelection();
            return;
        }

        if (this.selectedSquare) {
            if (this.tryPlayerMove(this.selectedSquare, square)) {
                return;
            }
        }

        const piece = this.game.get(square);

        if (piece && piece.color === this.getPlayerColorCode()) {
            this.selectSquare(square);
            return;
        }

        this.clearSelection();
    },

    selectSquare: function (square) {
        if (!this.game || !this.canPlayerMove()) {
            this.clearSelection();
            return;
        }

        const legalMoves = this.game.moves({
            square: square,
            verbose: true
        });

        if (!legalMoves || legalMoves.length === 0) {
            this.clearSelection();
            return;
        }

        this.selectedSquare = square;
        this.highlightedSquares = legalMoves.map(move => move.to);
        this.renderHighlights();
    },

    clearSelection: function () {
        this.selectedSquare = null;
        this.highlightedSquares = [];
        this.renderHighlights();
    },

    renderHighlights: function () {
        if (!this.boardElement) {
            return;
        }

        const highlightedClassNames = [
            'play-ai-square-selected',
            'play-ai-square-target',
            'play-ai-square-occupied'
        ];

        this.boardElement
            .querySelectorAll('.square-55d63')
            .forEach(squareElement => squareElement.classList.remove(...highlightedClassNames));

        if (this.selectedSquare) {
            const selectedElement = this.boardElement.querySelector('[data-square="' + this.selectedSquare + '"]');

            if (selectedElement) {
                selectedElement.classList.add('play-ai-square-selected');
            }
        }

        this.highlightedSquares.forEach(square => {
            const squareElement = this.boardElement.querySelector('[data-square="' + square + '"]');

            if (!squareElement) {
                return;
            }

            squareElement.classList.add('play-ai-square-target');

            if (this.game && this.game.get(square)) {
                squareElement.classList.add('play-ai-square-occupied');
            }
        });
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
            this.isGameOver(),
            this.getResultCode(),
            this.getPgn(),
            this.playerColor
        );
    },

    getResultCode: function () {
        if (!this.gameStarted || !this.game || !this.isGameOver()) {
            return 'none';
        }

        if (this.gameFinishedByResignation) {
            return 'loss';
        }

        if (this.game.in_checkmate()) {
            const winnerColor = this.game.turn() === 'w' ? 'black' : 'white';
            return winnerColor === this.playerColor ? 'win' : 'loss';
        }

        if (this.game.in_stalemate() || this.game.in_draw()) {
            return 'draw';
        }

        return 'none';
    },

    getPgn: function () {
        if (!this.game) {
            return '';
        }

        let pgn = '';

        try {
            pgn = this.game.pgn({ max_width: 80, newline_char: '\n' });
        } catch (error) {
            pgn = this.game.pgn();
        }

        const result = this.getPgnResult();

        if (result === '*') {
            return pgn;
        }

        if (!pgn) {
            return result;
        }

        return /\s(1-0|0-1|1\/2-1\/2|\*)$/.test(pgn.trim())
            ? pgn
            : `${pgn} ${result}`;
    },

    getPgnResult: function () {
        if (!this.gameStarted || !this.game || !this.isGameOver()) {
            return '*';
        }

        if (this.gameFinishedByResignation) {
            return this.playerColor === 'white' ? '0-1' : '1-0';
        }

        if (this.game.in_checkmate()) {
            return this.game.turn() === 'w' ? '0-1' : '1-0';
        }

        if (this.game.in_stalemate() || this.game.in_draw()) {
            return '1/2-1/2';
        }

        return '*';
    },

    getStatusText: function () {
        if (!this.gameStarted) {
            return 'Выберите сложность, сторону и нажмите "Играть".';
        }

        if (this.gameFinishedByResignation) {
            return 'Вы сдались. Победа засчитана ИИ.';
        }

        if (this.game.in_checkmate()) {
            const winnerColor = this.game.turn() === 'w' ? 'black' : 'white';
            return winnerColor === this.playerColor
                ? 'Мат. Победа за вами.'
                : 'Мат. Победил ИИ.';
        }

        if (this.game.in_stalemate()) {
            return 'Пат. Партия завершилась вничью.';
        }

        if (this.game.in_draw()) {
            return 'Ничья. Больше допустимых продолжений нет.';
        }

        const playerTurn = this.game.turn() === this.getPlayerColorCode();
        let status = playerTurn ? 'Ваш ход.' : 'Ход ИИ.';

        if (this.game.in_check()) {
            status += ' Шах.';
        }

        return status;
    },

    canPlayerMove: function () {
        return this.gameStarted
            && !this.aiThinking
            && this.game
            && !this.isGameOver()
            && this.game.turn() === this.getPlayerColorCode();
    },

    isGameOver: function () {
        return this.gameFinishedByResignation
            || (this.game && this.game.game_over());
    },

    getPlayerColorCode: function () {
        return this.playerColor === 'black' ? 'b' : 'w';
    },

    getAiColorCode: function () {
        return this.playerColor === 'black' ? 'w' : 'b';
    },

    resolvePlayerColor: function (requestedSide) {
        const normalized = typeof requestedSide === 'string'
            ? requestedSide.toLowerCase()
            : 'white';

        if (normalized === 'black') {
            return 'black';
        }

        if (normalized === 'random') {
            return Math.random() < 0.5 ? 'white' : 'black';
        }

        return 'white';
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

        this.renderHighlights();
    },

    syncBoardSize: function () {
        if (this.board && typeof this.board.resize === 'function') {
            window.requestAnimationFrame(() => {
                this.board.resize();
                this.renderHighlights();
            });
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

    isLatestBotRequest: function (requestedHistoryLength, requestId) {
        return this.gameStarted
            && this.game
            && this.aiThinking
            && !this.isGameOver()
            && this.botRequestId === requestId
            && this.game.history().length === requestedHistoryLength;
    },

    normalizeDifficulty: function (difficulty) {
        const parsed = parseInt(difficulty, 10);

        if (Number.isNaN(parsed)) {
            return 6;
        }

        return Math.min(20, Math.max(1, parsed));
    },

    copyText: async function (text) {
        if (!text) {
            return false;
        }

        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (error) {
                console.warn('Clipboard API failed, falling back to execCommand.', error);
            }
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            return document.execCommand('copy');
        } catch (error) {
            console.warn('Unable to copy text.', error);
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    },

    scrollElementToBottom: function (element) {
        if (!element) {
            return;
        }

        window.requestAnimationFrame(() => {
            element.scrollTop = element.scrollHeight;
        });
    },

    destroy: function () {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.boardElement && this.squareClickHandler) {
            this.boardElement.removeEventListener('click', this.squareClickHandler);
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
        this.boardElement = null;
        this.squareClickHandler = null;
        this.gameStarted = false;
        this.aiThinking = false;
        this.playerColor = 'white';
        this.gameFinishedByResignation = false;
        this.botRequestId++;
        this.selectedSquare = null;
        this.highlightedSquares = [];
    }
};
