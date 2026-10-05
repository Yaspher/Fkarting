// ── FKarting Reaction Test · reaccion.js ─────────────────────────────────────

import {
  createGameReaccion,
  getPilotosVista,
  getVistaReaccion
} from "./connection.js";

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
const refreshGlobalHistoryBtn = document.getElementById("refreshGlobalHistoryBtn");
const globalClassificationHistory = document.getElementById("globalClassificationHistory");
const globalHistoryView = document.getElementById("globalHistoryView");
const globalHistoryTitle = document.getElementById("globalHistoryTitle");
const historyViewSwitch = document.querySelector(".history-view-switch");
const startPanel = document.querySelector(".start-panel");
const historyViewButtons = [...document.querySelectorAll(".history-view-btn")];
const duelPilotASelect = document.getElementById("duelPilotASelect");
const duelPilotBSelect = document.getElementById("duelPilotBSelect");
const duelPilotNameA = document.getElementById("duelPilotNameA");
const duelPilotNameB = document.getElementById("duelPilotNameB");
const submitDuelBtn = document.getElementById("submitDuelBtn");
const duelSaveMessage = document.getElementById("duelSaveMessage");

let state     = "idle";   // idle | countdown | go | result | false | done
let startTime = 0;
let lightTimer = null;
let goTimer    = null;
let attempts  = [];
let mode      = "training";
let historyView = "session";
let turn      = "A";
let duelA     = [];
let duelB     = [];
let pilotsLoaded = false;
let duelPilotsLoaded = false;
let isSubmitting = false;
let hasSubmitted = false;
let pilotOptions = [];

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

function selectedDuelPilots() {
  const pilotA = Number(duelPilotASelect.value);
  const pilotB = Number(duelPilotBSelect.value);

  if (!Number.isSafeInteger(pilotA) || pilotA <= 0
    || !Number.isSafeInteger(pilotB) || pilotB <= 0
    || pilotA === pilotB) {
    return null;
  }

  return { pilotA, pilotB };
}

function updateDuelNames() {
  duelPilotNameA.textContent =
    duelPilotASelect.selectedOptions[0]?.textContent || "SELECCIONA PILOTO";
  duelPilotNameB.textContent =
    duelPilotBSelect.selectedOptions[0]?.textContent || "SELECCIONA PILOTO";
  if (mode === "duel" && state === "idle" && attempts.length === 0) {
    const currentPilotName = turn === "A"
      ? duelPilotNameA.textContent
      : duelPilotNameB.textContent;
    statusEl.textContent = `TURNO: PILOTO ${turn} · ${currentPilotName}`;
  }

  const pilotA = duelPilotASelect.value;
  const pilotB = duelPilotBSelect.value;
  for (const option of duelPilotASelect.options) {
    option.disabled = !!option.value && option.value === pilotB;
  }
  for (const option of duelPilotBSelect.options) {
    option.disabled = !!option.value && option.value === pilotA;
  }
}

function updateDuelControls() {
  const pairSelected = selectedDuelPilots() !== null;
  const selectionLocked = isSubmitting || hasSubmitted
    || attempts.length > 0 || state !== "idle";

  duelPilotASelect.disabled = !duelPilotsLoaded || selectionLocked;
  duelPilotBSelect.disabled = !duelPilotsLoaded || selectionLocked;
  updateDuelNames();
  submitDuelBtn.disabled = !(mode === "duel" && pairSelected
    && duelA.length >= 3 && duelB.length >= 3 && state === "done"
    && duelPilotsLoaded && !isSubmitting && !hasSubmitted);
  resetDuelBtn.disabled = isSubmitting;
}

function renderGlobalHistory(records) {
  const isDuel = mode === "duel";
  const matchingRecords = records.filter(record => record.gr_duelo_estado === isDuel);

  if (!matchingRecords.length) {
    globalClassificationHistory.className = "history-empty";
    globalClassificationHistory.textContent = isDuel
      ? "Todavía no hay duelos subidos."
      : "Todavía no hay tiempos de clasificación.";
    return;
  }

  globalClassificationHistory.className = "global-history-list";
  globalClassificationHistory.replaceChildren();

  matchingRecords.forEach(record => {
    const row = document.createElement("div");
    row.className = "global-history-row";

    const date = document.createElement("time");
    const createdAt = new Date(record.created_at);
    if (Number.isNaN(createdAt.getTime())) {
      date.textContent = "Fecha no disponible";
    } else {
      date.dateTime = createdAt.toISOString();
      date.textContent = createdAt.toLocaleString("es-DO", {
        dateStyle: "short",
        timeStyle: "short"
      });
    }

    const pilot = document.createElement("span");
    const pilotName = record.piloto_numero === null
      ? record.piloto_nombre
      : `${record.piloto_nombre} · #${record.piloto_numero}`;
    const rivalName = record.rival_numero === null
      ? record.rival_nombre || "Rival no disponible"
      : `${record.rival_nombre} · #${record.rival_numero}`;
    pilot.textContent = isDuel ? `${pilotName} vs ${rivalName}` : pilotName;

    const reaction = document.createElement("strong");
    reaction.textContent = isDuel
      ? `${record.gr_reaccion} ms · ${record.gr_rival_reaccion ?? "---"} ms`
      : `${record.gr_reaccion} ms`;

    row.append(date, pilot, reaction);
    globalClassificationHistory.append(row);
  });
}

async function loadClassificationHistory() {
  globalClassificationHistory.className = "history-empty";
  globalClassificationHistory.textContent = mode === "duel"
    ? "Cargando duelos..."
    : "Cargando tiempos de clasificación...";
  globalHistoryTitle.textContent = mode === "duel"
    ? "HISTORIAL GLOBAL DE DUELOS"
    : "HISTORIAL GLOBAL DE CLASIFICACIÓN";
  globalHistoryView.setAttribute("aria-label", mode === "duel"
    ? "Historial global de duelos"
    : "Historial global de clasificación");
  refreshGlobalHistoryBtn.disabled = true;

  try {
    const records = await getVistaReaccion();
    renderGlobalHistory(records);
  } catch (error) {
    console.error("Error al cargar el historial global de reacción:", error);
    globalClassificationHistory.className = "history-empty";
    const details = String(error?.message ?? error);
    globalClassificationHistory.textContent = details.includes("PGRST205")
      ? "La vista vista_reaccion no está configurada en Supabase. Contacta al administrador."
      : `No se pudo cargar el historial: ${details}`;
  } finally {
    refreshGlobalHistoryBtn.disabled = false;
  }
}

async function loadPilots() {
  pilotSelect.disabled = true;
  duelPilotASelect.disabled = true;
  duelPilotBSelect.disabled = true;

  try {
    pilotOptions = (await getPilotosVista()).map(pilot => {
      const id = pilot.Id;
      const name = pilot.Nombre;
      const number = pilot.Numero;

      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error("La vista vista_piloto no devolvió un identificador entero válido.");
      }
      if (typeof name !== "string" || !name.trim()) {
        throw new Error("La vista vista_piloto devolvió un registro sin nombre.");
      }

      return {
        id,
        label: number === null || number === undefined ? name : `${name} · #${number}`
      };
    });

    if (!pilotOptions.length) {
      throw new Error("La vista vista_piloto no contiene pilotos.");
    }

    for (const select of [pilotSelect, duelPilotASelect, duelPilotBSelect]) {
      select.replaceChildren(new Option("SELECCIONAR PILOTO", ""));
      select.append(...pilotOptions.map(pilot => new Option(pilot.label, pilot.id)));
    }
    pilotsLoaded = true;
    duelPilotsLoaded = true;
  } catch (error) {
    console.error("Error al cargar pilotos desde vista_piloto:", error);
    pilotSelect.replaceChildren(new Option("VISTA_PILOTO NO DISPONIBLE", ""));
    duelPilotASelect.replaceChildren(new Option("VISTA_PILOTO NO DISPONIBLE", ""));
    duelPilotBSelect.replaceChildren(new Option("VISTA_PILOTO NO DISPONIBLE", ""));
    messageEl.textContent = `No fue posible cargar pilotos desde vista_piloto: ${error?.message ?? error}`;
    duelSaveMessage.textContent = `No fue posible cargar pilotos desde vista_piloto: ${error?.message ?? error}`;
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
  updateDuelControls();
}

function resetQualifying() {
  if (mode !== "qualifying" || isSubmitting) return;

  clearTimeout(lightTimer);
  clearTimeout(goTimer);

  attempts = [];
  hasSubmitted = false;
  state = "idle";
  duelSaveMessage.textContent = "";
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

  statusEl.textContent = `TURNO: PILOTO A · ${duelPilotNameA.textContent}`;
  attemptLabel.textContent = "0 / 3";

  const scoreA = document.getElementById("scoreA");
  const scoreB = document.getElementById("scoreB");
  if (scoreA) scoreA.textContent = "---";
  if (scoreB) scoreB.textContent = "---";
  duelSaveMessage.textContent = "";
  updateDuelControls();
}

// ── Cambio de modo ────────────────────────────────────────────────────────────

document.querySelectorAll(".mode-switch .mode").forEach(btn => {
  btn.onclick = () => {
  if (isSubmitting) return;
  document.querySelectorAll(".mode-switch .mode").forEach(x => {
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
    hasSubmitted = false;
    duelSaveMessage.textContent = "";

    resetUI();
    document.getElementById("scoreA").textContent = "---";
    document.getElementById("scoreB").textContent = "---";

    const isDuel = mode === "duel";
    duelPanel.classList.toggle("hidden", !isDuel);
    duelPanel.setAttribute("aria-hidden", String(!isDuel));
    historyViewSwitch.classList.toggle("hidden", mode === "training");
    startPanel.classList.toggle("classification-mode", mode === "qualifying");

    if (mode === "training") {
      historyView = "session";
      historyViewButtons.forEach(viewButton => {
        const isSession = viewButton.dataset.historyView === "session";
        viewButton.classList.toggle("active", isSession);
        viewButton.setAttribute("aria-pressed", String(isSession));
      });
      historyEl.classList.remove("hidden");
      globalHistoryView.classList.add("hidden");
    } else if (historyView === "global") {
      loadClassificationHistory();
    }

    attemptLabel.textContent = mode === "training" ? "0 / ∞" : "0 / 3";
    updateModeActions();

  };
});

historyViewButtons.forEach(button => {
  button.addEventListener("click", () => {
    historyView = button.dataset.historyView;
    historyViewButtons.forEach(viewButton => {
      const isActive = viewButton === button;
      viewButton.classList.toggle("active", isActive);
      viewButton.setAttribute("aria-pressed", String(isActive));
    });

    const showGlobal = historyView === "global";
    historyEl.classList.toggle("hidden", showGlobal);
    globalHistoryView.classList.toggle("hidden", !showGlobal);
    if (showGlobal) loadClassificationHistory();
  });
});

// ── Reset completo de la UI ───────────────────────────────────────────────────

function resetUI() {
  clearTimeout(lightTimer);
  clearTimeout(goTimer);

  state = "idle";
  lights.forEach(x => x.className = "light");
  const currentPilotName = turn === "A"
    ? duelPilotNameA.textContent
    : duelPilotNameB.textContent;
  statusEl.textContent = mode === "duel"
    ? `TURNO: PILOTO ${turn} · ${currentPilotName}`
    : "PRESIONA INICIAR";
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

  if (mode === "duel" && !selectedDuelPilots()) {
    messageEl.textContent = "Selecciona dos pilotos diferentes para iniciar el duelo.";
    return;
  }

  state = "countdown";
  startBtn.disabled = true;
  reactBtn.disabled = false;
  updateModeActions();
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
        bestA < bestB ? `🏆 GANA ${duelPilotNameA.textContent}` :
        bestB < bestA ? `🏆 GANA ${duelPilotNameB.textContent}` :
                        "EMPATE";

      startBtn.disabled = true;
      reactBtn.disabled = true;

      document.getElementById("scoreA").textContent = format(bestA);
      document.getElementById("scoreB").textContent = format(bestB);
      updateModeActions();
      return;
    }

    document.getElementById("scoreA").textContent = duelA.length ? format(Math.min(...duelA)) : "---";
    document.getElementById("scoreB").textContent = duelB.length ? format(Math.min(...duelB)) : "---";
  }

  // Siguiente intento disponible.
  startBtn.disabled = false;
  state = "idle";

  if (mode === "duel") {
    const currentPilotName = turn === "A"
      ? duelPilotNameA.textContent
      : duelPilotNameB.textContent;
    statusEl.textContent = `TURNO: PILOTO ${turn} · ${currentPilotName}`;
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

function handleDuelPilotChange(changedSelect, otherSelect) {
  if (changedSelect.value && changedSelect.value === otherSelect.value) {
    otherSelect.value = "";
    duelSaveMessage.textContent = "Elige dos pilotos diferentes para el duelo.";
  } else {
    duelSaveMessage.textContent = "";
  }

  updateModeActions();
}

duelPilotASelect.onchange = () =>
  handleDuelPilotChange(duelPilotASelect, duelPilotBSelect);
duelPilotBSelect.onchange = () =>
  handleDuelPilotChange(duelPilotBSelect, duelPilotASelect);

refreshGlobalHistoryBtn.onclick = loadClassificationHistory;

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
      if (historyView === "global" && mode === "qualifying") await loadClassificationHistory();
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

submitDuelBtn.onclick = async () => {
  if (mode !== "duel" || isSubmitting || hasSubmitted) return;

  const selectedPilots = selectedDuelPilots();
  const bestA = duelA.length >= 3 ? Math.min(...duelA) : null;
  const bestB = duelB.length >= 3 ? Math.min(...duelB) : null;

  if (!selectedPilots || bestA === null || bestB === null || state !== "done") {
    duelSaveMessage.textContent =
      "Completa los 3 intentos válidos de ambos pilotos y selecciona dos pilotos diferentes.";
    return;
  }

  isSubmitting = true;
  submitDuelBtn.textContent = "SUBIENDO...";
  duelSaveMessage.textContent = "Guardando los mejores tiempos del duelo...";
  updateModeActions();

  try {
    await createGameReaccion({
      piloto: selectedPilots.pilotA,
      reaccion: bestA,
      duelo: true,
      rival: selectedPilots.pilotB,
      rivalReaccion: bestB
    });
    hasSubmitted = true;
    duelSaveMessage.textContent =
      `DUELO GUARDADO · ${duelPilotNameA.textContent}: ${bestA} ms · ${duelPilotNameB.textContent}: ${bestB} ms`;
    if (historyView === "global") await loadClassificationHistory();
  } catch (error) {
    console.error("Error al guardar resultado de duelo:", error);
    duelSaveMessage.textContent = `No se pudo guardar el duelo: ${error?.message ?? error}`;
  } finally {
    isSubmitting = false;
    submitDuelBtn.textContent = "SUBIR MEJORES TIEMPOS";
    updateModeActions();
  }
};

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
