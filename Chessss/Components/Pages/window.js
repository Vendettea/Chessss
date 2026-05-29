window.analysisBridge = {
    board: null,
    game: null,
    stockfish: null,
    dotNetRef: null,
    currentMoveIndex: -1,
    history: [],
    evaluations: [],

    init: function (dotNetRef) {
        this.dotNetRef = dotNetRef;
        this.game = new Chess();
        
        var self = this;
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
            if (typeof Stockfish !== 'undefined') {
                this.stockfish = Stockfish();
                this.stockfish.onmessage = function(line) {
                    self.handleStockfishMessage(line);
                };
            } else {
                console.warn("Stockfish is not defined.");
            }
        } catch(e) {
            console.error("Error loading stockfish: ", e);
        }
    },

    loadPgn: function(pgn) {
        if (!this.game) this.game = new Chess();
        var success = this.game.load_pgn(pgn);
        if (success) {
            this.history = this.game.history({ verbose: true });
            this.currentMoveIndex = -1;
            this.evaluations = new Array(this.history.length).fill(null);
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
        
        // Request evaluation for this fen
        this.evaluatePosition(tempGame.fen());
        
        // Notify Blazor about the move index update
        if (this.dotNetRef) {
            this.dotNetRef.invokeMethodAsync('OnMoveChanged', this.currentMoveIndex);
        }
    },
    
    evaluatePosition: function(fen) {
        if (this.stockfish) {
            this.stockfish.postMessage("position fen " + fen);
            this.stockfish.postMessage("go depth 15");
        }
    },

    analyzeAllMoves: function() {
        if (!this.history || this.history.length === 0) return;
        
        // Reset evaluations
        this.evaluations = new Array(this.history.length).fill(null);
        
        // Start sequential analysis from move 0
        this.currentAnalysisIndex = 0;
        this.analyzeMove(0);
    },

    analyzeMove: function(index) {
        var tempGame = new Chess();
        for (let i = 0; i <= index; i++) {
            tempGame.move(this.history[i]);
        }
        if (this.stockfish) {
            this.stockfish.postMessage("position fen " + tempGame.fen());
            this.stockfish.postMessage("go depth 15");
        }
    },

    handleStockfishMessage: function(line) {
        // Parse evaluation
        // Looking for lines like "info depth 15 ... score cp 35 ..."
        // or "score mate 3"
        if (line.includes("info") && line.includes("score")) {
            let parts = line.split(" ");
            let scoreIndex = parts.indexOf("score");
            if (scoreIndex !== -1 && scoreIndex + 2 < parts.length) {
                let type = parts[scoreIndex + 1]; // "cp" or "mate"
                let value = parseInt(parts[scoreIndex + 2]);
                
                // Keep the latest evaluation (depth increases)
                let evalObj = { type: type, value: value, raw: line };
                
                if (this.dotNetRef) {
                    this.dotNetRef.invokeMethodAsync('OnEvaluationReceived', this.currentMoveIndex, evalObj);
                }
            }
        }
        if (line.startsWith("bestmove")) {
             // Evaluation finished for current request
             // if we were analyzing all moves, proceed to next
        }
    }
};