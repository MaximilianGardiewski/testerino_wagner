/* ============================================================
   State
   ============================================================ */

const state = {
    serial: {
        port: null,
        reader: null,
        writer: null,
        isConnected: false,
    },
    ui: {
        currentLevel: "normal", // normal | shift1 | shift2 | shift3
    },
    config: {
        version: 1,
        size: 16,
        shiftFunctionID: new Array(16).fill(0),
        normal: Array.from({
            length: 16
        }, () => new Array(16).fill(false)),
        shift1: Array.from({
            length: 16
        }, () => new Array(16).fill(false)),
        shift2: Array.from({
            length: 16
        }, () => new Array(16).fill(false)),
        shift3: Array.from({
            length: 16
        }, () => new Array(16).fill(false)),
    }
};

/* ============================================================
   UI Elements
   ============================================================ */

const ui = {
    viewConnect: document.getElementById('view-connect'),
    viewMain: document.getElementById('view-main'),
    btnConnect: document.getElementById("btn-connect"),
    btnDisconnect: document.getElementById("btn-disconnect"),
    btnLoad: document.getElementById("btn-load"),
    btnSend: document.getElementById("btn-send"),
    btnClearLog: document.getElementById("btn-clear-log"),
    statusBadge: document.getElementById("serial-status"),
    matrixContainer: document.getElementById("matrix-container"),
    shiftLevelSelector: document.getElementById("shift-level-selector"),
    shiftFunctionContainer: document.getElementById("shift-function-container"),
    logConsole: document.getElementById("log-console"),
};

/* ============================================================
   Logging
   ============================================================ */

function log(message, type = "info") {
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.innerHTML = `<strong>[${time}]</strong> <span class="log-${type}">${message}</span>`;
    ui.logConsole.appendChild(line);
    ui.logConsole.scrollTop = ui.logConsole.scrollHeight;
}

/* ============================================================
   UI Updates
   ============================================================ */

function updateConnectionStatus(isConnected) {
    state.serial.isConnected = isConnected;
    if (isConnected) {
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

/* ============================================================
   Matrix Rendering
   ============================================================ */

function renderMatrixForCurrentLevel() {
    const level = state.ui.currentLevel;
    const layer = state.config[level];

    ui.matrixContainer.innerHTML = ""; // Clear previous

    // Add top labels (IN1...IN16)
    const topLabelRow = document.createElement('div');
    topLabelRow.className = 'matrix-label-row';
    topLabelRow.appendChild(document.createElement('div')); // Top-left corner
    for (let i = 1; i <= 16; i++) {
        const label = document.createElement('div');
        label.className = 'matrix-label';
        label.textContent = `IN${i}`;
        topLabelRow.appendChild(label);
    }
    ui.matrixContainer.appendChild(topLabelRow);


    for (let row = 0; row < 16; row++) {
        const rowDiv = document.createElement("div");
        rowDiv.className = "matrix-row";

        // Add side label
        const sideLabel = document.createElement('div');
        sideLabel.className = 'matrix-label';
        sideLabel.textContent = `OUT${row + 1}`;
        rowDiv.appendChild(sideLabel);

        for (let col = 0; col < 16; col++) {
            const cell = document.createElement("button");
            cell.className = "matrix-cell " + (layer[row][col] ? "on" : "off");
            cell.textContent = layer[row][col] ? "✔" : "✖";
            cell.dataset.row = row;
            cell.dataset.col = col;

            cell.addEventListener("click", () => {
                layer[row][col] = !layer[row][col];
                renderMatrixForCurrentLevel();
            });

            rowDiv.appendChild(cell);
        }
        ui.matrixContainer.appendChild(rowDiv);
    }
}

/* ============================================================
   Shift Configuration UI
   ============================================================ */

function renderShiftConfig() {
    ui.shiftFunctionContainer.innerHTML = "";

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
        const select = item.querySelector('select');
        select.value = state.config.shiftFunctionID[i];

        select.addEventListener("change", () => {
            state.config.shiftFunctionID[i] = parseInt(select.value);
        });

        ui.shiftFunctionContainer.appendChild(item);
    }
}

/* ============================================================
   Event Setup
   ============================================================ */

function setupEventListeners() {
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
}

/* ============================================================
   Serial Communication (Real)
   ============================================================ */

async function connectSerial() {
    try {
        if (!("serial" in navigator)) {
            log("Web Serial nicht unterstützt.", 'info');
            return;
        }

        state.serial.port = await navigator.serial.requestPort();
        await state.serial.port.open({
            baudRate: 115200
        });

        const textDecoder = new TextDecoderStream();
        state.serial.port.readable.pipeTo(textDecoder.writable);
        state.serial.reader = textDecoder.readable.getReader();

        const textEncoder = new TextEncoderStream();
        textEncoder.readable.pipeTo(state.serial.port.writable);
        state.serial.writer = textEncoder.writable.getWriter();

        updateConnectionStatus(true);
        readLoop();

    } catch (e) {
        log("Fehler: " + e.message, 'info');
    }
}

async function disconnectSerial() {
    if (state.serial.reader) {
        try {
            await state.serial.reader.cancel();
        } catch (e) {}
        state.serial.reader = null;
    }
    if (state.serial.writer) {
        try {
            await state.serial.writer.close();
        } catch (e) {}
        state.serial.writer = null;
    }
    if (state.serial.port) {
        try {
            await state.serial.port.close();
        } catch (e) {}
        state.serial.port = null;
    }

    updateConnectionStatus(false);
    log("Verbindung getrennt.", 'info');
}

async function sendLine(line) {
    if (!state.serial.writer) {
        log("Keine Verbindung.", 'info');
        return;
    }

    log(`TX: ${line}`, 'tx');
    await state.serial.writer.write(line + "\n");
}

async function readLoop() {
    let lineBuffer = '';
    while (state.serial.port && state.serial.port.readable) {
        try {
            const {
                value,
                done
            } = await state.serial.reader.read();
            if (done) break;

            lineBuffer += value;
            let eolIndex;
            while ((eolIndex = lineBuffer.indexOf('\n')) >= 0) {
                const line = lineBuffer.slice(0, eolIndex).trim();
                lineBuffer = lineBuffer.slice(eolIndex + 1);
                if (line) handleSerialLine(line);
            }
        } catch (error) {
            log(`Lesefehler: ${error.message}`, 'info');
            break;
        }
    }
    disconnectSerial();
}

function handleSerialLine(line) {
    log(`RX: ${line}`, 'rx');

    if (line.startsWith("CFG:")) {
        try {
            const json = line.substring(4);
            const obj = JSON.parse(json);
            state.config = obj;
            applyConfigStateToUI();
        } catch (e) {
            log("JSON Parsing Error: " + e.message, 'rx');
        }
    } else if (line.startsWith("OK")) {
        log("Konfiguration vom Gerät bestätigt.", 'rx');
    }
}

/* ============================================================
   Sync UI & Config
   ============================================================ */

function applyConfigStateToUI() {
    renderMatrixForCurrentLevel();
    renderShiftConfig();
}

/* ============================================================
   Send Config
   ============================================================ */

function sendConfigToDevice() {
    const json = JSON.stringify(state.config);
    sendLine("SETCFG:" + json);
}

/* ============================================================
   Init
   ============================================================ */
function init() {
    setupEventListeners();
    applyConfigStateToUI();
    log("Anwendung initialisiert.", 'info');
}

init();
