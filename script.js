/* ============================================================
   Die Einzig Wahre PCB – PWA / IO-Konfigurator
   MIT SERIAL-DUMMY FÜR OFFLINE-TESTS
   ============================================================ */

const logBox = document.getElementById("debug-log");

function log(msg) {
    logBox.textContent += msg + "\n";
    logBox.scrollTop = logBox.scrollHeight;
}

/* ------------------------------------------------------------
   VIEW MANAGEMENT
------------------------------------------------------------ */
function showView(id) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(id).classList.add("active");
}

/* ------------------------------------------------------------
   GLOBAL DATA STRUCTURES
------------------------------------------------------------ */
let matrix = []; // 16×16
let isDummyMode = false;
let serialPort = null;
let serialWriter = null;
let serialReader = null;

/* ------------------------------------------------------------
   INITIALIZE MATRIX (all false)
------------------------------------------------------------ */
function initMatrix() {
    matrix = Array.from({ length: 16 }, () =>
        Array.from({ length: 16 }, () => false)
    );
}

/* ------------------------------------------------------------
   BUILD MATRIX TABLE
------------------------------------------------------------ */
function renderMatrix() {
    const tbl = document.getElementById("io-matrix");
    tbl.innerHTML = "";

    // HEAD
    let thead = "<thead><tr><th class='sticky-col'>OUT / IN</th>";
    for (let i = 1; i <= 16; i++) {
        thead += `<th>IN${i}</th>`;
    }
    thead += "</tr></thead>";

    tbl.insertAdjacentHTML("beforeend", thead);

    // BODY
    let tbody = "<tbody>";

    for (let out = 0; out < 16; out++) {
        tbody += `<tr>`;
        tbody += `<th class='sticky-col'>OUT ${out + 1}</th>`;

        for (let inp = 0; inp < 16; inp++) {
            const state = matrix[out][inp];
            tbody += `
                <td class="matrix-cell ${state ? "on" : "off"}"
                    data-out="${out}" data-in="${inp}">
                    ${state ? "✔" : "✖"}
                </td>`;
        }

        tbody += `</tr>`;
    }

    tbody += "</tbody>";
    tbl.insertAdjacentHTML("beforeend", tbody);

    /* CLICK HANDLER */
    document.querySelectorAll(".matrix-cell").forEach(cell => {
        cell.addEventListener("click", () => {
            const o = parseInt(cell.dataset.out);
            const i = parseInt(cell.dataset.in);

            matrix[o][i] = !matrix[o][i];
            renderMatrix();
        });
    });
}

/* ============================================================
   SERIAL  HANDLING
   ============================================================ */

async function connectSerial() {
    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });

        serialWriter = serialPort.writable.getWriter();
        serialReader = serialPort.readable.getReader();

        log("Serial verbunden.");
        document.getElementById("serial-status").className = "status status-ok";
        document.getElementById("serial-status").textContent = "Verbindung hergestellt.";

        showView("view-matrix");
        readSerialLoop();
    } catch (err) {
        log("Serial Fehler: " + err);
        document.getElementById("serial-status").className = "status status-error";
        document.getElementById("serial-status").textContent = "Fehler: Keine Verbindung.";
    }
}

/* ------------------------------------------------------------
   SERIAL READER LOOP
------------------------------------------------------------ */
async function readSerialLoop() {
    if (!serialReader) return;

    while (true) {
        const { value, done } = await serialReader.read();
        if (done) break;
        if (value) {
            log("ESP → " + new TextDecoder().decode(value));
        }
    }
}

/* ------------------------------------------------------------
   SEND TO ESP
------------------------------------------------------------ */
async function sendToESP(obj) {
    const json = JSON.stringify(obj) + "\n";

    if (isDummyMode) {
        log("[Dummy] → " + json);
        return;
    }

    if (!serialWriter) {
        log("Writer nicht bereit!");
        return;
    }

    await serialWriter.write(new TextEncoder().encode(json));
    log("Gesendet → " + json);
}

/* ============================================================
   DUMMY MODE
   ============================================================ */
function enableDummy() {
    isDummyMode = true;

    document.getElementById("serial-status").className = "status status-ok";
    document.getElementById("serial-status").textContent = "Dummy-Modus aktiv.";

    log("Dummy-Serial aktiviert!");

    showView("view-matrix");
}

/* ============================================================
   SAVE / CLEAR
   ============================================================ */
document.getElementById("btn-save-eeprom").addEventListener("click", () => {
    sendToESP({
        cmd: "save_matrix",
        data: matrix
    });
});

document.getElementById("btn-clear").addEventListener("click", () => {
    initMatrix();
    renderMatrix();
});

/* ============================================================
   BUTTON LISTENERS
   ============================================================ */
document.getElementById("btn-connect").addEventListener("click", connectSerial);
document.getElementById("btn-dummy").addEventListener("click", enableDummy);

/* INIT */
initMatrix();
renderMatrix();
