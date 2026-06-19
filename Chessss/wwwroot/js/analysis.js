window.analysisBridge = {
    board: null,
    game: null,
    stockfish: null,
    dotNetRef: null,
    engineReady: false,
    engineListenerCleanup: null,
    engineInitError: null,
    engineVariant: null,
    currentMoveIndex: -1,
    history: [],
    evaluations: [],
    isAnalyzingAll: false,
    currentAnalysisIndex: -1,
    searchInFlight: false,
    activeRequest: null,
    pendingRequest: null,

    init: async function (dotNetRef, engineKey) {
        this.dotNetRef = dotNetRef;
        this.game = new Chess();
        this.engineReady = false;
        this.engineInitError = null;
        this.engineVariant = this.normalizeEngineKey(engineKey);
        
        var config = {
            draggable: true,
            position: 'start',
            onDrop: function(source, target) {
                // Not strictly allowing new moves right now, or maybe just for exploring variations later
                return 'snapback';
            }
        };
        this.board = Chessboard('analysis-board', config);

        try {
            this.stockfish = await window.stockfishRuntime.createEngine({
                engineKey: this.engineVariant,
                configure: (engine) => {
                    engine.postMessage('setoption name UCI_AnalyseMode value true');
                }
            });

            this.engineReady = true;
            this.engineListenerCleanup = window.stockfishRuntime.attachListener(this.stockfish, (message) => {
                this.handleStockfishMessage(message);
            });
            return true;
        } catch (e) {
            this.stockfish = null;
            this.engineReady = false;
            this.engineInitError = e?.message || 'Stockfish не загрузился.';
            console.error("Error loading stockfish: ", e);
            return false;
        }
    },

    normalizeEngineKey: function () {
        return 'stockfish18Lite';
    },

    ensureEngine: async function (engineKey) {
        const normalizedEngineKey = this.normalizeEngineKey(engineKey);

        if (this.stockfish && this.engineReady && this.engineVariant === normalizedEngineKey) {
            return true;
        }

        if (this.engineListenerCleanup) {
            try {
                this.engineListenerCleanup();
            } catch {
            }

            this.engineListenerCleanup = null;
        }

        if (this.stockfish) {
            try {
                window.stockfishRuntime.stopEngine(this.stockfish);
            } catch {
            }
        }

        this.stockfish = null;
        this.engineReady = false;
        this.engineInitError = null;
        this.engineVariant = normalizedEngineKey;
        this.searchInFlight = false;
        this.activeRequest = null;
        this.pendingRequest = null;

        try {
            this.stockfish = await window.stockfishRuntime.createEngine({
                engineKey: normalizedEngineKey,
                configure: (engine) => {
                    engine.postMessage('setoption name UCI_AnalyseMode value true');
                }
            });

            this.engineReady = true;
            this.engineListenerCleanup = window.stockfishRuntime.attachListener(this.stockfish, (message) => {
                this.handleStockfishMessage(message);
            });
            return true;
        } catch (error) {
            this.stockfish = null;
            this.engineReady = false;
            this.engineInitError = error?.message || 'Stockfish не загрузился.';
            console.error("Error loading stockfish: ", error);
            return false;
        }
    },

    loadPgn: function(pgn) {
        if (!this.game) this.game = new Chess();
        var success = this.game.load_pgn(pgn);
        if (success) {
            this.history = this.game.history({ verbose: true });
            this.currentMoveIndex = -1;
            this.evaluations = new Array(this.history.length).fill(null);
            this.isAnalyzingAll = false;
            this.currentAnalysisIndex = -1;
            this.pendingRequest = null;
            this.updateBoard();
            return true;
        }
        return false;
    },

    nextMove: function() {
        if (this.currentMoveIndex < this.history.length - 1) {
            this.currentMoveIndex++;
            this.updateBoard();
        }
    },

    prevMove: function() {
        if (this.currentMoveIndex >= 0) {
            this.currentMoveIndex--;
            this.updateBoard();
        }
    },

    updateBoard: function() {
        // Reconstruct the board up to currentMoveIndex
        var tempGame = new Chess();
        for (let i = 0; i <= this.currentMoveIndex; i++) {
            tempGame.move(this.history[i]);
        }
        this.board.position(tempGame.fen());

        // Manual navigation cancels any in-flight "analyze all" run so the
        // two flows never fight over the same engine instance.
        this.isAnalyzingAll = false;

        // Request evaluation for this fen
        this.evaluatePosition(tempGame.fen(), this.currentMoveIndex);

        // Notify Blazor about the move index update
        if (this.dotNetRef) {
            this.dotNetRef.invokeMethodAsync('OnMoveChanged', this.currentMoveIndex);
        }
    },

    // Sends a position+go request to the engine. If a previous search is
    // still running, it is stopped first and this request is queued to run
    // once that search's bestmove arrives. This keeps the UCI command
    // sequence valid: Stockfish must never receive a new "position"/"go"
    // while it is still thinking about the previous one.
    evaluatePosition: function(fen, requestIndex) {
        if (!this.stockfish || !this.engineReady) {
            return;
        }

        const request = { fen: fen, index: requestIndex, mode: 'single' };

        if (this.searchInFlight) {
            this.pendingRequest = request;
            try {
                this.stockfish.postMessage('stop');
            } catch {
            }
            return;
        }

        this.runSearch(request, 15);
    },

    runSearch: function (request, depth) {
        this.searchInFlight = true;
        this.activeRequest = request;
        this.stockfish.postMessage('position fen ' + request.fen);
        this.stockfish.postMessage('go depth ' + depth);
    },


    analyzeAllMoves: async function(engineKey) {
        if (!this.history || this.history.length === 0) {
            if (this.dotNetRef) {
                this.dotNetRef.invokeMethodAsync('OnAnalysisComplete');
            }
            return false;
        }

        if (!await this.ensureEngine(engineKey)) {
            return false;
        }

        this.stockfish.postMessage("ucinewgame");

        // Reset evaluations
        this.evaluations = new Array(this.history.length).fill(null);

        // Start sequential analysis from start pos
        this.isAnalyzingAll = true;
        this.currentAnalysisIndex = -1;
        this.pendingRequest = null;

        const startRequest = { index: this.currentAnalysisIndex, mode: 'all' };

        if (this.searchInFlight) {
            // A manual single-position search is still running; stop it and
            // let the engine's "bestmove" handler pick up this request next.
            this.pendingRequest = startRequest;
            try {
                this.stockfish.postMessage('stop');
            } catch {
            }
        } else {
            this.analyzeMove(startRequest);
        }

        return true;
    },

    analyzeMove: function(request) {
        var tempGame = new Chess();
        for (let i = 0; i <= request.index; i++) {
            tempGame.move(this.history[i]);
        }
        request.fen = tempGame.fen();
        this.runSearch(request, 12);
    },

    handleStockfishMessage: function(line) {
        // Parse evaluation
        // Looking for lines like "info depth 15 ... score cp 35 ..."
        // or "score mate 3"
        if (line.includes("info") && line.includes("score") && this.activeRequest) {
            let parts = line.split(" ");
            let scoreIndex = parts.indexOf("score");
            if (scoreIndex !== -1 && scoreIndex + 2 < parts.length) {
                let type = parts[scoreIndex + 1]; // "cp" or "mate"
                let value = parseInt(parts[scoreIndex + 2]);

                let indexToUpdate = this.activeRequest.index;

                // Determine whose turn it is from the current tempGame FEN
                let tempGame = new Chess();
                for (let i = 0; i <= indexToUpdate; i++) {
                    if (i >= 0) tempGame.move(this.history[i]);
                }
                let isWhiteToMove = tempGame.turn() === 'w';

                // Keep the latest evaluation (depth increases)
                let evalObj = { type: type, value: value, raw: line, isWhiteToMove: isWhiteToMove };

                if (this.dotNetRef) {
                    this.dotNetRef.invokeMethodAsync('OnEvaluationReceived', indexToUpdate, evalObj);
                }
            }
        }
        if (line.startsWith("bestmove")) {
            // The search we issued has finished (either naturally or via "stop").
            const finishedRequest = this.activeRequest;
            this.searchInFlight = false;
            this.activeRequest = null;

            // If something queued a newer request while we were searching
            // (e.g. "Начать анализ" pressed while a manual hover-eval was
            // running), run that one now instead of continuing the old flow.
            if (this.pendingRequest) {
                const next = this.pendingRequest;
                this.pendingRequest = null;

                if (next.mode === 'all') {
                    this.isAnalyzingAll = true;
                    this.currentAnalysisIndex = next.index;
                    this.analyzeMove(next);
                } else {
                    this.runSearch(next, 15);
                }
                return;
            }

            if (finishedRequest && finishedRequest.mode === 'all' && this.isAnalyzingAll) {
                this.currentAnalysisIndex++;
                if (this.currentAnalysisIndex < this.history.length) {
                    this.analyzeMove({ index: this.currentAnalysisIndex, mode: 'all' });
                } else {
                    this.isAnalyzingAll = false;
                    if (this.dotNetRef) {
                        this.dotNetRef.invokeMethodAsync('OnAnalysisComplete');
                    }
                }
            }
        }
    },

    destroy: function () {
        if (this.engineListenerCleanup) {
            this.engineListenerCleanup();
            this.engineListenerCleanup = null;
        }

        if (this.stockfish) {
            try {
                window.stockfishRuntime.stopEngine(this.stockfish);
            } catch {
            }
        }

        if (this.board && typeof this.board.destroy === 'function') {
            try {
                this.board.destroy();
            } catch {
            }
        }

        this.stockfish = null;
        this.engineReady = false;
        this.engineInitError = null;
        this.engineVariant = null;
        this.board = null;
        this.game = null;
        this.dotNetRef = null;
        this.history = [];
        this.evaluations = [];
        this.currentMoveIndex = -1;
        this.isAnalyzingAll = false;
        this.currentAnalysisIndex = -1;
        this.searchInFlight = false;
        this.activeRequest = null;
        this.pendingRequest = null;
    }
};