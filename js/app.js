
import {
    getRankingVista,
    getPilotosVista,
    getTiempoVista,
    getCarreraVista,
    VERSION
} from './connection.js';

document.querySelectorAll('[data-version]')
  .forEach(el => el.textContent = VERSION);
  
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

// Lee un campo probando múltiples variantes de nombre
function field(row, ...keys) {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) return row[k];
        const lower = k.toLowerCase();
        if (row[lower] !== undefined && row[lower] !== null) return row[lower];
    }
    return null;
}

// Capitaliza cada palabra
function formatName(name) {
    return name?.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) || "";
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
                        <span class="col-stat-val">${d.Victorias ?? 0}</span>
                        <span class="col-stat-lbl">WIN</span>
                    </div>
                    <div class="ranking-col-stat">
                        <span class="col-stat-val">${d.Podios ?? 0}</span>
                        <span class="col-stat-lbl">POLES</span>
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

        const sorted = [...data].sort((a, b) =>
            intervalToSec(field(a, "Tiempos", "tiempos"))
          - intervalToSec(field(b, "Tiempos", "tiempos"))
        );

        container.innerHTML = sorted.map((d, i) => {
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
        console.error("Mejor Tiempo:", err);
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

        // Ordenar en JS — evita problemas de case-sensitivity en order= de PostgREST
        data.sort((a, b) => {
            const fa = field(a, "Fecha", "fecha") ?? "";
            const fb = field(b, "Fecha", "fecha") ?? "";
            if (fb > fa) return 1;
            if (fb < fa) return -1;
            return (parseInt(field(a, "posicion", "Posicion")) || 0)
                 - (parseInt(field(b, "posicion", "Posicion")) || 0);
        });

        const ultimaId   = data[0].id_carrera;
        const resultados = data.filter(r => r.id_carrera == ultimaId);

        if (!resultados.length) {
            container.innerHTML = `<p class="empty-msg">No hay resultados para la última carrera.</p>`;
            return;
        }

        const nombre   = field(resultados[0], "nombre",   "Nombre");
        const circuito = field(resultados[0], "circuito", "Circuito");
        const fecha    = field(resultados[0], "Fecha",    "fecha");

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
                const posicion   = field(r, "posicion",     "Posicion");
                const piloNombre = field(r, "NombrePiloto", "pilo_nombre", "pilonombre");
                const puntos     = field(r, "puntos",       "Puntos");
                const posNum     = parseInt(posicion);
                return `
                <div class="result-item${posNum === 1 ? " pos-winner" : ""}">
                    <div class="result-pos ${posClass(posicion)}">${posicion ?? "—"}</div>
                    <div class="result-name">${piloNombre ?? "—"}</div>
                    <div class="result-pts">${puntos ?? 0}<span class="result-pts-label">pts</span></div>
                </div>`;
            }).join("")}
        `;

    } catch (err) {
        console.error("Última carrera:", err);
        container.innerHTML = `<p class="empty-msg">Error al cargar resultados.<br><small style="opacity:.5;font-size:.75rem">${err.message}</small></p>`;
    }
}


// ════════════════════════════════════════════════════════════════
//  PILOTOS DESTACADOS
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
                        <span class="driver-stat-label-WDC">WDC</span>
                    </div>
                    <div class="driver-stat-divider"></div>
                    <div class="driver-stat">
                        <span class="driver-stat-value">${d.Victorias ?? 0}</span>
                        <span class="driver-stat-label">WIN</span>
                    </div>
                    <div class="driver-stat-divider"></div>
                    <div class="driver-stat">
                        <span class="driver-stat-value">${d.Podios ?? 0}</span>
                        <span class="driver-stat-label">POLES</span>
                    </div>
                </div>
            </div>
        `).join("");

        document.querySelectorAll(".driver-card").forEach(card => {
            const id = card.dataset.id;
            const pilot = data.find(p => String(p.Id) === String(id));
            card.addEventListener("click", () => {
                if (pilot) openPilotoModal(pilot);
                else console.log("Ver piloto:", id);
            });
        });

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
//  MODAL PILOTO — apertura, carga de historial y cierre
// ════════════════════════════════════════════════════════════════
const pilotoModal = document.getElementById("pilotoModal");
const pilotoModalTitle = document.getElementById("pilotoModalTitle");
const pilotoMeta = document.getElementById("pilotoMeta");
const pilotoHistory = document.getElementById("pilotoHistory");
const closePilotoModalBtn = document.getElementById("closePilotoModalBtn");
const closePilotoModalX = document.getElementById("closePilotoModal");

function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function openPilotoModal(pilot) {
    if (!pilotoModal) return;
    pilotoModal.style.display = "flex";
    pilotoModalTitle.textContent = (pilot.Nombre ? formatName(pilot.Nombre) : 'Piloto') + (pilot.Numero ? ` · #${pilot.Numero}` : '');

    pilotoMeta.innerHTML = `
      <div class="driver-stats" style="display:flex;gap:12px;width:100%;justify-content:space-between;padding:6px 0">
        <div class="driver-stat" style="text-align:left">
          <div class="driver-stat-value">${pilot.Campeonato ?? 0}</div>
          <div class="driver-stat-label-WDC">WDC</div>
        </div>
        <div class="driver-stat" style="text-align:center">
          <div class="driver-stat-value">${pilot.Victorias ?? 0}</div>
          <div class="driver-stat-label">Wins</div>
        </div>
        <div class="driver-stat" style="text-align:right">
          <div class="driver-stat-value">${pilot.Podios ?? 0}</div>
          <div class="driver-stat-label">Podios</div>
        </div>
      </div>
    `;

    pilotoHistory.innerHTML = `<p class="empty-msg" style="opacity:.6">Cargando historial...</p>`;

    try {
        const data = await getCarreraVista();
        const matches = (data || []).filter(r => {
            const nombre = field(r, "NombrePiloto", "nombrepiloto", "nombre_piloto") || '';
            return String(nombre).trim().toLowerCase() === String(pilot.Nombre ?? '').trim().toLowerCase();
        });

        if (!matches.length) {
            pilotoHistory.innerHTML = `<p class="empty-msg">Este piloto aún no tiene historial registrado.</p>`;
            return;
        }

        matches.sort((a, b) => {
            const fa = field(a, "Fecha", "fecha") || '';
            const fb = field(b, "Fecha", "fecha") || '';
            if (fb > fa) return 1;
            if (fb < fa) return -1;
            return (parseInt(field(a, "posicion", "Posicion")) || 0) - (parseInt(field(b, "posicion", "Posicion")) || 0);
        });

        pilotoHistory.innerHTML = matches.map(m => {
            const fecha = field(m, "Fecha", "fecha");
            const fechaStr = fecha ? new Date(fecha).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" }) : '';
            const carreraNombre = field(m, "nombre", "Nombre") ?? '';
            const circuito = field(m, "circuito", "Circuito") ?? '';
            const posicion = field(m, "posicion", "Posicion") ?? '—';
            const puntos = field(m, "puntos", "Puntos") ?? 0;

            return `
            <div class="pilot-history-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.03)">
                <div style="flex:1;min-width:0;padding-right:12px">
                    <div class="pilot-history-carrera" style="font-weight:700;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(carreraNombre)}${circuito ? ' · ' + escapeHtml(circuito) : ''}</div>
                    <div class="pilot-history-fecha" style="font-size:0.85rem;color:var(--gray-600)">${fechaStr}</div>
                </div>
                <div style="text-align:right;min-width:84px">
                    <div class="pilot-history-pos" style="font-weight:900;font-family:var(--font-display);">${posicion}</div>
                    <div class="pilot-history-pts" style="color:var(--red-500);font-weight:700">${puntos} pts</div>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error("Historial piloto:", err);
        pilotoHistory.innerHTML = `<p class="empty-msg">Error al cargar historial.<br><small style="opacity:.6">${escapeHtml(err.message || String(err))}</small></p>`;
    }
}

function closePilotoModal() {
    if (!pilotoModal) return;
    pilotoModal.style.display = "none";
}

closePilotoModalBtn?.addEventListener("click", closePilotoModal);
closePilotoModalX?.addEventListener("click", closePilotoModal);
pilotoModal?.addEventListener("click", e => { if (e.target === pilotoModal) closePilotoModal(); });


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