window.stockfishRuntime = {
    engineDefinitions: {
        stockfish18Lite: {
            label: 'Stockfish 18 Lite',
            scriptUrl: 'js/stockfish/engines/stockfish-18-lite/stockfish-18-lite-single.js',
            wasmUrl: 'js/stockfish/engines/stockfish-18-lite/stockfish-18-lite-single.wasm'
        }
    },

    normalizeEngineKey: function () {
        return 'stockfish18Lite';
    },

    getEngineDefinition: function () {
        return this.engineDefinitions.stockfish18Lite;
    },

    normalizeLine: function (message) {
        if (typeof message === 'string') {
            return message;
        }

        if (message && typeof message.data === 'string') {
            return message.data;
        }

        if (message && message.data != null) {
            return String(message.data);
        }

        return '';
    },

    attachListener: function (engine, handler) {
        if (!engine || typeof handler !== 'function') {
            return () => { };
        }

        const wrappedHandler = (event) => handler(this.normalizeLine(event));

        if (typeof engine.addEventListener === 'function') {
            engine.addEventListener('message', wrappedHandler);

            return () => {
                try {
                    engine.removeEventListener('message', wrappedHandler);
                } catch {
                }
            };
        }

        if (typeof engine.addMessageListener === 'function') {
            engine.addMessageListener(handler);

            return () => {
                if (typeof engine.removeMessageListener === 'function') {
                    try {
                        engine.removeMessageListener(handler);
                    } catch {
                    }
                }
            };
        }

        if ('onmessage' in engine) {
            const previousHandler = engine.onmessage;
            engine.onmessage = wrappedHandler;

            return () => {
                engine.onmessage = previousHandler;
            };
        }

        return () => { };
    },

    sendCommandAndWait: function (engine, command, token, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (!engine || typeof engine.postMessage !== 'function') {
                reject(new Error('Stockfish engine is not available.'));
                return;
            }

            let finished = false;
            let unsubscribe = () => { };

            const finalize = (handler, value) => {
                if (finished) {
                    return;
                }

                finished = true;
                window.clearTimeout(timerId);

                try {
                    unsubscribe();
                } catch {
                }

                handler(value);
            };

            const timerId = window.setTimeout(() => {
                finalize(reject, new Error(`Timed out waiting for Stockfish response: ${token}`));
            }, timeoutMs ?? 15000);

            unsubscribe = this.attachListener(engine, (message) => {
                const line = this.normalizeLine(message);

                if (line && line.includes(token)) {
                    finalize(resolve, line);
                }
            });

            try {
                engine.postMessage(command);
            } catch (error) {
                finalize(reject, error);
            }
        });
    },

    createEngine: async function (options) {
        if (typeof Worker !== 'function') {
            throw new Error('Ваш браузер не поддерживает Web Worker, поэтому Stockfish недоступен.');
        }

        const definition = this.getEngineDefinition();
        const scriptUrl = new URL(definition.scriptUrl, document.baseURI).toString();
        const wasmUrl = new URL(definition.wasmUrl, document.baseURI).toString();

        // Важно: эту сборку Stockfish 18 Lite нельзя запускать с hash вида #wasm,worker.
        // При таком hash скрипт считает, что он уже находится во внутреннем worker-режиме,
        // и не навешивает обработчик onmessage, поэтому команда 'uci' никогда не возвращает 'uciok'.
        // Так как .wasm лежит рядом с .js и имеет такое же имя, Stockfish сам найдёт его по умолчанию.
        const workerUrl = scriptUrl;
        const engine = new Worker(workerUrl);

        const startupErrorPromise = new Promise((_, reject) => {
            engine.addEventListener('error', (event) => {
                reject(new Error(event?.message || 'Stockfish worker failed to load.'));
            }, { once: true });
        });

        try {
            await Promise.race([
                this.sendCommandAndWait(engine, 'uci', 'uciok', options?.uciTimeoutMs ?? 20000),
                startupErrorPromise
            ]);

            if (typeof options?.configure === 'function') {
                await options.configure(engine);
            }

            await this.sendCommandAndWait(engine, 'isready', 'readyok', options?.readyTimeoutMs ?? 20000);

            return engine;
        } catch (error) {
            try {
                engine.terminate();
            } catch {
            }

            throw error;
        }
    },

    stopEngine: function (engine) {
        if (!engine) {
            return;
        }

        try {
            if (typeof engine.postMessage === 'function') {
                engine.postMessage('quit');
            }
        } catch {
        }

        try {
            if (typeof engine.terminate === 'function') {
                engine.terminate();
            }
        } catch {
        }
    }
};