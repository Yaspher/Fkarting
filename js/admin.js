
import {
    // Dashboard
    getCampeonatoActivo, getCarrerasByCampeonatoId, getRankingTop3ByCampeonato,
    getUltimaCarreraCompletada, getResultadosTop3, getResultadosCompletos, getPilotosActivosCount,
    // Campeonatos
    getCampeonatos, getCampeonatosActivos, createCampeonato, updateCampeonato, deleteCampeonato,
    // Pilotos
    getPilotos, getPilotoById, getPilotosActivosAdmin, createPiloto, updatePiloto, deletePiloto,
    // Carreras — getCarrerasByCampeonatoId ya importada en Dashboard
    getCarrerasByCampeonato, getCarreraById,
    createCarrera, updateCarrera, deleteCarrera,
    // Resultados
    getResultadosByCarrera, createResultado, updateResultado, deleteResultado,
    // Ranking
    getRankingByCampeonato, createRanking, updateRanking, deleteRanking,
    // Puntos
    getTablaPuntos, upsertPuntosPosicion, initPuntosFila
} from './connection.js';

// ✅ AUTH GUARD — debe ir después de los imports en ES modules
if (sessionStorage.getItem("fk_admin_auth") !== "true") {
    window.location.replace("login.html");
}

// ── Alias para compatibilidad con secciones que usan getCampeonatosAdmin
const getCampeonatosAdmin = getCampeonatosActivos;


// ════════════════════════════════════════════════════════════════
//  CONSTANTES UI
// ════════════════════════════════════════════════════════════════

const iconEdit  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const iconTrash = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;

const POSICION_LABELS = ["", "🥇 1°", "🥈 2°", "🥉 3°", "4°", "5°", "6°", "7°", "8°", "9°", "10°", "11°", "12°"];

const sectionTitles = {
    dashboard:     "Panel Administrativo",
    championships: "Campeonatos",
    drivers:       "Pilotos",
    carreras:      "Carreras",
    resultados:    "Resultados",
    puntos:        "Tabla de Puntos",
    ranking:       "Ranquin"
};

// ── CONSTANTES v1.3.0 — Confirmación de Carrera ──
const POSICIONES_PARA_PUNTOS = {
    1: 15, 2: 13, 3: 11, 4: 9, 5: 7, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1,
    11: 0, 12: 0
};
const MEDALLAS = ["", "🥇", "🥈", "🥉"];

// Estado del flujo de confirmación (v1.3.0)
let estadoConfirmacion = {
    carreraId: null,
    carreraNombre: "",
    carreraFecha: "",
    carreraCircuito: "",
    campeonatoId: null,
    resultados: Array(12).fill(null).map((_, i) => ({
        posicion: i + 1,
        id_piloto: null,
        res_tiempo_seg: null,
        res_puntos: 0,
        es_vuelta_rapida: false
    }))
};


// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

function formatInterval(interval) {
    if (!interval) return "—";
    const match = String(interval).match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!match) return interval;
    const hh = parseInt(match[1]);
    const mm = parseInt(match[2]) + hh * 60;
    const ss = parseFloat(match[3]).toFixed(3);
    return `${String(mm).padStart(2, "0")}:${ss.padStart(6, "0")}`;
}

/**
 * Parser flexible de tiempo de vuelta.
 * Acepta separadores mixtos entre minutos/segundos/milisegundos
 * (":", ".", ",", ";" — cualquier combinación) y también dígitos
 * puros sin separador, ej: "123456" → 1:23.456
 *
 * Devuelve { ok, value, error } donde value es el interval Postgres
 * "00:MM:SS.mmm" listo para guardar.
 */
function parseTiempoFlexible(str) {
    str = String(str ?? "").trim();
    if (!str) return { ok: true, value: null };

    // Separa en grupos de dígitos, sin importar qué símbolo se usó de separador
    const parts = str.split(/[^\d]+/).filter(p => p.length > 0);

    let mm, ss, ms;

    if (parts.length >= 3) {
        // mm : ss . mmm  (con cualquier separador)
        [mm, ss, ms] = parts;
    } else if (parts.length === 1) {
        // Dígitos puros, ej: "123456" → mm=1, ss=23, ms=456
        const digits = parts[0];
        if (digits.length < 4) {
            return { ok: false, error: "⚠️ Tiempo incompleto. Usa M:SS.mmm (ej: 1:23.456)" };
        }
        ms = digits.slice(-3);
        let rest = digits.slice(0, -3);
        ss = rest.length >= 2 ? rest.slice(-2) : rest.padStart(2, "0");
        mm = rest.length > 2 ? rest.slice(0, -2) : "0";
    } else {
        return { ok: false, error: "⚠️ Formato incompleto. Usa M:SS.mmm (ej: 1:23.456)" };
    }

    if (!/^\d+$/.test(mm) || !/^\d+$/.test(ss) || !/^\d+$/.test(ms)) {
        return { ok: false, error: "⚠️ Formato inválido. Usa M:SS.mmm (ej: 1:23.456)" };
    }

    mm = parseInt(mm, 10);
    ss = parseInt(ss, 10);
    ms = ms.length > 3 ? ms.slice(0, 3) : ms.padEnd(3, "0");

    if (ss > 59) return { ok: false, error: "⚠️ Los segundos no pueden ser mayores a 59" };
    if (mm > 99) return { ok: false, error: "⚠️ Los minutos no pueden ser mayores a 99" };

    const value = `00:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${ms}`;
    return { ok: true, value };
}

function toInterval(str) {
    const result = parseTiempoFlexible(str);
    if (!result.ok) throw new Error(result.error.replace(/^⚠️\s*/, ""));
    if (result.value === null) throw new Error("Formato inválido. Usa MM:SS.mmm (ej: 01:12.450)");
    return result.value;
}

function intervalToSeconds(interval) {
    if (!interval) return 0;
    const match = String(interval).match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!match) return 0;
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
}

function showMsg(id, text, ms = 4000) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.textContent = "", ms);
}

function escAttr(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function setTableLoading(tbodyId, cols) {
    document.getElementById(tbodyId).innerHTML =
        `<tr><td colspan="${cols}" class="table-empty" style="opacity:.5">Cargando...</td></tr>`;
}


// ════════════════════════════════════════════════════════════════
//  NAVEGACIÓN
// ════════════════════════════════════════════════════════════════

document.querySelectorAll(".sidebar-item[data-section]").forEach(item => {
    item.addEventListener("click", () => {
        document.querySelectorAll(".sidebar-item").forEach(s => s.classList.remove("active"));
        item.classList.add("active");
        document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
        document.getElementById(item.dataset.section).classList.remove("hidden");
        document.getElementById("headerTitle").textContent = sectionTitles[item.dataset.section] || "";

        const section = item.dataset.section;
        if (section === "dashboard")     loadDashboard();
        if (section === "championships") loadChampionships();
        if (section === "drivers")       loadDrivers();
        if (section === "carreras")      loadCarrerasSection();
        if (section === "resultados")    loadResultadosSection();
        if (section === "puntos")        loadPuntosSection();
        if (section === "ranking")       loadRankingSection();
    });
});

document.getElementById("logout").onclick = (e) => {
    e.preventDefault();
    sessionStorage.removeItem("fk_admin_auth");
    window.location.href = "index.html";
};


// ════════════════════════════════════════════════════════════════
//  CONFIRMACIÓN DE CARRERA v1.3.0 — FLUJO COMPLETO
// ════════════════════════════════════════════════════════════════

/**
 * Abre modal 1: seleccionar carrera
 */
async function abrirConfirmarCarrera() {
    document.getElementById("confirmarCarreraModal").classList.remove("hidden");

    try {
        const campeonatos = await getCampeonatosActivos();
        const selCamp = document.getElementById("confirmarCarreraCampeonato");
        selCamp.innerHTML = campeonatos.length
            ? campeonatos.map(c =>
                `<option value="${c.id_campeonato}">${c.camp_ano}${c.camp_descripcion ? " — " + escAttr(c.camp_descripcion) : ""}</option>`
              ).join("")
            : `<option value="">Sin campeonatos activos</option>`;

        if (campeonatos.length) {
            await cargarCarrerasPendientes(campeonatos[0].id_campeonato);
        }
    } catch (err) {
        showMsg("saveMsgConfirmarCarrera", "❌ Error cargando campeonatos");
        console.error(err);
    }
}

/**
 * Carga carreras pendientes de un campeonato
 */
async function cargarCarrerasPendientes(id_campeonato) {
    try {
        const carreras   = await getCarrerasByCampeonato(id_campeonato);
        const pendientes = carreras.filter(c => !c.completada);
        const selCar     = document.getElementById("confirmarCarreraSelect");

        selCar.innerHTML = pendientes.length
            ? pendientes.map(c =>
                `<option value="${c.id_carrera}">${escAttr(c.nombre)}${c.fecha ? " (" + c.fecha + ")" : ""}</option>`
              ).join("")
            : `<option value="">Sin carreras pendientes</option>`;

        // Reset info
        document.getElementById("infoCircuito").textContent = "—";
        document.getElementById("infoFecha").textContent    = "—";
        document.getElementById("infoPilotos").textContent  = "—";

        if (pendientes.length) await actualizarInfoCarrera(pendientes[0].id_carrera);
    } catch (err) {
        console.error(err);
        showMsg("saveMsgConfirmarCarrera", "❌ Error cargando carreras");
    }
}

/**
 * Al seleccionar carrera, actualiza info
 */
async function actualizarInfoCarrera(id_carrera) {
    if (!id_carrera) return;

    try {
        const data    = await getCarreraById(id_carrera);
        const carrera = data[0];

        document.getElementById("infoCircuito").textContent = carrera.circuito || "—";
        document.getElementById("infoFecha").textContent = carrera.fecha
            ? new Date(carrera.fecha + "T00:00:00").toLocaleDateString("es-DO")
            : "—";

        // Nº de pilotos activos disponibles para asignar (no hay tabla de inscripciones aún)
        try {
            const pilotos = await getPilotosActivosAdmin();
            document.getElementById("infoPilotos").textContent = `${pilotos.length} disponibles`;
        } catch (err) {
            document.getElementById("infoPilotos").textContent = "—";
        }
    } catch (err) {
        console.error(err);
    }
}

/**
 * Continúa a modal 2 (ingresar resultados)
 */
async function continuarAResultados() {
    const campeonatoId = parseInt(document.getElementById("confirmarCarreraCampeonato").value);
    const carreraId    = parseInt(document.getElementById("confirmarCarreraSelect").value);

    if (!carreraId || !campeonatoId) {
        showMsg("saveMsgConfirmarCarrera", "⚠️ Selecciona carrera y campeonato");
        return;
    }

    try {
        const carreras = await getCarreraById(carreraId);
        const carrera  = carreras[0];

        resetearEstadoConfirmacion();
        estadoConfirmacion.carreraId       = carreraId;
        estadoConfirmacion.campeonatoId    = campeonatoId;
        estadoConfirmacion.carreraNombre   = carrera.nombre;
        estadoConfirmacion.carreraFecha    = carrera.fecha || "";
        estadoConfirmacion.carreraCircuito = carrera.circuito || "";

        document.getElementById("confirmarCarreraModal").classList.add("hidden");
        await abrirIngresarResultados();
    } catch (err) {
        showMsg("saveMsgConfirmarCarrera", "❌ Error al continuar");
        console.error(err);
    }
}

/**
 * Abre modal 2: ingresar resultados
 */
async function abrirIngresarResultados() {
    const modal = document.getElementById("ingresarResultadosModal");

    document.getElementById("ingresarResultadosTitle").textContent = `📊 Ingresar Resultados`;
    document.getElementById("ingresarResultadosSubtitle").textContent =
        `${estadoConfirmacion.carreraNombre}${estadoConfirmacion.carreraFecha ? " — " + estadoConfirmacion.carreraFecha : ""}`;

    let pilotos = [];
    try {
        pilotos = await getPilotosActivosAdmin();
    } catch (err) {
        console.error(err);
    }
    // Cachea la lista para vista previa (evita repetir la consulta)
    estadoConfirmacion._pilotosCache = pilotos;

    const container = document.getElementById("resultadosTable");
    container.innerHTML = estadoConfirmacion.resultados.map((res, idx) => {
        const pos     = idx + 1;
        const medalla = MEDALLAS[pos] || "";

        return `
      <div class="resultado-row" id="resultado-row-${pos}">
        <div class="resultado-row-pos">
          <span class="resultado-row-pos-medal">${medalla}</span>
          ${medalla ? "" : pos + "°"}
        </div>
        <div class="resultado-row-piloto">
          <select id="piloto-${pos}" class="resultado-piloto-select" data-pos="${pos}">
            <option value="">— Seleccionar —</option>
            ${pilotos.map(p =>
              `<option value="${p.id_piloto}">${p.pilo_numero ? "#" + p.pilo_numero + " " : ""}${escAttr(p.pilo_nombre)}</option>`
            ).join("")}
          </select>
        </div>
        <div class="resultado-row-tiempo">
          <input type="text" id="tiempo-${pos}" class="resultado-tiempo-input" placeholder="1:23.456" data-pos="${pos}">
        </div>
        <div class="resultado-row-puntos" id="puntos-${pos}">0 pts</div>
        <div class="resultado-row-vr" id="vr-${pos}"></div>
        <div class="resultado-row-error-msg" id="error-${pos}"></div>
      </div>
    `;
    }).join("");

    document.querySelectorAll(".resultado-piloto-select").forEach(sel => {
        sel.addEventListener("change", (e) => actualizarFilaResultado(e.target.dataset.pos));
    });

    document.querySelectorAll(".resultado-tiempo-input").forEach(inp => {
        inp.addEventListener("input", (e) => actualizarFilaResultado(e.target.dataset.pos));
    });

    actualizarProgressResultados();
    modal.classList.remove("hidden");
}

/**
 * Actualiza una fila de resultado (validación + cálculo)
 */
function actualizarFilaResultado(posicion) {
    const pos           = parseInt(posicion);
    const selectPiloto  = document.getElementById(`piloto-${pos}`);
    const inputTiempo   = document.getElementById(`tiempo-${pos}`);
    const divPuntos     = document.getElementById(`puntos-${pos}`);
    const rowDiv        = document.getElementById(`resultado-row-${pos}`);
    const errorDiv      = document.getElementById(`error-${pos}`);

    const id_piloto  = parseInt(selectPiloto.value) || null;
    const tiempoStr  = inputTiempo.value.trim();
    let errorMsg     = "";

    estadoConfirmacion.resultados[pos - 1].id_piloto = id_piloto;

    // Validación 1: piloto duplicado
    if (id_piloto) {
        const duplicado = estadoConfirmacion.resultados.some((r, idx) =>
            idx !== pos - 1 && r.id_piloto === id_piloto
        );
        if (duplicado) {
            errorMsg = "⚠️ Piloto ya asignado a otra posición";
        }
    }

    // Validación 2: tiempo
    if (!errorMsg && tiempoStr) {
        const parsed = parseTiempoFlexible(tiempoStr);
        if (!parsed.ok) {
            errorMsg = parsed.error;
        } else {
            estadoConfirmacion.resultados[pos - 1].res_tiempo_seg = parsed.value;
        }
    }

    if (!tiempoStr) {
        estadoConfirmacion.resultados[pos - 1].res_tiempo_seg = null;
    }

    rowDiv.classList.toggle("error", !!errorMsg);
    errorDiv.textContent = errorMsg;

    // Calcula puntos si está habilitado
    if (document.getElementById("autoCalcularPuntos").checked) {
        const puntos = POSICIONES_PARA_PUNTOS[pos] || 0;
        estadoConfirmacion.resultados[pos - 1].res_puntos = puntos;
        divPuntos.textContent = `${puntos} pts`;
    } else {
        divPuntos.textContent = "0 pts";
        estadoConfirmacion.resultados[pos - 1].res_puntos = 0;
    }

    rowDiv.classList.toggle("completo", !errorMsg && !!id_piloto);

    actualizarProgressResultados();
}

/**
 * Actualiza barra de progreso
 */
function actualizarProgressResultados() {
    const count = estadoConfirmacion.resultados.filter(r => r.id_piloto !== null).length;
    const pct   = Math.round((count / 12) * 100);

    document.getElementById("resultadosProgressText").textContent = `${count}/12 pilotos ingresados`;
    document.getElementById("resultadosProgressBar").style.width = pct + "%";
}

/**
 * Detecta vuelta rápida automáticamente y marca la fila correspondiente
 */
function detectarVueltaRapida() {
    // Limpia marcas visuales previas
    document.querySelectorAll(".resultado-row-vr").forEach(el => el.textContent = "");
    estadoConfirmacion.resultados.forEach(r => r.es_vuelta_rapida = false);

    if (!document.getElementById("autoVueltaRapida").checked) return;

    let minTiempo = null;
    let minIdx    = null;

    estadoConfirmacion.resultados.forEach((res, idx) => {
        if (!res.res_tiempo_seg) return;
        const seg = intervalToSeconds(res.res_tiempo_seg);
        if (seg > 0 && (minTiempo === null || seg < minTiempo)) {
            minTiempo = seg;
            minIdx    = idx;
        }
    });

    if (minIdx !== null) {
        estadoConfirmacion.resultados[minIdx].es_vuelta_rapida = true;
        const vrEl = document.getElementById(`vr-${minIdx + 1}`);
        if (vrEl) vrEl.textContent = "⚡";
    }
}

/**
 * Muestra vista previa (con nombres reales de piloto)
 */
async function mostrarVistaPrevia() {
    detectarVueltaRapida();

    // Mapa id_piloto → nombre, usando el caché cargado al abrir el modal de resultados
    let pilotos = estadoConfirmacion._pilotosCache;
    if (!pilotos) {
        try { pilotos = await getPilotosActivosAdmin(); } catch { pilotos = []; }
    }
    const nombreMap = Object.fromEntries(pilotos.map(p => [p.id_piloto, p]));

    const content = estadoConfirmacion.resultados
        .filter(r => r.id_piloto !== null)
        .map(r => {
            const medal   = r.posicion <= 3 ? MEDALLAS[r.posicion] : r.posicion + "°";
            const tiempo  = r.res_tiempo_seg ? formatInterval(r.res_tiempo_seg) : "—";
            const puntos  = r.res_puntos;
            const rapida  = r.es_vuelta_rapida ? " ⚡" : "";
            const piloto  = nombreMap[r.id_piloto];
            const nombre  = piloto
                ? `${piloto.pilo_numero ? "#" + piloto.pilo_numero + " " : ""}${escAttr(piloto.pilo_nombre)}`
                : `Piloto #${r.id_piloto}`;

            return `
        <div class="vista-previa-item">
          <span class="vista-previa-pos">${medal}</span>
          <span class="vista-previa-piloto">${nombre}${rapida}</span>
          <span class="vista-previa-tiempo">${tiempo}</span>
          <span class="vista-previa-puntos">${puntos} pts</span>
        </div>
      `;
        }).join("");

    document.getElementById("vistaPreviaContent").innerHTML = content ||
        `<p style="text-align: center; color: var(--gray-600);">Sin resultados aún</p>`;

    document.getElementById("vistaPreviaModal").classList.remove("hidden");
}

/**
 * Valida y guarda resultados
 */
async function guardarResultados() {
    detectarVueltaRapida();

    const conPiloto = estadoConfirmacion.resultados.filter(r => r.id_piloto !== null);
    if (conPiloto.length === 0) {
        showMsg("saveMsgIngresarResultados", "⚠️ Mínimo 1 piloto requerido");
        return;
    }

    const hayErrores = Array.from(document.querySelectorAll(".resultado-row-error-msg"))
        .some(e => e.textContent.trim());
    if (hayErrores) {
        showMsg("saveMsgIngresarResultados", "⚠️ Corrige los errores antes de guardar");
        return;
    }

    const btnGuardar = document.getElementById("btnGuardarResultados");
    const textOrig   = btnGuardar.textContent;

    try {
        btnGuardar.disabled  = true;
        btnGuardar.textContent = "⟳ Guardando...";

        for (const res of estadoConfirmacion.resultados) {
            if (!res.id_piloto) continue;

            await createResultado({
                id_carrera:  estadoConfirmacion.carreraId,
                id_piloto:   res.id_piloto,
                posicion:    res.posicion,
                puntos:      res.res_puntos,
                tiempo_seg:  res.res_tiempo_seg,
                vueltas:     null
            });
        }

        await updateCarrera(estadoConfirmacion.carreraId, { completada: true });

        await actualizarRankingAuto(estadoConfirmacion.campeonatoId, estadoConfirmacion.resultados);

        showMsg("saveMsgIngresarResultados", "✅ Carrera confirmada. Resultados guardados.");

        setTimeout(() => {
            document.getElementById("ingresarResultadosModal").classList.add("hidden");
            document.getElementById("vistaPreviaModal").classList.add("hidden");
            resetearEstadoConfirmacion();

            loadCarrerasSection();
            loadDashboard();

            btnGuardar.disabled    = false;
            btnGuardar.textContent = textOrig;
        }, 1200);

    } catch (err) {
        showMsg("saveMsgIngresarResultados", "❌ Error al guardar: " + err.message);
        console.error(err);
        btnGuardar.disabled    = false;
        btnGuardar.textContent = textOrig;
    }
}

/**
 * Auto-actualiza ranking después de guardar resultados
 */
async function actualizarRankingAuto(id_campeonato, resultados) {
    try {
        const ranking    = await getRankingByCampeonato(id_campeonato);
        const rankingMap = Object.fromEntries(ranking.map(r => [r.piloto.id_piloto, r]));

        for (const res of resultados) {
            if (!res.id_piloto) continue;

            const rankItem = rankingMap[res.id_piloto];
            if (rankItem) {
                await updateRanking(rankItem.id_ranking, {
                    puntos:    (rankItem.ran_puntos    || 0) + res.res_puntos,
                    carreras:  (rankItem.ran_carreras  || 0) + 1,
                    victorias: (rankItem.ran_victorias || 0) + (res.posicion === 1 ? 1 : 0),
                    podios:    (rankItem.ran_podios    || 0) + (res.posicion <= 3 ? 1 : 0)
                });
            } else {
                await createRanking({
                    id_campeonato,
                    id_piloto: res.id_piloto,
                    puntos:    res.res_puntos,
                    carreras:  1,
                    victorias: res.posicion === 1 ? 1 : 0,
                    podios:    res.posicion <= 3 ? 1 : 0
                });
            }
        }
    } catch (err) {
        console.warn("Ranking auto-update falló (no crítico):", err);
    }
}

/**
 * Resetea estado
 */
function resetearEstadoConfirmacion() {
    estadoConfirmacion = {
        carreraId: null,
        carreraNombre: "",
        carreraFecha: "",
        carreraCircuito: "",
        campeonatoId: null,
        resultados: Array(12).fill(null).map((_, i) => ({
            posicion: i + 1,
            id_piloto: null,
            res_tiempo_seg: null,
            res_puntos: 0,
            es_vuelta_rapida: false
        }))
    };
}

/**
 * Borra todos los resultados ingresados (con confirmación)
 */
function borrarTodoResultados() {
    if (!confirm("¿Borrar todos los resultados ingresados?")) return;
    const carreraId       = estadoConfirmacion.carreraId;
    const campeonatoId    = estadoConfirmacion.campeonatoId;
    const carreraNombre   = estadoConfirmacion.carreraNombre;
    const carreraFecha    = estadoConfirmacion.carreraFecha;
    const carreraCircuito = estadoConfirmacion.carreraCircuito;
    const pilotosCache    = estadoConfirmacion._pilotosCache;

    resetearEstadoConfirmacion();
    // Conserva el contexto de la carrera actual, solo limpia los resultados
    estadoConfirmacion.carreraId        = carreraId;
    estadoConfirmacion.campeonatoId     = campeonatoId;
    estadoConfirmacion.carreraNombre    = carreraNombre;
    estadoConfirmacion.carreraFecha     = carreraFecha;
    estadoConfirmacion.carreraCircuito  = carreraCircuito;
    estadoConfirmacion._pilotosCache    = pilotosCache;

    abrirIngresarResultados();
}


// ════════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════════

async function loadDashboard() {
    try {
        const campActivo = await getCampeonatoActivo();
        const camp = campActivo[0] ?? null;

        const pilotosActivos = await getPilotosActivosCount();
        document.getElementById("statDriversVal").textContent = pilotosActivos.length;

        const sinCamp = `<p class="dash-empty">No hay campeonato activo. Crea uno en la sección Campeonatos.</p>`;

        if (!camp) {
            ["dashCampeonatoBody", "dashTop3Body", "dashUltimaCarreraBody", "dashMasRapidoBody", "dashMasVueltasBody"]
                .forEach(id => document.getElementById(id).innerHTML = sinCamp);
            return;
        }

        const carreras    = await getCarrerasByCampeonatoId(camp.id_campeonato);
        const completadas = carreras.filter(c => c.completada).length;
        const pct         = carreras.length ? Math.round((completadas / carreras.length) * 100) : 0;

        document.getElementById("dashCampeonatoBody").innerHTML = `
            <div class="dash-champ-name">${escAttr(String(camp.camp_ano))}</div>
            <div class="dash-champ-desc">${escAttr(camp.camp_descripcion ?? "Sin descripción")}</div>
            <div class="progress-wrap">
                <div class="progress-label">
                    <span>${completadas} de ${carreras.length} carreras completadas</span>
                    <span style="color:var(--red-500);font-weight:700">${pct}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${pct}%"></div>
                </div>
            </div>`;

        const top3 = await getRankingTop3ByCampeonato(camp.id_campeonato);
        if (top3.length) {
            const colors = ["var(--gold)", "var(--silver)", "var(--bronze)"];
            const clases = ["p1", "p2", "p3"];
            const emojis = ["🥇", "🥈", "🥉"];
            document.getElementById("dashTop3Body").innerHTML = `
                <div class="dash-podium">
                    ${top3.map((r, i) => {
                        const nombre = escAttr(r.piloto?.pilo_nombre ?? "—");
                        const numero = r.piloto?.pilo_numero ? `#${r.piloto.pilo_numero} ` : "";
                        return `
                            <div class="dash-podium-item ${clases[i]}">
                                <div class="dash-podium-pos" style="color:${colors[i]}">${emojis[i]}</div>
                                <div class="dash-podium-name">${numero}${nombre}</div>
                                <div style="text-align:right">
                                    <div class="dash-podium-pts">${r.ran_puntos}</div>
                                    <div class="dash-podium-pts-label">pts</div>
                                </div>
                            </div>`;
                    }).join("")}
                </div>`;
        } else {
            document.getElementById("dashTop3Body").innerHTML = `<p class="dash-empty">Aún no hay datos en el ranquin.</p>`;
        }

        const ultimaArr = await getUltimaCarreraCompletada(camp.id_campeonato);
        const ultima    = ultimaArr[0] ?? null;

        if (!ultima) {
            const sinCarrera = `<p class="dash-empty">Aún no se ha disputado ninguna carrera.</p>`;
            ["dashUltimaCarreraBody", "dashMasRapidoBody", "dashMasVueltasBody"]
                .forEach(id => document.getElementById(id).innerHTML = sinCarrera);
            return;
        }

        const fecha = ultima.fecha
            ? new Date(ultima.fecha + "T00:00:00").toLocaleDateString("es-DO", { day: "2-digit", month: "long", year: "numeric" })
            : "—";

        const [resultadosTop3, resultadosAll] = await Promise.all([
            getResultadosTop3(ultima.id_carrera),
            getResultadosCompletos(ultima.id_carrera)
        ]);

        const resColors = ["var(--gold)", "var(--silver)", "var(--bronze)"];
        document.getElementById("dashUltimaCarreraBody").innerHTML = `
            <div class="dash-ultima-meta">
                <div class="dash-ultima-field">
                    <span class="dash-ultima-field-label">Carrera</span>
                    <span class="dash-ultima-field-val">${escAttr(ultima.nombre)}</span>
                </div>
                <div class="dash-ultima-field">
                    <span class="dash-ultima-field-label">Circuito</span>
                    <span class="dash-ultima-field-val">${escAttr(ultima.circuito ?? "—")}</span>
                </div>
                <div class="dash-ultima-field">
                    <span class="dash-ultima-field-label">Fecha</span>
                    <span class="dash-ultima-field-val">${fecha}</span>
                </div>
            </div>
            <div class="dash-ultima-resultados">
                ${resultadosTop3.map(r => {
                    const nombre = escAttr(r.piloto?.pilo_nombre ?? "—");
                    const numero = r.piloto?.pilo_numero ? `#${r.piloto.pilo_numero}` : "";
                    return `
                        <div class="dash-res-item">
                            <div class="dash-res-pos" style="color:${resColors[r.res_posicion - 1] ?? "var(--gray-500)"}">
                                P${r.res_posicion}
                            </div>
                            <div>
                                <div class="dash-res-name">${numero ? numero + " " : ""}${nombre}</div>
                                <div class="dash-res-pts">${r.res_puntos} pts</div>
                            </div>
                        </div>`;
                }).join("")}
            </div>`;

        const conTiempo = resultadosAll.filter(r => r.res_tiempo_seg && intervalToSeconds(r.res_tiempo_seg) > 0);
        if (conTiempo.length) {
            const rapido = conTiempo.reduce((best, r) =>
                intervalToSeconds(r.res_tiempo_seg) < intervalToSeconds(best.res_tiempo_seg) ? r : best
            );
            const nombre = escAttr(rapido.piloto?.pilo_nombre ?? "—");
            const numero = rapido.piloto?.pilo_numero ? `#${rapido.piloto.pilo_numero}` : "";
            document.getElementById("dashMasRapidoBody").innerHTML = `
                <div class="dash-stat-hero">
                    <div class="dash-stat-hero-val" style="color:#a855f7">🏁 ${formatInterval(rapido.res_tiempo_seg)}</div>
                    <div class="dash-stat-hero-name">${numero ? numero + " " : ""}${nombre}</div>
                    <div class="dash-stat-hero-sub">${escAttr(ultima.nombre)}</div>
                </div>`;
        } else {
            document.getElementById("dashMasRapidoBody").innerHTML = `<p class="dash-empty">Sin tiempos registrados en esta carrera.</p>`;
        }

        const conVueltas = resultadosAll.filter(r => r.res_vueltas > 0);
        if (conVueltas.length) {
            const lider  = conVueltas.reduce((best, r) => r.res_vueltas > best.res_vueltas ? r : best);
            const nombre = escAttr(lider.piloto?.pilo_nombre ?? "—");
            const numero = lider.piloto?.pilo_numero ? `#${lider.piloto.pilo_numero}` : "";
            document.getElementById("dashMasVueltasBody").innerHTML = `
                <div class="dash-stat-hero">
                    <div class="dash-stat-hero-val" style="color:var(--green-400)">🔄 ${lider.res_vueltas} vueltas</div>
                    <div class="dash-stat-hero-name">${numero ? numero + " " : ""}${nombre}</div>
                    <div class="dash-stat-hero-sub">${escAttr(ultima.nombre)}</div>
                </div>`;
        } else {
            document.getElementById("dashMasVueltasBody").innerHTML = `<p class="dash-empty">Sin vueltas registradas en esta carrera.</p>`;
        }

    } catch (err) {
        console.error("Dashboard:", err);
    }
}


// ════════════════════════════════════════════════════════════════
//  CAMPEONATOS
// ════════════════════════════════════════════════════════════════

async function loadChampionships() {
    setTableLoading("yearList", 4);
    try {
        const data = await getCampeonatos();
        document.getElementById("champCount").textContent =
            `${data.length} campeonato${data.length !== 1 ? "s" : ""} registrado${data.length !== 1 ? "s" : ""}`;

        const tbody = document.getElementById("yearList");
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No hay campeonatos registrados aún.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(c => `
            <tr>
                <td><span class="pilot-num">${c.camp_ano}</span></td>
                <td><span class="pilot-name">${c.camp_descripcion ? escAttr(c.camp_descripcion) : '<span style="color:var(--gray-600)">—</span>'}</span></td>
                <td>
                    <span class="status-badge ${c.camp_activo ? "active" : "inactive"}">
                        <span class="status-badge-dot"></span>
                        <span>${c.camp_activo ? "Activo" : "Inactivo"}</span>
                    </span>
                </td>
                <td>
                    <div class="td-actions">
                        <button class="action-btn" onclick="openChampModal(${c.id_campeonato})" title="Editar">${iconEdit}</button>
                        <button class="action-btn danger" onclick="handleDeleteChamp(${c.id_campeonato})" title="Eliminar">${iconTrash}</button>
                    </div>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        showMsg("saveMsgChamp", "❌ Error cargando campeonatos");
    }
}

document.getElementById("btnNewChamp").onclick         = () => openChampModal();
document.getElementById("btnCloseChampModal").onclick  = closeChampModal;
document.getElementById("btnCancelChampModal").onclick = closeChampModal;
document.getElementById("champModal").addEventListener("click", e => {
    if (e.target === document.getElementById("champModal")) closeChampModal();
});

async function openChampModal(id = null) {
    document.getElementById("champEditId").value = id ?? "";
    document.getElementById("yearInput").value   = "";
    document.getElementById("champDesc").value   = "";
    document.getElementById("champActivo").value = "true";
    document.getElementById("champModalTitle").textContent = id ? "Editar Campeonato" : "Nuevo Campeonato";

    if (id) {
        try {
            const data = await getCampeonatos();
            const c = data.find(x => x.id_campeonato === id);
            if (c) {
                document.getElementById("yearInput").value   = c.camp_ano;
                document.getElementById("champDesc").value   = c.camp_descripcion ?? "";
                document.getElementById("champActivo").value = String(c.camp_activo !== false);
            }
        } catch (err) { console.error("Prefill campeonato:", err); }
    }
    document.getElementById("champModal").classList.remove("hidden");
}

function closeChampModal() {
    document.getElementById("champModal").classList.add("hidden");
}

document.getElementById("btnSaveChamp").onclick = async () => {
    const editId = document.getElementById("champEditId").value;
    const ano    = parseInt(document.getElementById("yearInput").value);
    const desc   = document.getElementById("champDesc").value.trim();
    const activo = document.getElementById("champActivo").value === "true";

    if (!ano || isNaN(ano)) return showMsg("saveMsgChamp", "⚠️ Ingresa un año válido");

    try {
        if (editId) {
            await updateCampeonato(parseInt(editId), { ano, descripcion: desc || null, activo });
            showMsg("saveMsgChamp", "✅ Campeonato actualizado");
        } else {
            await createCampeonato({ ano, descripcion: desc || null, activo });
            showMsg("saveMsgChamp", "✅ Campeonato guardado");
        }
        closeChampModal();
        await loadChampionships();
        await loadDashboard();
    } catch (err) {
        const msg = err.message.includes("camp_ano") || err.message.includes("campeonato_ano_unique")
            ? "⚠️ Ya existe un campeonato para ese año"
            : "❌ Error al guardar";
        showMsg("saveMsgChamp", msg);
    }
};

async function handleDeleteChamp(id) {
    if (!confirm("¿Eliminar este campeonato? Se borrarán sus datos de ranking.")) return;
    try {
        await deleteCampeonato(id);
        await loadChampionships();
        await loadDashboard();
        showMsg("saveMsgChamp", "✅ Campeonato eliminado");
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}


// ════════════════════════════════════════════════════════════════
//  PILOTOS
// ════════════════════════════════════════════════════════════════

async function loadDrivers() {
    setTableLoading("driverList", 7);
    try {
        const data = await getPilotos();
        document.getElementById("driverCount").textContent =
            `${data.length} piloto${data.length !== 1 ? "s" : ""} registrado${data.length !== 1 ? "s" : ""}`;

        const tbody = document.getElementById("driverList");
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No hay pilotos registrados aún.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(d => {
            const activo = d.Activo !== false;
            return `
                <tr>
                    <td><span class="pilot-num">${d.Numero ?? "—"}</span></td>
                    <td><span class="pilot-name">${escAttr(d.Nombre)}</span></td>
                    <td><span class="stat-pill stat-champ">${d.Campeonato ?? 0}</span></td>
                    <td><span class="stat-pill stat-win">🏆 ${d.Victorias ?? 0}</span></td>
                    <td><span class="stat-pill stat-podium">🥇 ${d.Podios ?? 0}</span></td>
                    <td>
                        <span class="status-badge ${activo ? "active" : "inactive"}">
                            <span class="status-badge-dot"></span>
                            <span>${activo ? "Activo" : "Inactivo"}</span>
                        </span>
                    </td>
                    <td>
                        <div class="td-actions">
                            <button class="action-btn" onclick="openDriverModal(${d.Id})" title="Editar">${iconEdit}</button>
                            <button class="action-btn danger" onclick="handleDeleteDriver(${d.Id})" title="Eliminar">${iconTrash}</button>
                        </div>
                    </td>
                </tr>`;
        }).join("");
    } catch (err) {
        showMsg("saveMsgDrivers", "❌ Error cargando pilotos");
        console.error(err);
    }
}

document.getElementById("btnNewDriver").onclick         = () => openDriverModal();
document.getElementById("btnCloseDriverModal").onclick  = closeDriverModal;
document.getElementById("btnCancelDriverModal").onclick = closeDriverModal;
document.getElementById("driverModal").addEventListener("click", e => {
    if (e.target === document.getElementById("driverModal")) closeDriverModal();
});

async function openDriverModal(id = null) {
    document.getElementById("driverEditId").value  = id ?? "";
    document.getElementById("driverName").value    = "";
    document.getElementById("driverNumber").value  = "";
    document.getElementById("driverEstado").value  = "true";
    document.getElementById("driverWDC").value     = "0";
    document.getElementById("driverWIN").value     = "0";
    document.getElementById("driverPOLES").value   = "0";
    document.getElementById("driverModalTitle").textContent = id ? "Editar Piloto" : "Nuevo Piloto";

    if (id) {
        const data = await getPilotoById(id);
        if (data.length) {
            const d = data[0];
            document.getElementById("driverName").value   = d.pilo_nombre;
            document.getElementById("driverNumber").value = d.pilo_numero ?? "";
            document.getElementById("driverEstado").value = String(d.pilo_activo !== false);
            document.getElementById("driverWDC").value    = d.pilo_cantidadcampeonatos ?? 0;
            document.getElementById("driverWIN").value    = d.pilo_cantidadvictoria    ?? 0;
            document.getElementById("driverPOLES").value  = d.pilo_cantidadpodios      ?? 0;
        }
    }
    document.getElementById("driverModal").classList.remove("hidden");
}

function closeDriverModal() {
    document.getElementById("driverModal").classList.add("hidden");
}

document.getElementById("btnSaveDriver").onclick = async () => {
    const editId = document.getElementById("driverEditId").value;
    const nombre = document.getElementById("driverName").value.trim();
    const numero = parseInt(document.getElementById("driverNumber").value);
    const activo = document.getElementById("driverEstado").value === "true";
    const wdc    = parseInt(document.getElementById("driverWDC").value)   || 0;
    const win    = parseInt(document.getElementById("driverWIN").value)   || 0;
    const poles  = parseInt(document.getElementById("driverPOLES").value) || 0;

    if (!nombre) return showMsg("saveMsgDrivers", "⚠️ El nombre es obligatorio");

    const payload = { nombre, numero: isNaN(numero) ? null : numero, activo, wdc, win, poles };

    try {
        if (editId) {
            await updatePiloto(parseInt(editId), payload);
            showMsg("saveMsgDrivers", "✅ Piloto actualizado");
        } else {
            await createPiloto(payload);
            showMsg("saveMsgDrivers", "✅ Piloto guardado");
        }
        closeDriverModal();
        await loadDrivers();
    } catch (err) {
        const msg = err.message.includes("piloto_pilo_numero_key")
            ? "⚠️ Ese número ya está en uso"
            : "❌ Error al guardar piloto";
        showMsg("saveMsgDrivers", msg);
    }
};

async function handleDeleteDriver(id) {
    if (!confirm("¿Eliminar este piloto?")) return;
    try {
        await deletePiloto(id);
        await loadDrivers();
        showMsg("saveMsgDrivers", "✅ Piloto eliminado");
    } catch (err) {
        alert("No se puede eliminar: tiene datos de ranking asociados.");
    }
}


// ════════════════════════════════════════════════════════════════
//  CARRERAS
// ════════════════════════════════════════════════════════════════

async function loadCarrerasSection() {
    try {
        const campeonatos = await getCampeonatosAdmin();
        const sel = document.getElementById("carrerasCampeonato");
        sel.innerHTML = campeonatos.length
            ? campeonatos.map(c =>
                `<option value="${c.id_campeonato}">${c.camp_ano}${c.camp_descripcion ? " — " + escAttr(c.camp_descripcion) : ""}</option>`
              ).join("")
            : `<option value="">Sin campeonatos</option>`;

        if (campeonatos.length) await loadCarrerasByCamp(campeonatos[0].id_campeonato);
    } catch (err) {
        showMsg("saveMsgCarreras", "❌ Error cargando campeonatos");
    }
}

document.getElementById("carrerasCampeonato").addEventListener("change", async function () {
    if (this.value) await loadCarrerasByCamp(parseInt(this.value));
});

async function loadCarrerasByCamp(id_campeonato) {
    setTableLoading("carrerasList", 5);
    try {
        const data  = await getCarrerasByCampeonato(id_campeonato);
        const tbody = document.getElementById("carrerasList");

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No hay carreras para este campeonato.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(c => {
            const fecha = c.fecha
                ? new Date(c.fecha + "T00:00:00").toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })
                : "—";
            return `
                <tr>
                    <td><span class="pilot-name">${escAttr(c.nombre)}</span></td>
                    <td><span style="color:var(--gray-400);font-size:0.875rem">${escAttr(c.circuito ?? "—")}</span></td>
                    <td><span class="created-at">${fecha}</span></td>
                    <td>
                        <span class="completada-badge ${c.completada ? "done" : "pending"}">
                            ${c.completada ? "✓ Completada" : "● Pendiente"}
                        </span>
                    </td>
                    <td>
                        <div class="td-actions">
                            <button class="action-btn" onclick="openCarreraModal(${c.id_carrera})" title="Editar">${iconEdit}</button>
                            <button class="action-btn danger" onclick="handleDeleteCarrera(${c.id_carrera})" title="Eliminar">${iconTrash}</button>
                        </div>
                    </td>
                </tr>`;
        }).join("");
    } catch (err) {
        showMsg("saveMsgCarreras", "❌ Error cargando carreras");
        console.error(err);
    }
}

document.getElementById("btnNewCarrera").onclick         = () => openCarreraModal();
document.getElementById("btnCloseCarreraModal").onclick  = closeCarreraModal;
document.getElementById("btnCancelCarreraModal").onclick = closeCarreraModal;
document.getElementById("carreraModal").addEventListener("click", e => {
    if (e.target === document.getElementById("carreraModal")) closeCarreraModal();
});

async function openCarreraModal(id = null) {
    document.getElementById("carreraEditId").value     = id ?? "";
    document.getElementById("carreraNombre").value     = "";
    document.getElementById("carreraCircuito").value   = "";
    document.getElementById("carreraFecha").value      = "";
    document.getElementById("carreraCompletada").value = "false";
    document.getElementById("carreraModalTitle").textContent = id ? "Editar Carrera" : "Nueva Carrera";

    if (id) {
        const data = await getCarreraById(id);
        if (data.length) {
            const c = data[0];
            document.getElementById("carreraNombre").value     = c.nombre;
            document.getElementById("carreraCircuito").value   = c.circuito ?? "";
            document.getElementById("carreraFecha").value      = c.fecha ?? "";
            document.getElementById("carreraCompletada").value = String(c.completada);
        }
    }
    document.getElementById("carreraModal").classList.remove("hidden");
}

function closeCarreraModal() {
    document.getElementById("carreraModal").classList.add("hidden");
}

document.getElementById("btnSaveCarrera").onclick = async () => {
    const editId        = document.getElementById("carreraEditId").value;
    const nombre        = document.getElementById("carreraNombre").value.trim();
    const circuito      = document.getElementById("carreraCircuito").value.trim();
    const fecha         = document.getElementById("carreraFecha").value;
    const completada    = document.getElementById("carreraCompletada").value === "true";
    const id_campeonato = parseInt(document.getElementById("carrerasCampeonato").value);

    if (!nombre) return showMsg("saveMsgCarreras", "⚠️ El nombre es obligatorio");

    const payload = { nombre, circuito: circuito || null, fecha: fecha || null, completada, id_campeonato };

    try {
        if (editId) {
            await updateCarrera(parseInt(editId), payload);
            showMsg("saveMsgCarreras", "✅ Carrera actualizada");
        } else {
            await createCarrera(payload);
            showMsg("saveMsgCarreras", "✅ Carrera guardada");
        }
        closeCarreraModal();
        await loadCarrerasByCamp(id_campeonato);
    } catch (err) {
        showMsg("saveMsgCarreras", "❌ Error al guardar carrera");
        console.error(err);
    }
};

async function handleDeleteCarrera(id) {
    if (!confirm("¿Eliminar esta carrera? Se borrarán también sus resultados.")) return;
    try {
        await deleteCarrera(id);
        const id_campeonato = parseInt(document.getElementById("carrerasCampeonato").value);
        await loadCarrerasByCamp(id_campeonato);
        showMsg("saveMsgCarreras", "✅ Carrera eliminada");
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}


// ════════════════════════════════════════════════════════════════
//  RESULTADOS
// ════════════════════════════════════════════════════════════════

async function loadResultadosSection() {
    try {
        const campeonatos = await getCampeonatosAdmin();
        const selCamp = document.getElementById("resultadosCampeonato");
        selCamp.innerHTML = campeonatos.length
            ? campeonatos.map(c =>
                `<option value="${c.id_campeonato}">${c.camp_ano}${c.camp_descripcion ? " — " + escAttr(c.camp_descripcion) : ""}</option>`
              ).join("")
            : `<option value="">Sin campeonatos</option>`;

        if (campeonatos.length) await loadCarrerasForResultados(campeonatos[0].id_campeonato);
    } catch (err) {
        showMsg("saveMsgResultados", "❌ Error cargando sección");
    }
}

async function loadCarrerasForResultados(id_campeonato) {
    const carreras = await getCarrerasByCampeonato(id_campeonato);
    const selCar   = document.getElementById("resultadosCarrera");
    selCar.innerHTML = carreras.length
        ? carreras.map(c =>
            `<option value="${c.id_carrera}">${escAttr(c.nombre)}${c.fecha ? " · " + c.fecha : ""}</option>`
          ).join("")
        : `<option value="">Sin carreras en este campeonato</option>`;

    if (carreras.length) await loadResultadosList(carreras[0].id_carrera);
    else document.getElementById("resultadosList").innerHTML =
        `<tr><td colspan="7" class="table-empty">Sin carreras. Agrégalas en la sección Carreras.</td></tr>`;
}

document.getElementById("resultadosCampeonato").addEventListener("change", async function () {
    if (this.value) await loadCarrerasForResultados(parseInt(this.value));
});
document.getElementById("resultadosCarrera").addEventListener("change", async function () {
    if (this.value) await loadResultadosList(parseInt(this.value));
});

async function loadResultadosList(id_carrera) {
    setTableLoading("resultadosList", 7);
    try {
        const data  = await getResultadosByCarrera(id_carrera);
        const tbody = document.getElementById("resultadosList");

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No hay resultados registrados para esta carrera.</td></tr>`;
            return;
        }

        let minTiempo = null, minId = null;
        data.forEach(r => {
            if (!r.res_tiempo_seg) return;
            const seg = intervalToSeconds(r.res_tiempo_seg);
            if (seg > 0 && (minTiempo === null || seg < minTiempo)) {
                minTiempo = seg;
                minId = r.id_resultado;
            }
        });

        tbody.innerHTML = data.map(r => {
            const nombre      = r.piloto ? `${r.piloto.pilo_numero ? "#" + r.piloto.pilo_numero + " " : ""}${r.piloto.pilo_nombre}` : "—";
            const esVueltaRap = minId !== null && r.id_resultado === minId;
            return `
                <tr>
                    <td><span class="pos-badge pos-${r.res_posicion <= 3 ? r.res_posicion : "n"}">${r.res_posicion}</span></td>
                    <td><span class="pilot-name">${escAttr(nombre)}</span></td>
                    <td><span class="stat-pill stat-win">${r.res_puntos} pts</span></td>
                    <td><span style="color:var(--gray-400);font-size:0.875rem">${r.res_vueltas ?? "—"}</span></td>
                    <td><span class="tiempo-val">${r.res_tiempo_seg ? formatInterval(r.res_tiempo_seg) : "—"}</span></td>
                    <td>${esVueltaRap ? `<span class="vuelta-rap-badge">🏁 Rápida</span>` : `<span style="color:var(--gray-700);font-size:0.8rem">—</span>`}</td>
                    <td>
                        <div class="td-actions">
                            <button class="action-btn" onclick="openResultadoModal(${r.id_resultado})" title="Editar">${iconEdit}</button>
                            <button class="action-btn danger" onclick="handleDeleteResultado(${r.id_resultado})" title="Eliminar">${iconTrash}</button>
                        </div>
                    </td>
                </tr>`;
        }).join("");
    } catch (err) {
        showMsg("saveMsgResultados", "❌ Error cargando resultados");
        console.error(err);
    }
}

document.getElementById("btnNewResultado").onclick         = () => openResultadoModal();
document.getElementById("btnCloseResultadoModal").onclick  = closeResultadoModal;
document.getElementById("btnCancelResultadoModal").onclick = closeResultadoModal;
document.getElementById("resultadoModal").addEventListener("click", e => {
    if (e.target === document.getElementById("resultadoModal")) closeResultadoModal();
});

async function cargarPosicionesDisponibles(id_carrera, posicionActual = null) {
    const sel = document.getElementById("resultadoPosicion");
    try {
        const data     = await getResultadosByCarrera(id_carrera);
        const ocupadas = new Set(data.map(r => r.res_posicion));
        if (posicionActual) ocupadas.delete(posicionActual);

        const opciones = Array.from({ length: 12 }, (_, i) => i + 1)
            .filter(p => !ocupadas.has(p))
            .map(p => {
                const label = p === 1 ? "🥇 1°" : p === 2 ? "🥈 2°" : p === 3 ? "🥉 3°" : `${p}°`;
                return `<option value="${p}" ${p === posicionActual ? "selected" : ""}>${label}</option>`;
            });

        if (!opciones.length) {
            sel.innerHTML = `<option value="">Sin posiciones disponibles</option>`;
            return false;
        }
        sel.innerHTML = `<option value="">Seleccionar posición...</option>` + opciones.join("");
        if (posicionActual) sel.value = posicionActual;
        return true;
    } catch (e) {
        sel.innerHTML = `<option value="">Error cargando posiciones</option>`;
        return false;
    }
}

async function openResultadoModal(id = null) {
    const id_carrera = parseInt(document.getElementById("resultadosCarrera").value);
    if (!id_carrera) {
        showMsg("saveMsgResultados", "⚠️ Selecciona una carrera primero");
        return;
    }

    document.getElementById("resultadoEditId").value  = id ?? "";
    document.getElementById("resultadoPuntos").value  = "0";
    document.getElementById("resultadoVueltas").value = "";
    document.getElementById("resultadoTiempo").value  = "";
    document.getElementById("resultadoModalTitle").textContent = id ? "Editar Resultado" : "Agregar Resultado";

    try {
        const pilotos = await getPilotosActivosAdmin();
        document.getElementById("resultadoPiloto").innerHTML =
            `<option value="">Seleccionar piloto...</option>` +
            pilotos.map(p =>
                `<option value="${p.id_piloto}">${p.pilo_numero ? "#" + p.pilo_numero + " " : ""}${escAttr(p.pilo_nombre)}</option>`
            ).join("");
    } catch (e) {
        document.getElementById("resultadoPiloto").innerHTML = `<option value="">Error cargando pilotos</option>`;
    }

    if (id) {
        try {
            const data = await getResultadosByCarrera(id_carrera);
            const r    = data.find(x => x.id_resultado === id);
            if (r) {
                await cargarPosicionesDisponibles(id_carrera, r.res_posicion);
                document.getElementById("resultadoPuntos").value  = r.res_puntos;
                document.getElementById("resultadoVueltas").value = r.res_vueltas ?? "";
                document.getElementById("resultadoTiempo").value  = r.res_tiempo_seg ? formatInterval(r.res_tiempo_seg) : "";
                if (r.piloto?.id_piloto) document.getElementById("resultadoPiloto").value = r.piloto.id_piloto;
            }
        } catch (e) { console.error(e); }
    } else {
        const hayDisponibles = await cargarPosicionesDisponibles(id_carrera);
        if (!hayDisponibles) {
            showMsg("saveMsgResultados", "⚠️ Esta carrera ya tiene los 12 resultados registrados");
            return;
        }
    }

    document.getElementById("resultadoModal").classList.remove("hidden");
}

document.getElementById("resultadoPosicion").addEventListener("change", async function () {
    const pos = parseInt(this.value);
    if (!pos) return;
    try {
        const tabla = await getTablaPuntos();
        const fila  = tabla.find(r => r.id_tablapuntosbase === pos);
        document.getElementById("resultadoPuntos").value = fila ? (fila.tpb_puntos ?? 0) : 0;
    } catch (e) {
        document.getElementById("resultadoPuntos").value = 0;
    }
});

function closeResultadoModal() {
    document.getElementById("resultadoModal").classList.add("hidden");
    const msg = document.getElementById("saveMsgResultadoModal");
    if (msg) msg.textContent = "";
}

document.getElementById("btnSaveResultado").onclick = async () => {
    const editId     = document.getElementById("resultadoEditId").value;
    const id_piloto  = parseInt(document.getElementById("resultadoPiloto").value);
    const posicion   = parseInt(document.getElementById("resultadoPosicion").value);
    const puntos     = parseInt(document.getElementById("resultadoPuntos").value) || 0;
    const vueltas    = parseInt(document.getElementById("resultadoVueltas").value) || null;
    const tiempoStr  = document.getElementById("resultadoTiempo").value.trim();
    const id_carrera = parseInt(document.getElementById("resultadosCarrera").value);

    if (!id_carrera) return showMsg("saveMsgResultadoModal", "⚠️ Selecciona una carrera primero");
    if (!id_piloto)  return showMsg("saveMsgResultadoModal", "⚠️ Selecciona un piloto");
    if (!posicion || posicion < 1 || posicion > 12)
        return showMsg("saveMsgResultadoModal", "⚠️ Selecciona una posición válida (1–12)");

    let tiempo_seg = null;
    if (tiempoStr) {
        try { tiempo_seg = toInterval(tiempoStr); }
        catch (e) { return showMsg("saveMsgResultadoModal", "⚠️ " + e.message); }
    }

    try {
        if (editId) {
            await updateResultado(parseInt(editId), { posicion, puntos, tiempo_seg, vueltas });
            showMsg("saveMsgResultados", "✅ Resultado actualizado");
        } else {
            await createResultado({ id_carrera, id_piloto, posicion, puntos, tiempo_seg, vueltas });
            showMsg("saveMsgResultados", "✅ Resultado guardado");
        }
        closeResultadoModal();
        await loadResultadosList(id_carrera);
    } catch (err) {
        let msg = "❌ Error al guardar resultado";
        if (err.message.includes("resultado_unique_piloto_carrera")) msg = "⚠️ Este piloto ya tiene un resultado en esta carrera";
        else if (err.message.includes("resultado_unique_posicion"))  msg = "⚠️ Esa posición ya está ocupada en esta carrera";
        showMsg("saveMsgResultadoModal", msg);
        console.error(err);
    }
};

async function handleDeleteResultado(id) {
    if (!confirm("¿Eliminar este resultado?")) return;
    try {
        await deleteResultado(id);
        const id_carrera = parseInt(document.getElementById("resultadosCarrera").value);
        await loadResultadosList(id_carrera);
        showMsg("saveMsgResultados", "✅ Resultado eliminado");
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}


// ════════════════════════════════════════════════════════════════
//  TABLA DE PUNTOS
// ════════════════════════════════════════════════════════════════

async function loadPuntosSection() {
    try {
        const data = await getTablaPuntos();
        renderPuntosTable(data);
    } catch (err) {
        showMsg("saveMsgPuntos", "❌ Error cargando tabla de puntos");
        console.error(err);
    }
}

function renderPuntosTable(data) {
    const tbody = document.getElementById("puntosList");
    const mapa  = {};
    data.forEach(r => { mapa[r.id_tablapuntosbase] = r.tpb_puntos ?? 0; });

    tbody.innerHTML = Array.from({ length: 12 }, (_, i) => {
        const pos    = i + 1;
        const puntos = mapa[pos] ?? "—";
        const existe = Object.prototype.hasOwnProperty.call(mapa, pos);
        return `
            <tr id="puntos-row-${pos}">
                <td><span class="pos-badge pos-${pos <= 3 ? pos : "n"}">${pos}</span></td>
                <td><span style="color:var(--gray-400);font-size:0.875rem">${POSICION_LABELS[pos]}</span></td>
                <td id="puntos-val-${pos}">
                    <span class="stat-pill stat-win">${puntos} pts</span>
                </td>
                <td>
                    <div class="td-actions">
                        <button class="action-btn" onclick="editPuntosFila(${pos}, ${existe ? mapa[pos] : 0})" title="Editar">${iconEdit}</button>
                    </div>
                </td>
            </tr>`;
    }).join("");
}

function editPuntosFila(pos, valorActual) {
    const cell = document.getElementById(`puntos-val-${pos}`);
    cell.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center">
            <input type="number" id="puntosInput-${pos}" class="form-input"
                value="${valorActual}" min="0" style="width:80px;padding:5px 8px"
                onkeydown="if(event.key==='Enter') savePuntosFila(${pos}); if(event.key==='Escape') loadPuntosSection();">
            <button class="btn-primary" style="padding:5px 12px;font-size:0.75rem" onclick="savePuntosFila(${pos})">✓</button>
            <button class="btn-ghost"   style="padding:5px 10px;font-size:0.75rem" onclick="loadPuntosSection()">✕</button>
        </div>`;
    document.getElementById(`puntosInput-${pos}`).focus();
}

async function savePuntosFila(pos) {
    const input  = document.getElementById(`puntosInput-${pos}`);
    const puntos = parseInt(input.value);
    if (isNaN(puntos) || puntos < 0)
        return showMsg("saveMsgPuntos", "⚠️ Ingresa un valor válido (0 o más)");

    try {
        const data  = await getTablaPuntos();
        const existe = data.find(r => r.id_tablapuntosbase === pos);
        if (existe) await upsertPuntosPosicion(pos, puntos);
        else        await initPuntosFila(pos, puntos);
        showMsg("saveMsgPuntos", `✅ Posición ${pos} actualizada a ${puntos} pts`);
        await loadPuntosSection();
    } catch (err) {
        showMsg("saveMsgPuntos", "❌ Error al guardar");
        console.error(err);
    }
}


// ════════════════════════════════════════════════════════════════
//  RANKING
// ════════════════════════════════════════════════════════════════

async function loadRankingSection() {
    try {
        const campeonatos = await getCampeonatosActivos();
        const sel = document.getElementById("rankingCampeonato");
        sel.innerHTML = campeonatos.length
            ? campeonatos.map(c =>
                `<option value="${c.id_campeonato}">${c.camp_ano}${c.camp_descripcion ? " — " + escAttr(c.camp_descripcion) : ""}</option>`
              ).join("")
            : `<option value="">Sin campeonatos activos</option>`;

        if (campeonatos.length) await loadRankingList(campeonatos[0].id_campeonato);
        else document.getElementById("rankingList").innerHTML =
            `<div class="rank-empty">No hay campeonatos activos.</div>`;
    } catch (err) {
        showMsg("saveMsgRanking", "❌ Error cargando ranquin");
        console.error(err);
    }
}

document.getElementById("rankingCampeonato").addEventListener("change", async function () {
    if (this.value) await loadRankingList(parseInt(this.value));
});

async function loadRankingList(id_campeonato) {
    try {
        const data = await getRankingByCampeonato(id_campeonato);
        const list = document.getElementById("rankingList");

        if (!data.length) {
            list.innerHTML = `<div class="rank-empty">No hay pilotos en este ranquin todavía.</div>`;
            return;
        }

        list.innerHTML = data.map((r, i) => {
            const pos    = i + 1;
            const cls    = pos === 1 ? "rank-card-1" : pos === 2 ? "rank-card-2" : pos === 3 ? "rank-card-3" : "rank-card-n";
            const color  = pos === 1 ? "var(--gold)" : pos === 2 ? "var(--silver)" : pos === 3 ? "var(--bronze)" : "var(--gray-500)";
            const nombre = escAttr(r.piloto?.pilo_nombre ?? "—");
            const numero = r.piloto?.pilo_numero ?? "";
            return `
                <div class="rank-card ${cls}">
                    <div class="rank-pos" style="color:${color}">${pos}</div>
                    <div class="rank-info">
                        <div class="rank-name">${numero ? `#${numero} ` : ""}${nombre}</div>
                        <div class="rank-stats">
                            <span class="rank-stat">${r.ran_carreras} carrera${r.ran_carreras !== 1 ? "s" : ""}</span>
                            <span class="rank-stat-y">🏆 ${r.ran_victorias} victoria${r.ran_victorias !== 1 ? "s" : ""}</span>
                            <span class="rank-stat-w">🥇 ${r.ran_podios} podio${r.ran_podios !== 1 ? "s" : ""}</span>
                        </div>
                    </div>
                    <div class="rank-pts">
                        <div class="rank-pts-num">${r.ran_puntos}</div>
                        <div class="rank-pts-label">pts</div>
                    </div>
                    <button class="rank-edit-btn" onclick="openRankingModal(${r.id_ranking}, ${r.piloto?.id_piloto}, '${escAttr(r.piloto?.pilo_nombre ?? "")}', ${r.ran_puntos}, ${r.ran_carreras}, ${r.ran_victorias}, ${r.ran_podios})" title="Editar">
                        ${iconEdit}
                    </button>
                    <button class="del-btn" onclick="handleDeleteRanking(${r.id_ranking})" title="Eliminar">✕</button>
                </div>`;
        }).join("");
    } catch (err) {
        showMsg("saveMsgRanking", "❌ Error cargando datos");
        console.error(err);
    }
}

document.getElementById("btnAddRanking").onclick  = () => openRankingModal();
document.getElementById("btnCloseModal").onclick  = closeRankingModal;
document.getElementById("btnCancelModal").onclick = closeRankingModal;
document.getElementById("rankingModal").addEventListener("click", e => {
    if (e.target === document.getElementById("rankingModal")) closeRankingModal();
});

async function openRankingModal(id = null, id_piloto = null, nombre = "", puntos = 0, carreras = 0, victorias = 0, podios = 0) {
    document.getElementById("rankingModalTitle").textContent = id ? "Editar Ranquin" : "Agregar al Ranquin";
    document.getElementById("rankingEditId").value    = id ?? "";
    document.getElementById("rankingPuntos").value    = puntos;
    document.getElementById("rankingCarreras").value  = carreras;
    document.getElementById("rankingVictorias").value = victorias;
    document.getElementById("rankingPodios").value    = podios;

    try {
        const pilotos = await getPilotosActivosAdmin();
        document.getElementById("rankingPiloto").innerHTML = pilotos.map(p =>
            `<option value="${p.id_piloto}" ${p.id_piloto === id_piloto ? "selected" : ""}>
                ${p.pilo_numero ? "#" + p.pilo_numero + " " : ""}${escAttr(p.pilo_nombre)}
            </option>`
        ).join("");
    } catch (err) {
        document.getElementById("rankingPiloto").innerHTML = `<option value="">Error cargando pilotos</option>`;
    }
    document.getElementById("rankingModal").classList.remove("hidden");
}

function closeRankingModal() {
    document.getElementById("rankingModal").classList.add("hidden");
}

document.getElementById("btnSaveRanking").onclick = async () => {
    const editId        = document.getElementById("rankingEditId").value;
    const id_piloto     = parseInt(document.getElementById("rankingPiloto").value);
    const puntos        = parseInt(document.getElementById("rankingPuntos").value)    || 0;
    const carreras      = parseInt(document.getElementById("rankingCarreras").value)  || 0;
    const victorias     = parseInt(document.getElementById("rankingVictorias").value) || 0;
    const podios        = parseInt(document.getElementById("rankingPodios").value)    || 0;
    const id_campeonato = parseInt(document.getElementById("rankingCampeonato").value);

    if (!id_piloto || !id_campeonato)
        return showMsg("saveMsgRanking", "⚠️ Selecciona un piloto y un campeonato");

    try {
        if (editId) {
            await updateRanking(parseInt(editId), { puntos, carreras, victorias, podios });
            showMsg("saveMsgRanking", "✅ Ranquin actualizado");
        } else {
            await createRanking({ id_campeonato, id_piloto, puntos, carreras, victorias, podios });
            showMsg("saveMsgRanking", "✅ Piloto agregado al ranquin");
        }
        closeRankingModal();
        await loadRankingList(id_campeonato);
        await loadDashboard();
    } catch (err) {
        const msg = err.message.includes("ranking_unique")
            ? "⚠️ Este piloto ya está en el ranquin de este campeonato"
            : "❌ Error al guardar";
        showMsg("saveMsgRanking", msg);
        console.error(err);
    }
};

async function handleDeleteRanking(id) {
    if (!confirm("¿Eliminar este piloto del ranquin?")) return;
    try {
        await deleteRanking(id);
        const id_campeonato = parseInt(document.getElementById("rankingCampeonato").value);
        await loadRankingList(id_campeonato);
        await loadDashboard();
        showMsg("saveMsgRanking", "✅ Eliminado del ranquin");
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}


// ════════════════════════════════════════════════════════════════
//  EXPONER FUNCIONES AL SCOPE GLOBAL (onclick en HTML)
// ════════════════════════════════════════════════════════════════

Object.assign(window, {
    openChampModal,      handleDeleteChamp,
    openDriverModal,     handleDeleteDriver,
    openCarreraModal,    handleDeleteCarrera,
    openResultadoModal,  handleDeleteResultado,
    editPuntosFila,      savePuntosFila,
    openRankingModal,    handleDeleteRanking
});


// ════════════════════════════════════════════════════════════════
//  EVENT LISTENERS v1.3.0 — Confirmación de Carrera
// ════════════════════════════════════════════════════════════════

document.getElementById("btnConfirmarCarrera").addEventListener("click", abrirConfirmarCarrera);
document.getElementById("btnCloseConfirmarCarrera").addEventListener("click", () => {
    document.getElementById("confirmarCarreraModal").classList.add("hidden");
});
document.getElementById("btnCancelConfirmarCarrera").addEventListener("click", () => {
    document.getElementById("confirmarCarreraModal").classList.add("hidden");
});
document.getElementById("confirmarCarreraCampeonato").addEventListener("change", (e) => {
    if (e.target.value) cargarCarrerasPendientes(parseInt(e.target.value));
});
document.getElementById("confirmarCarreraSelect").addEventListener("change", (e) => {
    if (e.target.value) actualizarInfoCarrera(parseInt(e.target.value));
});
document.getElementById("btnContinuarResultados").addEventListener("click", continuarAResultados);

document.getElementById("btnCloseIngresarResultados").addEventListener("click", () => {
    document.getElementById("ingresarResultadosModal").classList.add("hidden");
    resetearEstadoConfirmacion();
});
document.getElementById("btnCancelIngresarResultados").addEventListener("click", () => {
    document.getElementById("ingresarResultadosModal").classList.add("hidden");
    resetearEstadoConfirmacion();
});
document.getElementById("btnBorrarTodoResultados").addEventListener("click", borrarTodoResultados);
document.getElementById("btnVistaPrevia").addEventListener("click", mostrarVistaPrevia);
document.getElementById("btnGuardarResultados").addEventListener("click", guardarResultados);

document.getElementById("btnCloseVistaPrevia").addEventListener("click", () => {
    document.getElementById("vistaPreviaModal").classList.add("hidden");
});
document.getElementById("btnVolverEdicion").addEventListener("click", () => {
    document.getElementById("vistaPreviaModal").classList.add("hidden");
});
document.getElementById("btnConfirmarGuardar").addEventListener("click", async () => {
    document.getElementById("vistaPreviaModal").classList.add("hidden");
    await guardarResultados();
});

document.getElementById("confirmarCarreraModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("confirmarCarreraModal"))
        document.getElementById("confirmarCarreraModal").classList.add("hidden");
});
document.getElementById("ingresarResultadosModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("ingresarResultadosModal")) {
        document.getElementById("ingresarResultadosModal").classList.add("hidden");
        resetearEstadoConfirmacion();
    }
});
document.getElementById("vistaPreviaModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("vistaPreviaModal"))
        document.getElementById("vistaPreviaModal").classList.add("hidden");
});


// ════════════════════════════════════════════════════════════════
//  ARRANCAR
// ════════════════════════════════════════════════════════════════

loadDashboard();