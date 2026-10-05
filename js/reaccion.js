// ── FKarting Reaction Test · reaccion.js ─────────────────────────────────────

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

// Controles añadidos en la versión HTML/CSS anterior.
const classificationActions = document.getElementById("classificationActions");
const resetQualifyingBtn    = document.getElementById("resetQualifyingBtn");
const pilotSelect           = document.getElementById("pilotSelect");
const submitBestBtn         = document.getElementById("submitBestBtn");
const resetDuelBtn          = document.getElementById("resetDuelBtn");

let state     = "idle";   // idle | countdown | go | result | false | done
let startTime = 0;
let lightTimer = null;
let goTimer    = null;
let attempts  = [];
let mode      = "training";
let turn      = "A";
let duelA     = [];
let duelB     = [];

// En duelo, guardamos el piloto responsable de cada intento para que una
// salida falsa no altere el turno ni el historial visual.
let duelAttemptPilots = [];

// ── Utilidades ────────────────────────────────────────────────────────────────

function format(ms) {
  if (ms === null || ms === undefined || !isFinite(ms)) return "---";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor(ms / 1000) % 60;
  const millis  = ms % 1000;

  return minutes > 0
    ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
    : `${ms} ms`;
}

function validCount() {
  return attempts.filter(x => x !== null).length;
}

function bestAttempt() {
  const valid = attempts.filter(x => x !== null && isFinite(x));
  return valid.length ? Math.min(...valid) : null;
}

// ── Acciones de modo ──────────────────────────────────────────────────────────

function updateModeActions() {
  const isQualifying = mode === "qualifying";
  const hasBest = bestAttempt() !== null;
  const hasPilot = !!pilotSelect?.value;
  const complete = validCount() >= 3;

  if (classificationActions) {
    classificationActions.classList.toggle("is-visible", isQualifying);
  }

  if (submitBestBtn) {
    // El envío queda habilitado sólo cuando existe un mejor resultado,
    // hay piloto seleccionado y la serie de clasificación está completa.
    submitBestBtn.disabled = !(isQualifying && hasBest && hasPilot && complete);
  }
}

function resetQualifying() {
  if (mode !== "qualifying") return;

  clearTimeout(lightTimer);
  clearTimeout(goTimer);

  attempts = [];
  state = "idle";
  resetUI();

  statusEl.textContent = "CLASIFICACIÓN REINICIADA";
  messageEl.textContent = "Listo para una nueva serie de 3 intentos válidos.";
  attemptLabel.textContent = "0 / 3";

  if (pilotSelect) pilotSelect.value = "";
  updateModeActions();
}

function resetDuel() {
  if (mode !== "duel") return;

  clearTimeout(lightTimer);
  clearTimeout(goTimer);

  attempts = [];
  duelA = [];
  duelB = [];
  duelAttemptPilots = [];
  turn = "A";

  state = "idle";
  resetUI();

  statusEl.textContent = "TURNO: PILOTO A";
  attemptLabel.textContent = "0 / 3";

  const scoreA = document.getElementById("scoreA");
  const scoreB = document.getElementById("scoreB");
  if (scoreA) scoreA.textContent = "---";
  if (scoreB) scoreB.textContent = "---";
}

// ── Cambio de modo ────────────────────────────────────────────────────────────

document.querySelectorAll(".mode").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".mode").forEach(x => {
      x.classList.remove("active");
      x.setAttribute("aria-pressed", "false");
    });

    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");

    mode = btn.dataset.mode;
    attempts = [];
    duelA = [];
    duelB = [];
    duelAttemptPilots = [];
    turn = "A";

    resetUI();

    const isDuel = mode === "duel";
    duelPanel.classList.toggle("hidden", !isDuel);
    duelPanel.setAttribute("aria-hidden", String(!isDuel));

    attemptLabel.textContent = mode === "training" ? "0 / ∞" : "0 / 3";
    updateModeActions();
  };
});

// ── Reset completo de la UI ───────────────────────────────────────────────────

function resetUI() {
  clearTimeout(lightTimer);
  clearTimeout(goTimer);

  state = "idle";
  lights.forEach(x => x.className = "light");
  statusEl.textContent  = mode === "duel" ? `TURNO: PILOTO ${turn}` : "PRESIONA INICIAR";
  startBtn.disabled     = false;
  reactBtn.disabled     = true;
  timeEl.textContent    = "---";
  messageEl.textContent = "Tu reacción aparecerá aquí";

  if (mode === "training") {
    attemptLabel.textContent = `${attempts.length} / ∞`;
  } else {
    attemptLabel.textContent = `${Math.min(validCount(), 3)} / 3`;
  }

  const best = bestAttempt();
  bestEl.textContent = best === null ? "---" : format(best);

  renderHistory();
  updateModeActions();
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
      lightTimer = setTimeout(step, 420);
    } else {
      goTimer = setTimeout(go, 700 + Math.random() * 2300);
    }
  };

  step();
}

function go() {
  if (state !== "countdown") return;

  state = "go";
  lights.forEach(x => x.className = "light go");
  statusEl.textContent = "¡FUERA!";
  startTime = performance.now();
}

// ── Reacción del jugador ──────────────────────────────────────────────────────

function react() {
  if (state === "idle" || state === "result" || state === "done") return;

  if (state === "countdown") {
    clearTimeout(lightTimer);
    clearTimeout(goTimer);

    state = "false";
    lights.forEach(x => x.className = "light yellow");
    statusEl.textContent = "¡SALIDA FALSA!";
    reactBtn.disabled = true;
    messageEl.textContent = "Pulsaste antes de la señal. Intento invalidado.";
    addResult(null, true);
    return;
  }

  if (state === "go") {
    const ms = Math.round(performance.now() - startTime);

    state = "result";
    reactBtn.disabled = true;
    lights.forEach(x => x.className = "light");
    statusEl.textContent = "REACCIÓN REGISTRADA";
    timeEl.textContent = format(ms);
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

  if (mode === "duel") {
    duelAttemptPilots.push(turn);

    if (ms !== null) {
      (turn === "A" ? duelA : duelB).push(ms);
    }
  }

  renderHistory();

  const vCount = validCount();
  attemptLabel.textContent = mode === "training"
    ? `${attempts.length} / ∞`
    : `${Math.min(vCount, 3)} / 3`;

  const best = bestAttempt();
  bestEl.textContent = best === null ? "---" : format(best);

  // ── Fin de clasificación ────────────────────────────────────────────────
  if (mode === "qualifying" && vCount >= 3) {
    state = "done";
    statusEl.textContent = "SERIE COMPLETADA";
    startBtn.disabled = true;
    reactBtn.disabled = true;
    updateModeActions();
    return;
  }

  // ── Lógica de duelo ──────────────────────────────────────────────────────
  if (mode === "duel") {
    const validA = duelA.length;
    const validB = duelB.length;

    // Una salida falsa no consume el turno: el mismo piloto vuelve a intentar.
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

    document.getElementById("scoreA").textContent = duelA.length ? format(Math.min(...duelA)) : "---";
    document.getElementById("scoreB").textContent = duelB.length ? format(Math.min(...duelB)) : "---";
  }

  // Siguiente intento disponible.
  startBtn.disabled = false;
  state = "idle";

  if (mode === "duel") {
    statusEl.textContent = `TURNO: PILOTO ${turn}`;
  }

  updateModeActions();
}

// ── Historial ─────────────────────────────────────────────────────────────────

function renderHistory() {
  if (!attempts.length) {
    historyEl.className = "history-empty";
    historyEl.textContent = "Todavía no hay intentos.";
    return;
  }

  historyEl.className = "";

  historyEl.innerHTML = attempts.map((x, i) => {
    const pilotLabel = mode === "duel"
      ? `PILOTO ${duelAttemptPilots[i] || "A"}`
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

// ── Eventos de controles ──────────────────────────────────────────────────────

startBtn.onclick = start;
reactBtn.onclick = react;

if (resetQualifyingBtn) {
  resetQualifyingBtn.onclick = resetQualifying;
}

if (resetDuelBtn) {
  resetDuelBtn.onclick = resetDuel;
}

if (pilotSelect) {
  pilotSelect.onchange = () => {
    updateModeActions();
  };
}

if (submitBestBtn) {
  submitBestBtn.onclick = () => {
    if (mode !== "qualifying") return;

    const best = bestAttempt();
    const pilotId = pilotSelect?.value || "";
    const pilotName = pilotSelect?.selectedOptions?.[0]?.textContent || "";

    if (validCount() < 3 || best === null) {
      messageEl.textContent = "Completa los 3 intentos válidos antes de enviar el mejor resultado.";
      return;
    }

    if (!pilotId) {
      messageEl.textContent = "Selecciona un piloto antes de enviar el resultado.";
      return;
    }

    // Preparado para la futura integración con Supabase.
    // Por ahora no se escribe en la base de datos porque este archivo aún no
    // tiene conexión/configuración de Supabase.
    const payload = {
      piloto: pilotId,
      piloto_nombre: pilotName,
      reaccion_ms: best
    };

    console.log("FKarting · mejor resultado listo para enviar:", payload);
    messageEl.textContent = `MEJOR RESULTADO PREPARADO · ${pilotName} · ${best} ms`;
  };
}

document.addEventListener("keydown", e => {
  if (e.code !== "Space") return;

  e.preventDefault();
  if (e.repeat) return;

  if (state === "idle") {
    startBtn.click();
    return;
  }

  if (state === "countdown" || state === "go") {
    react();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

resetUI();
