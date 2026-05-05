// ══════════════════════════════════════════════
//  FKarting — app.js
//  Solo lógica UI · Todas las queries en connection.js
// ══════════════════════════════════════════════

import {
    getRankingVista,
    getPilotosVista,
    getTiempoVista,
    getCarreraVista
} from './conection.js';


// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

// Convierte interval de PostgreSQL "00:01:23.456" → "1:23.456"
function formatTiempo(t) {
    if (!t) return "—";
    const parts = t.split(":");
    if (parts.length === 3) {
        const min = parseInt(parts[1], 10);
        const seg = parseFloat(parts[2]).toFixed(3);
        return `${min}:${seg.padStart(6, "0")}`;
    }
    return t;
}

// Convierte interval "HH:MM:SS.mmm" → segundos totales (para ordenar numéricamente)
function intervalToSec(t) {
    if (!t) return Infinity;
    const parts = t.split(":");
    if (parts.length === 3) {
        return parseInt(parts[0], 10) * 3600
             + parseInt(parts[1], 10) * 60
             + parseFloat(parts[2]);
    }
    return Infinity;
}

function posClass(pos) {
    pos = parseInt(pos);
    if (pos === 1) return "p1";
    if (pos === 2) return "p2";
    if (pos === 3) return "p3";
    return "px";
}

// ✅ Lee un campo probando múltiples variantes de nombre (PascalCase, lowercase, snake_case)
function field(row, ...keys) {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) return row[k];
        const lower = k.toLowerCase();
        if (row[lower] !== undefined && row[lower] !== null) return row[lower];
    }
    return null;
}


// ════════════════════════════════════════════════════════════════
//  RANKING GENERAL
// ════════════════════════════════════════════════════════════════

async function loadRanking() {
    const container = document.getElementById("rankingList");
    try {
        const [ranking, pilotos] = await Promise.all([
            getRankingVista(),
            getPilotosVista()
        ]);

        if (!ranking?.length) {
            container.innerHTML = `<p class="empty-msg">Sin datos aún.</p>`;
            return;
        }

        const pilotoMap = Object.fromEntries((pilotos ?? []).map(p => [p.Id, p]));
        const medals    = ["🥇", "🥈", "🥉"];
        const posClss   = ["pos-gold", "pos-silver", "pos-bronze"];
        const heights   = [280, 210, 160];
        const maxPts    = ranking[0]?.Puntos ?? 1;

        // Orden visual: P2 — P1 — P3
        const orden = [1, 0, 2];

        container.innerHTML = orden.map(i => {
            const d = ranking[i];
            if (!d) return "";

            const piloto = pilotoMap[d.Piloto];
            const nombre = piloto?.Nombre ?? `Piloto #${d.Piloto}`;
            const numero = piloto?.Numero ?? "—";
            const diff   = i === 0
                ? `<span style="color:var(--gold);font-weight:900">Líder</span>`
                : `-${maxPts - d.Puntos} pts`;

            return `
            <div class="ranking-col ${posClss[i]}">
                <div class="ranking-col-top">
                    <span class="ranking-col-medal">${medals[i]}</span>
                    <span class="ranking-col-name">${nombre}</span>
                    <span class="ranking-col-kart">#${numero}</span>
                </div>
                <div class="ranking-bar-wrap">
                    <div class="ranking-bar" style="height:${heights[i]}px">
                        <div class="ranking-bar-pts">${d.Puntos}</div>
                        <div class="ranking-bar-pts-lbl">puntos</div>
                        <div class="ranking-bar-gap">${diff}</div>
                    </div>
                </div>
                <div class="ranking-col-base">
                    <div class="ranking-col-stat">
                        <span class="col-stat-val">${d.Vitorias ?? 0}</span>
                        <span class="col-stat-lbl">Victorias</span>
                    </div>
                    <div class="ranking-col-stat">
                        <span class="col-stat-val">${d.Podios ?? 0}</span>
                        <span class="col-stat-lbl">Podios</span>
                    </div>
                </div>
            </div>`;
        }).join("");

    } catch (err) {
        console.error("Ranking:", err);
        container.innerHTML = `<p class="empty-msg">Error al cargar ranking.</p>`;
    }
}


// ════════════════════════════════════════════════════════════════
//  MEJOR TIEMPO
// ════════════════════════════════════════════════════════════════

async function loadMejorTiempo() {
    const container = document.getElementById("mejorTiempoList");
    try {
        const data = await getTiempoVista();

        if (!data?.length) {
            container.innerHTML = `<p class="empty-msg">Sin tiempos registrados.</p>`;
            return;
        }

        // Debug: confirma los nombres de columna reales que devuelve Supabase
        console.log("[MejorTiempo] columnas:", Object.keys(data[0]));

        // ✅ FIX: ordenar por segundos, no por string
        const sorted = [...data].sort((a, b) =>
            intervalToSec(field(a, "Tiempos", "tiempos"))
          - intervalToSec(field(b, "Tiempos", "tiempos"))
        );

        container.innerHTML = sorted.map((d, i) => {
            // ✅ FIX: leer campos con fallback a minúsculas
            const tiempos      = field(d, "Tiempos",      "tiempos");
            const nombrePiloto = field(d, "NombrePiloto", "nombrepiloto", "nombre_piloto");
            const vueltaRapida = field(d, "VueltaRapida", "vueltarapida", "vuelta_rapida");
            const esRapida     = vueltaRapida === true || vueltaRapida === "true";

            return `
            <div class="tiempo-row ${esRapida ? "vuelta-rapida" : ""}">
                <div class="tiempo-pos">${i + 1}</div>
                <div class="tiempo-nombre">${nombrePiloto ?? "—"}</div>
                ${esRapida ? `<span class="tiempo-badge">⚡ Vuelta Rápida</span>` : ""}
                <div class="tiempo-valor">${formatTiempo(tiempos)}</div>
            </div>`;
        }).join("");

    } catch (err) {
        console.error("Mejor Tiempo error:", err);
        // ✅ Muestra el mensaje real de Supabase para facilitar diagnóstico
        container.innerHTML = `<p class="empty-msg">Error al cargar tiempos.<br><small style="opacity:.5;font-size:.75rem">${err.message}</small></p>`;
    }
}


// ════════════════════════════════════════════════════════════════
//  ÚLTIMA CARRERA
// ════════════════════════════════════════════════════════════════

async function loadUltimaCarrera() {
    const container = document.getElementById("resultsList");
    try {
        const data = await getCarreraVista();

        if (!data?.length) {
            container.innerHTML = `<p class="empty-msg">No hay carreras completadas aún.</p>`;
            return;
        }

        // Debug: confirma los nombres de columna reales que devuelve Supabase
        console.log("[UltimaCarrera] columnas:", Object.keys(data[0]));

        // ✅ FIX: ordenar en JS para evitar problemas de mayúsculas en order= de PostgREST
        data.sort((a, b) => {
            const fa = field(a, "Fecha", "fecha") ?? "";
            const fb = field(b, "Fecha", "fecha") ?? "";
            if (fb > fa) return 1;
            if (fb < fa) return -1;
            return (parseInt(field(a, "posicion", "Posicion")) || 0)
                 - (parseInt(field(b, "posicion", "Posicion")) || 0);
        });

        const ultimaId   = data[0].id_carrera;

        // ✅ FIX: == flexible para no fallar por discrepancia string/number
        const resultados = data.filter(r => r.id_carrera == ultimaId);

        if (!resultados.length) {
            container.innerHTML = `<p class="empty-msg">No hay resultados para la última carrera.</p>`;
            return;
        }

        // ✅ FIX: leer campos con fallback a minúsculas
        const nombre   = field(resultados[0], "nombre",   "Nombre");
        const circuito = field(resultados[0], "circuito", "Circuito");
        const fecha    = field(resultados[0], "fecha",    "Fecha");

        const fechaStr = fecha
            ? new Date(fecha).toLocaleDateString("es-DO", {
                day: "numeric", month: "long", year: "numeric"
              })
            : "";

        container.innerHTML = `
            <div class="carrera-meta">
                <span class="carrera-meta-icon">📍</span>
                <span>${nombre ?? ""}${circuito ? " · " + circuito : ""}${fechaStr ? " · " + fechaStr : ""}</span>
            </div>
            ${resultados.map(r => {
                const posicion   = field(r, "posicion",    "Posicion");
                const piloNombre = field(r, "pilo_nombre", "pilonombre", "pilo_Nombre", "NombrePiloto");
                const puntos     = field(r, "puntos",      "Puntos");
                return `
                <div class="result-item">
                    <div class="result-pos ${posClass(posicion)}">${posicion ?? "—"}</div>
                    <div class="result-name">${piloNombre ?? "—"}</div>
                    <div class="result-pts">${puntos ?? 0}<span class="result-pts-label">pts</span></div>
                </div>`;
            }).join("")}
        `;

    } catch (err) {
        console.error("Última carrera error:", err);
        // ✅ Muestra el mensaje real de Supabase para facilitar diagnóstico
        container.innerHTML = `<p class="empty-msg">Error al cargar resultados.<br><small style="opacity:.5;font-size:.75rem">${err.message}</small></p>`;
    }
}


// ════════════════════════════════════════════════════════════════
//  PILOTOS
// ════════════════════════════════════════════════════════════════

async function loadPilotos() {
    const grid = document.getElementById("driversGrid");
    try {
        const data = await getPilotosVista();

        if (!data?.length) {
            grid.innerHTML = `<p class="empty-msg">No hay pilotos registrados.</p>`;
            return;
        }

    grid.innerHTML = data.map(d => `
        <div class="driver-card" data-id="${d.Id}">
            <div class="driver-num">#${d.Numero ?? "—"}</div>
            <div class="driver-name">${formatName(d.Nombre)}</div>
    
            <div class="driver-stats">
                <div class="driver-stat">
                    <span class="driver-stat-value">${d.Campeonato ?? 0}</span>
                    <span class="driver-stat-label">Tempo</span>
                </div>
                <div class="driver-stat-divider"></div>
                <div class="driver-stat">
                    <span class="driver-stat-value">${d.Victorias ?? 0}</span>
                    <span class="driver-stat-label">Victorias</span>
                </div>
                <div class="driver-stat-divider"></div>
                <div class="driver-stat">
                    <span class="driver-stat-value">${d.Podios ?? 0}</span>
                    <span class="driver-stat-label">Podios</span>
                </div>
            </div>
        </div>
    `).join("");
    
    // evento click
    document.querySelectorAll(".driver-card").forEach(card => {
        card.addEventListener("click", () => {
            const id = card.dataset.id;
            console.log("Ver piloto:", id);
            // aquí luego puedes abrir modal o redirigir
        });
    });

function formatName(name) {
    return name
        ?.toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase()) || "";
}
        
    } catch (err) {
        console.error("Pilotos:", err);
        grid.innerHTML = `<p class="empty-msg">Error al cargar pilotos.</p>`;
    }
}


// ════════════════════════════════════════════════════════════════
//  MODAL PRÓXIMA CARRERA
// ════════════════════════════════════════════════════════════════

const modal = document.getElementById("raceModal");
document.getElementById("btnNextRace").onclick   = () => modal.style.display = "flex";
document.getElementById("closeModal").onclick    = () => modal.style.display = "none";
document.getElementById("closeModalBtn").onclick = () => modal.style.display = "none";
window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };


// ════════════════════════════════════════════════════════════════
//  ARRANCAR
// ════════════════════════════════════════════════════════════════

async function init() {
    await Promise.all([
        loadRanking(),
        loadMejorTiempo(),
        loadUltimaCarrera(),
        loadPilotos()
    ]);
}

init();
