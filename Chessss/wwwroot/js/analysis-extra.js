// analysis-extra.js
// Extra helpers that extend analysisBridge without touching the original file.

window.analysisExtra = {

    goFirst: function () {
        const bridge = window.analysisBridge;
        if (!bridge) return;
        while (bridge.currentMoveIndex >= 0) {
            bridge.currentMoveIndex--;
        }
        bridge.currentMoveIndex = -1;
        bridge.updateBoard();
    },

    goLast: function () {
        const bridge = window.analysisBridge;
        if (!bridge || !bridge.history) return;
        bridge.currentMoveIndex = bridge.history.length - 1;
        bridge.updateBoard();
    },

    goToMove: function (halfMoveIndex) {
        const bridge = window.analysisBridge;
        if (!bridge || !bridge.history) return;
        const clamped = Math.max(-1, Math.min(bridge.history.length - 1, halfMoveIndex));
        bridge.currentMoveIndex = clamped;
        bridge.updateBoard();
    },

    getMoveList: function () {
        const bridge = window.analysisBridge;
        if (!bridge || !bridge.history) return [];
        return bridge.history.map(h => h.san || h);
    }
};

window.analysisKeyboard = {
    _cleanup: null,

    init: function (dotNetRef) {
        // Clean up any previous listener
        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }

        const handler = (e) => {
            // Only fire when not typing in an input/textarea
            const tag = document.activeElement?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                window.analysisBridge?.prevMove();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                window.analysisBridge?.nextMove();
            } else if (e.key === 'ArrowUp' || e.key === 'Home') {
                e.preventDefault();
                window.analysisExtra?.goFirst();
            } else if (e.key === 'ArrowDown' || e.key === 'End') {
                e.preventDefault();
                window.analysisExtra?.goLast();
            }
        };

        document.addEventListener('keydown', handler);
        this._cleanup = () => document.removeEventListener('keydown', handler);
    },

    destroy: function () {
        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }
    }
};
