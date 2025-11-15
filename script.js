// ============================================================
// Die_Einzig_Wahre_PCB_v2.3 - PWA Frontend Logic
// Author: Maximilian Gardiewski
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // State Management
    // ============================================================
    const state = {
        serial: {
            port: null,
            reader: null,
            writer: null,
            connected: false,
            reading: false,
        },
        config: createDefaultConfig(),
        ui: {
            currentLevel: 'normal', // 'normal', 'shift1', 'shift2', 'shift3'
        },
    };

    // ============================================================
    // UI Element References
    // ============================================================
    const ui = {
        viewConnect: document.getElementById('view-connect'),
        viewMain: document.getElementById('view-main'),
        btnConnect: document.getElementById('btn-connect'),
        btnDisconnect: document.getElementById('btn-disconnect'),
        statusBadge: document.getElementById('serial-status'),
        btnLoad: document.getElementById('btn-load'),
        btnSend: document.getElementById('btn-send'),
        shiftLevelSelector: document.getElementById('shift-level-selector'),
        matrixContainer: document.getElementById('matrix-container'),
        shiftFunctionContainer: document.getElementById('shift-function-container'),
        logConsole: document.getElementById('log-console'),
        btnClearLog: document.getElementById('btn-clear-log'),
        btnSetAll: document.getElementById('btn-set-all'),
        btnClearAll: document.getElementById('btn-clear-all'),
        btnRandomFill: document.getElementById('btn-random-fill'),
    };

    // ============================================================
    // Utility Functions
    // ============================================================
    function createDefaultConfig() {
        const size = 16;
        const createMatrix = () => Array(size).fill(null).map(() => Array(size).fill(false));
        return {
            version: 1,
            size: size,
            shiftFunctionID: Array(size).fill(0),
            normal: createMatrix(),
            shift1: createMatrix(),
            shift2: createMatrix(),
            shift3: createMatrix(),
        };
    }

    function log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.innerHTML = `<strong>[${timestamp}]</strong> <span class="log-${type}">${message}</span>`;
        ui.logConsole.appendChild(line);
        ui.logConsole.scrollTop = ui.logConsole.scrollHeight;
    }

    function updateConnectionStatus(connected) {
        state.serial.connected = connected;
        if (connected) {
            ui.statusBadge.textContent = 'Verbunden';
            ui.statusBadge.className = 'status-badge status-connected';
            ui.btnConnect.disabled = true;
            ui.btnDisconnect.disabled = false;
            ui.btnLoad.disabled = false;
            ui.btnSend.disabled = false;
            ui.viewConnect.classList.remove('active');
            ui.viewMain.classList.add('active');
        } else {
            ui.statusBadge.textContent = 'Nicht verbunden';
            ui.statusBadge.className = 'status-badge status-disconnected';
            ui.btnConnect.disabled = false;
            ui.btnDisconnect.disabled = true;
            ui.btnLoad.disabled = true;
            ui.btnSend.disabled = true;
            ui.viewMain.classList.remove('active');
            ui.viewConnect.classList.add('active');
        }
    }

    // ============================================================
    // UI Initialization & Rendering
    // ============================================================

    function initMatrix() {
        ui.matrixContainer.innerHTML = ''; // Clear previous
        // Top labels (IN1..IN16)
        ui.matrixContainer.appendChild(document.createElement('div')); // Top-left corner
        for (let i = 1; i <= 16; i++) {
            const label = document.createElement('div');
            label.className = 'matrix-label';
            label.textContent = `IN${i}`;
            ui.matrixContainer.appendChild(label);
        }
        // Side labels and cells
        for (let row = 0; row < 16; row++) {
            const label = document.createElement('div');
            label.className = 'matrix-label';
            label.textContent = `OUT${row + 1}`;
            ui.matrixContainer.appendChild(label);
            for (let col = 0; col < 16; col++) {
                const cell = document.createElement('div');
                cell.className = 'matrix-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                ui.matrixContainer.appendChild(cell);
            }
        }
    }

    function initShiftFunctions() {
        ui.shiftFunctionContainer.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const item = document.createElement('div');
            item.className = 'shift-input-item';
            item.innerHTML = `
                <label for="shift-in-${i}">Input ${i + 1}</label>
                <select id="shift-in-${i}" data-input-index="${i}">
                    <option value="0">Normal</option>
                    <option value="1">Shift 1</option>
                    <option value="2">Shift 2</option>
                    <option value="3">Shift 3</option>
                </select>
            `;
            ui.shiftFunctionContainer.appendChild(item);
        }
    }

    function renderMatrixForCurrentLevel() {
        const levelData = state.config[state.ui.currentLevel];
        if (!levelData) return;

        const cells = ui.matrixContainer.querySelectorAll('.matrix-cell');
        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row, 10);
            const col = parseInt(cell.dataset.col, 10);
            const isActive = levelData[row][col];
            cell.classList.toggle('on', isActive);
            cell.classList.toggle('off', !isActive);
            cell.textContent = isActive ? '✔' : '✖';
        });
    }

    function renderShiftFunctions() {
        for (let i = 0; i < 16; i++) {
            const select = document.getElementById(`shift-in-${i}`);
            if (select) {
                select.value = state.config.shiftFunctionID[i];
            }
        }
    }

    function applyConfigToUI(config) {
        if (!config || config.size !== 16) {
            log('Fehler: Ungültige Konfiguration vom Gerät empfangen.', 'rx');
            return;
        }
        state.config = config;
        renderMatrixForCurrentLevel();
        renderShiftFunctions();
        log('Konfiguration erfolgreich geladen und angewendet.', 'info');
    }

    // ============================================================
    // Event Handlers
    // ============================================================

    ui.btnConnect.addEventListener('click', connectSerial);
    ui.btnDisconnect.addEventListener('click', disconnectSerial);
    ui.btnLoad.addEventListener('click', () => sendLine('GETCFG'));
    ui.btnSend.addEventListener('click', sendConfigToDevice);
    ui.btnClearLog.addEventListener('click', () => ui.logConsole.innerHTML = '');

    ui.shiftLevelSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            ui.shiftLevelSelector.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            state.ui.currentLevel = e.target.dataset.level;
            renderMatrixForCurrentLevel();
        }
    });

    ui.matrixContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('matrix-cell')) {
            const row = parseInt(e.target.dataset.row, 10);
            const col = parseInt(e.target.dataset.col, 10);
            const levelData = state.config[state.ui.currentLevel];
            levelData[row][col] = !levelData[row][col];
            renderMatrixForCurrentLevel();
        }
    });

    ui.shiftFunctionContainer.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
            const index = parseInt(e.target.dataset.inputIndex, 10);
            const value = parseInt(e.target.value, 10);
            state.config.shiftFunctionID[index] = value;
        }
    });
    
    ui.btnSetAll.addEventListener('click', () => updateMatrixAll(true));
    ui.btnClearAll.addEventListener('click', () => updateMatrixAll(false));
    ui.btnRandomFill.addEventListener('click', () => {
        const levelData = state.config[state.ui.currentLevel];
        for (let r = 0; r < 16; r++) {
            for (let c = 0; c < 16; c++) {
                levelData[r][c] = Math.random() > 0.5;
            }
        }
        renderMatrixForCurrentLevel();
    });
    
    function updateMatrixAll(value) {
        const levelData = state.config[state.ui.currentLevel];
        for (let r = 0; r < 16; r++) {
            for (let c = 0; c < 16; c++) {
                levelData[r][c] = value;
            }
        }
        renderMatrixForCurrentLevel();
    }


    // ============================================================
    // Web Serial API Logic
    // ============================================================

    async function connectSerial() {
        if (!('serial' in navigator)) {
            alert('Web Serial API wird von diesem Browser nicht unterstützt. Bitte nutze Chrome oder Edge.');
            return;
        }
        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });
            state.serial.port = port;

            // Setup reader/writer streams
            const textEncoder = new TextEncoderStream();
            state.serial.writer = textEncoder.writable.getWriter();
            const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
            
            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            state.serial.reader = textDecoder.readable.getReader();

            updateConnectionStatus(true);
            log('Serielle Verbindung erfolgreich hergestellt.', 'info');
            
            // Automatically request config after connecting
            setTimeout(() => sendLine('GETCFG'), 500);

            // Start reading loop
            readLoop();

        } catch (error) {
            log(`Verbindungsfehler: ${error.message}`, 'info');
            updateConnectionStatus(false);
        }
    }

    async function disconnectSerial() {
        if (!state.serial.port) return;

        // Stop the read loop
        if (state.serial.reader) {
            try {
                await state.serial.reader.cancel();
            } catch (error) {
                // Ignore cancel error
            }
        }
        
        if (state.serial.writer) {
            try {
                 await state.serial.writer.close();
            } catch (error) {
                // Ignore close error
            }
        }
        
        try {
            await state.serial.port.close();
        } catch(error) {
            // Ignore close error
        }

        state.serial.port = null;
        state.serial.reader = null;
        state.serial.writer = null;
        updateConnectionStatus(false);
        log('Verbindung getrennt.', 'info');
    }

    async function sendLine(line) {
        if (!state.serial.writer) {
            log('Fehler: Nicht verbunden.', 'info');
            return;
        }
        try {
            await state.serial.writer.write(line + '\n');
            log(line, 'tx');
        } catch (error) {
            log(`Sendefehler: ${error.message}`, 'info');
            disconnectSerial(); // Disconnect on write error
        }
    }
    
    function sendConfigToDevice() {
        const jsonString = JSON.stringify(state.config);
        sendLine(`SETCFG:${jsonString}`);
    }

    async function readLoop() {
        let lineBuffer = '';
        while (state.serial.port && state.serial.port.readable) {
            try {
                const { value, done } = await state.serial.reader.read();
                if (done) {
                    // Reader has been canceled.
                    break;
                }
                lineBuffer += value;
                let EOL_index;
                while ((EOL_index = lineBuffer.indexOf('\n')) >= 0) {
                    const line = lineBuffer.slice(0, EOL_index).trim();
                    lineBuffer = lineBuffer.slice(EOL_index + 1);
                    if (line) {
                        handleSerialLine(line);
                    }
                }
            } catch (error) {
                log(`Lesefehler: ${error.message}`, 'info');
                disconnectSerial();
                break;
            }
        }
    }

    function handleSerialLine(line) {
        log(line, 'rx');
        if (line.startsWith('CFG:')) {
            try {
                const jsonPart = line.substring(4);
                const receivedConfig = JSON.parse(jsonPart);
                applyConfigToUI(receivedConfig);
            } catch (e) {
                log(`Fehler beim Parsen der Konfiguration: ${e.message}`, 'rx');
            }
        } else if (line.startsWith('OK')) {
            log('Gerät hat die Konfiguration bestätigt.', 'rx');
        }
        // Other messages are just logged
    }
    
    /*
    MCU PSEUDO-CODE / PROTOCOL DOCUMENTATION
    
    void handleSerial() {
      if (Serial.available() > 0) {
        String line = Serial.readStringUntil('\n');
        line.trim();

        if (line.equals("GETCFG")) {
          // 1. Read config struct from EEPROM
          // 2. Serialize struct to a JSON string (e.g., using ArduinoJson)
          // 3. Send back via Serial:
          Serial.print("CFG:");
          Serial.println(jsonString);
        }
        else if (line.startsWith("SETCFG:")) {
          // 1. Extract JSON part from the line
          String jsonPart = line.substring(7);
          // 2. Deserialize JSON into the config struct (e.g., using ArduinoJson)
          // 3. Write the new struct to EEPROM
          // 4. Send confirmation
          Serial.println("OK");
        }
      }
    }
    */


    // ============================================================
    // PWA Service Worker
    // ============================================================
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(err => {
                        console.log('ServiceWorker registration failed: ', err);
                    });
            });
        }
    }

    // ============================================================
    // App Initialization
    // ============================================================
    function init() {
        initMatrix();
        initShiftFunctions();
        renderMatrixForCurrentLevel();
        renderShiftFunctions();
        registerServiceWorker();
        log('Anwendung initialisiert. Bereit zum Verbinden.', 'info');
    }

    init();
});
