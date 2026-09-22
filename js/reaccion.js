// ── FKarting Reaction Test · app.js ──────────────────────────────────────────

const lights       = [...document.querySelectorAll(".light")];
const startBtn     = document.getElementById("startBtn");
const reactBtn     = document.getElementById("reactBtn");
const statusEl     = document.getElementById("status");
const timeEl       = document.getElementById("time");
const messageEl    = document.getElementById("resultMessage");
const historyEl    = document.getElementById("history");
const attemptLabel = document.getElementById("attemptLabel");
const bestEl       = document.getElementById("best");
const duelPanel    = document.getElementById("duelPanel");

let state     = "idle";   // "idle" | "countdown" | "go" | "result" | "false" | "done"
let startTime = 0;
let lightTimer = null;   // BUG-FIX 1&2: timers separados para poder cancelar
let goTimer    = null;   //   independientemente el countdown y el go().
let attempts  = [];
let mode      = "training";
let turn      = "A";
let duelA     = [];
let duelB     = [];

// ── Utilidades ────────────────────────────────────────────────────────────────

// BUG-FIX 5: guard para Infinity / undefined que producía "Infinity ms"
function format(ms) {
  if (ms === null || ms === undefined || !isFinite(ms)) return "---";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor(ms / 1000) % 60;
  const millis  = ms % 1000;
  return minutes > 0
    ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
    : `${ms} ms`;
}

// BUG-FIX 3&4: contar sólo intentos VÁLIDOS para el límite de qualifying/duel
function validCount() {
  return attempts.filter(x => x !== null).length;
}

// ── Cambio de modo ────────────────────────────────────────────────────────────

document.querySelectorAll(".mode").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".mode").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    mode     = btn.dataset.mode;
    attempts = [];
    duelA    = [];
    duelB    = [];
    turn     = "A";
    resetUI();
    duelPanel.classList.toggle("hidden", mode !== "duel");
    attemptLabel.textContent = mode === "training" ? "0 / ∞" : "0 / 3";
  };
});

// ── Reset completo de la UI ───────────────────────────────────────────────────

function resetUI() {
  // BUG-FIX 1&2: cancelar AMBOS timers al resetear
  clearTimeout(lightTimer);
  clearTimeout(goTimer);
  state = "idle";
  lights.forEach(x => x.className = "light");
  statusEl.textContent  = mode === "duel" ? `TURNO: PILOTO ${turn}` : "PRESIONA INICIAR";
  startBtn.disabled     = false;
  reactBtn.disabled     = true;
  timeEl.textContent    = "---";
  messageEl.textContent = "Tu reacción aparecerá aquí";
  renderHistory();
}

// ── Secuencia de semáforo ─────────────────────────────────────────────────────

function start() {
  if (state !== "idle") return;
  state = "countdown";
  startBtn.disabled = true;
  reactBtn.disabled = false;
  statusEl.textContent = "PREPÁRATE...";
  lights.forEach(x => x.className = "light");

  let i = 0;
  const step = () => {
    if (i < 5) {
      lights[i].className = "light on";
      i++;
      lightTimer = setTimeout(step, 420);   // BUG-FIX 2: usar lightTimer
    } else {
      // BUG-FIX 2: guardar el timer del go() en goTimer para poder cancelarlo
      goTimer = setTimeout(go, 700 + Math.random() * 2300);
    }
  };
  step();
}

function go() {
  if (state !== "countdown") return;   // BUG-FIX 2: ya no ejecuta si es "false"
  state = "go";
  lights.forEach(x => x.className = "light go");
  statusEl.textContent = "¡FUERA!";
  startTime = performance.now();
}

// ── Reacción del jugador ──────────────────────────────────────────────────────

function react() {
  if (state === "idle" || state === "result" || state === "done") return;

  if (state === "countdown") {
    // BUG-FIX 2: cancelar goTimer para que go() no se ejecute después
    clearTimeout(lightTimer);
    clearTimeout(goTimer);
    state = "false";
    lights.forEach(x => x.className = "light yellow");
    statusEl.textContent  = "¡SALIDA FALSA!";
    reactBtn.disabled     = true;
    messageEl.textContent = "Pulsaste antes de la señal. Intento invalidado.";
    addResult(null, true);
    return;
  }

  if (state === "go") {
    const ms = Math.round(performance.now() - startTime);
    state = "result";
    reactBtn.disabled    = true;
    lights.forEach(x => x.className = "light");
    statusEl.textContent = "REACCIÓN REGISTRADA";
    timeEl.textContent   = format(ms);
    messageEl.textContent =
      ms < 250 ? "¡SALIDA EXCELENTE!" :
      ms < 350 ? "MUY BUENA REACCIÓN" :
                 "SIGUE ENTRENANDO";
    addResult(ms, false);
  }
}

// ── Gestión de resultados ─────────────────────────────────────────────────────

function addResult(ms, fault) {
  attempts.push(ms);

  if (mode === "duel" && ms !== null) {
    (turn === "A" ? duelA : duelB).push(ms);
  }

  renderHistory();

  // BUG-FIX 3&4: usar validCount() para el límite, no attempts.length
  const vCount = validCount();
  attemptLabel.textContent = mode === "training"
    ? `${attempts.length} / ∞`
    : `${Math.min(vCount, 3)} / 3`;

  const valid = attempts.filter(x => x !== null);
  // BUG-FIX 5: valid puede estar vacío → Math.min devolvería Infinity
  bestEl.textContent = valid.length ? format(Math.min(...valid)) : "---";

  // ── Lógica de fin de modo ────────────────────────────────────────────────
  if (mode === "qualifying" && vCount >= 3) {
    state = "done";
    statusEl.textContent = "SERIE COMPLETADA";
    startBtn.disabled    = true;
    reactBtn.disabled    = true;
    return;
  }

  if (mode === "duel") {
    const validA = duelA.length;
    const validB = duelB.length;
    // BUG-FIX 3: alternar turno sólo si el intento fue válido (no false start)
    if (ms !== null) {
      turn = turn === "A" ? "B" : "A";
    }
    if (validA >= 3 && validB >= 3) {
      const bestA = Math.min(...duelA);
      const bestB = Math.min(...duelB);
      state = "done";
      statusEl.textContent =
        bestA < bestB ? "🏆 GANA PILOTO A" :
        bestB < bestA ? "🏆 GANA PILOTO B" :
                        "EMPATE";
      startBtn.disabled = true;
      reactBtn.disabled = true;
      document.getElementById("scoreA").textContent = format(bestA);
      document.getElementById("scoreB").textContent = format(bestB);
      return;
    }
    // Actualizar marcador parcial
    document.getElementById("scoreA").textContent = duelA.length ? format(Math.min(...duelA)) : "---";
    document.getElementById("scoreB").textContent = duelB.length ? format(Math.min(...duelB)) : "---";
  }

  // Siguiente intento disponible
  startBtn.disabled = false;
  // BUG-FIX 6: estado vuelve a "idle" explícitamente para la ronda siguiente
  state = "idle";
  if (mode === "duel") {
    statusEl.textContent = `TURNO: PILOTO ${turn}`;
  }
}

// ── Historial ─────────────────────────────────────────────────────────────────

function renderHistory() {
  if (!attempts.length) {
    historyEl.className   = "history-empty";
    historyEl.textContent = "Todavía no hay intentos.";
    return;
  }
  historyEl.className  = "";
  historyEl.innerHTML = attempts.map((x, i) => {
    // En duel: los turnos se asignan según ms válidos alternados, no por índice puro
    const pilotLabel = mode === "duel"
      ? `PILOTO ${i % 2 === 0 ? "A" : "B"}`
      : "INTENTO";
    return `
      <div class="history-row">
        <span>#${i + 1}</span>
        <b>${x === null ? "SALIDA FALSA" : format(x)}</b>
        <span>${pilotLabel}</span>
        <span class="${x === null ? "false" : ""}">${x === null ? "INVALIDADO" : "VÁLIDO"}</span>
      </div>`;
  }).join("");
}

// ── Eventos ───────────────────────────────────────────────────────────────────

startBtn.onclick = start;
reactBtn.onclick = react;

document.addEventListener("keydown", e => {
  if (e.code !== "Space") return;
  e.preventDefault();
  if (e.repeat) return;
  if (state === "idle") { startBtn.click(); return; }
  if (state === "countdown" || state === "go") { react(); }
});

// ── Init ──────────────────────────────────────────────────────────────────────
resetUI();