// ── FKarting Reaction Test · reaccion.js ─────────────────────────────────────

import { createGameReaccion, getPilotosActivosAdmin } from "./connection.js";

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
let pilotsLoaded = false;
let isSubmitting = false;
let hasSubmitted = false;

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

async function loadPilots() {
  pilotSelect.disabled = true;

  try {
    const pilots = await getPilotosActivosAdmin();
    const options = pilots.map(pilot => {
      const id = pilot.id_piloto;
      const name = pilot.pilo_nombre;
      const number = pilot.pilo_numero;

      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error("La tabla de pilotos no devolvió un identificador entero válido.");
      }
      if (typeof name !== "string" || !name.trim()) {
        throw new Error("La tabla de pilotos devolvió un registro sin nombre.");
      }

      return {
        id,
        label: number === null || number === undefined ? name : `${name} · #${number}`
      };
    });

    if (!options.length) {
      throw new Error("No hay pilotos disponibles para seleccionar.");
    }

    pilotSelect.replaceChildren(
      new Option("SELECCIONAR PILOTO", ""),
      ...options.map(pilot => new Option(pilot.label, pilot.id))
    );
    pilotsLoaded = true;
  } catch (error) {
    console.error("Error al cargar pilotos para Reaction Test:", error);
    pilotSelect.replaceChildren(new Option("NO SE PUDIERON CARGAR PILOTOS", ""));
    messageEl.textContent = `No fue posible cargar los pilotos: ${error?.message ?? error}`;
  }

  updateModeActions();
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
    submitBestBtn.disabled = !(isQualifying && hasBest && hasPilot && complete
      && pilotsLoaded && !isSubmitting && !hasSubmitted);
  }
  pilotSelect.disabled = !pilotsLoaded || isSubmitting || hasSubmitted;
}

function resetQualifying() {
  if (mode !== "qualifying" || isSubmitting) return;

  clearTimeout(lightTimer);
  clearTimeout(goTimer);

  attempts = [];
  hasSubmitted = false;
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
  hasSubmitted = false;
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
  submitBestBtn.onclick = async () => {
    if (mode !== "qualifying" || isSubmitting || hasSubmitted) return;

    const best = bestAttempt();
    const pilotId = pilotSelect?.value || "";
    const pilotName = pilotSelect?.selectedOptions?.[0]?.textContent?.trim() || "";

    if (validCount() < 3 || best === null) {
      messageEl.textContent = "Completa los 3 intentos válidos antes de enviar el mejor resultado.";
      return;
    }

    if (!pilotId) {
      messageEl.textContent = "Selecciona un piloto antes de enviar el resultado.";
      return;
    }
    const pilotIdNumber = Number(pilotId);
    if (!Number.isSafeInteger(pilotIdNumber) || pilotIdNumber <= 0) {
      messageEl.textContent = "El piloto seleccionado no tiene un identificador válido.";
      return;
    }

    isSubmitting = true;
    submitBestBtn.textContent = "ENVIANDO...";
    messageEl.textContent = "Guardando el mejor resultado...";
    updateModeActions();

    try {
      await createGameReaccion({ piloto: pilotIdNumber, reaccion: best });
      hasSubmitted = true;
      messageEl.textContent = `MEJOR RESULTADO GUARDADO · ${pilotName} · ${best} ms`;
    } catch (error) {
      console.error("Error al guardar resultado de Reaction Test:", error);
      messageEl.textContent = `No se pudo guardar el resultado: ${error?.message ?? error}`;
    } finally {
      isSubmitting = false;
      submitBestBtn.textContent = "ENVIAR MEJOR";
      updateModeActions();
    }
  };
}

const hamburger = document.getElementById("hamburger");
const navMobile = document.getElementById("navMobile");

hamburger.addEventListener("click", () => {
  const isOpen = hamburger.classList.toggle("open");
  navMobile.classList.toggle("open", isOpen);
  hamburger.setAttribute("aria-expanded", String(isOpen));
  hamburger.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
});

navMobile.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    hamburger.classList.remove("open");
    navMobile.classList.remove("open");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "Abrir menú");
  });
});

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
loadPilots();
