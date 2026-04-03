window.stockfishBridge = {
    board: null,
    stockfish: null,
    dotNetRef: null,
    difficulty: 10, // Уровень сложности (1-20)
    useStockfish: false, // Флаг использования Stockfish

    // Инициализация для игры против ИИ
    init: async function (dotNetRef, difficulty) {
        this.dotNetRef = dotNetRef;
        this.difficulty = difficulty || 10;
        
        console.log("Инициализация stockfishBridge. Сложность:", this.difficulty);
        
        // Пытаемся загрузить Stockfish из CDN
        try {
            if (typeof Stockfish !== 'undefined') {
                this.stockfish = await Stockfish();
                this.useStockfish = true;
                console.log("✓ Stockfish загружен с CDN");
            } else {
                console.warn("Stockfish недоступен с CDN, используем простой бот");
                this.useStockfish = false;
            }
        } catch (e) {
            console.warn("Ошибка загрузки Stockfish, используем простой бот:", e.message);
            this.useStockfish = false;
        }

        var self = this; // Сохраняем контекст для использования в потомках
        
        var config = {
            draggable: true,
            position: 'start',
            onDrop: function(source, target) {
                console.log("Ход: " + source + " -> " + target);
                self.dotNetRef.invokeMethodAsync('HandleMove', source, target);
            }
        };
        this.board = Chessboard('board', config);
        console.log("Доска инициализирована");

        if (this.useStockfish && this.stockfish) {
            // Инициализируем обработчик сообщений Stockfish
            this.stockfish.onmessage = function(line) {
                console.log("Сообщение от Stockfish:", line);
                if (line.startsWith("bestmove")) {
                    const move = line.split(" ")[1];
                    console.log("Лучший ход от Stockfish:", move);
                    self.dotNetRef.invokeMethodAsync('OnBestMoveReceived', move);
                }
            };
            console.log("✓ Stockfish обработчик инициализирован");
        } else {
            console.log("Используется режим простого бота");
        }
    },

    // Функция для обновления доски (используется и в игре, и в обучении)
    updateBoard: function (fen) {
        if (this.board) {
            this.board.position(fen);
        }
    },

    // Функция для перезагрузки доски (используется при новой игре)
    resetBoard: function () {
        if (this.board) {
            this.board.position('start');
        }
    },

    // Отправка команд в Stockfish
    sendCommand: function (command) {
        if (this.useStockfish && this.stockfish) {
            console.log("Команда Stockfish:", command);
            try {
                this.stockfish.postMessage(command);
            } catch (e) {
                console.error("Ошибка отправки команды Stockfish:", e);
                // Если Stockfish упал, просим сервер сгенерировать ход
                this.requestServerMove();
            }
        } else {
            console.log("Запрос хода у сервера (простой бот)");
            this.requestServerMove();
        }
    },

    // Запрос хода у сервера (когда Stockfish недоступен)
    requestServerMove: function () {
        console.log("Запрашиваем ход у сервера...");
        this.dotNetRef.invokeMethodAsync('RequestServerMove');
    },

    // НОВОЕ: Просто отрисовка доски для обучающих гайдов
    initBoardOnly: function (elementId, fen) {
        var pos = (fen && fen !== "") ? fen : 'start';
        Chessboard(elementId, {
            position: pos,
            showNotation: true,
            draggable: false
        });
    }
};