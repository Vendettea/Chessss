window.simpleBot = {
    pieceValues: {
        p: 1,
        n: 3,
        b: 3,
        r: 5,
        q: 9,
        k: 100
    },

    generateMove: function (game, possibleMoves, difficulty) {
        if (!game || !possibleMoves || possibleMoves.length === 0) {
            return null;
        }

        const normalizedDifficulty = this.normalizeDifficulty(difficulty);
        const rankedMoves = possibleMoves
            .map(move => ({
                move: move,
                score: this.evaluateMove(game, move)
            }))
            .sort((left, right) => right.score - left.score);

        const candidateCount = Math.min(
            rankedMoves.length,
            Math.max(1, Math.ceil((21 - normalizedDifficulty) / 2))
        );

        const biasedRandom = Math.pow(Math.random(), 1 + normalizedDifficulty / 4);
        const selectedIndex = Math.min(
            candidateCount - 1,
            Math.floor(biasedRandom * candidateCount)
        );

        return rankedMoves[selectedIndex].move;
    },

    evaluateMove: function (game, move) {
        let score = this.centerBonus(move.to);

        if (move.captured) {
            score += (this.pieceValues[move.captured] || 0) * 10;
        }

        if (move.promotion) {
            score += (this.pieceValues[move.promotion] || 0) * 12;
        }

        if (move.flags && (move.flags.indexOf('k') !== -1 || move.flags.indexOf('q') !== -1)) {
            score += 4;
        }

        game.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion || 'q'
        });

        if (game.in_checkmate()) {
            score += 1000;
        } else if (game.in_check()) {
            score += 5;
        }

        game.undo();
        return score;
    },

    centerBonus: function (square) {
        if (!square || square.length !== 2) {
            return 0;
        }

        const file = square.charCodeAt(0) - 96;
        const rank = parseInt(square[1], 10);

        if (Number.isNaN(file) || Number.isNaN(rank)) {
            return 0;
        }

        const fileDistance = Math.abs(4.5 - file);
        const rankDistance = Math.abs(4.5 - rank);

        return Math.max(0, 4 - fileDistance - rankDistance);
    },

    normalizeDifficulty: function (difficulty) {
        const parsed = parseInt(difficulty, 10);

        if (Number.isNaN(parsed)) {
            return 6;
        }

        return Math.min(20, Math.max(1, parsed));
    }
};
