// ══════════════════════════════════════════════
//  FKarting - app.js
// ══════════════════════════════════════════════

import {
    getRankingVista,
    getPilotosVista,
    getTiempoVista,
    getCarreraVista
} from './conection.js';


// ── Ranking General ────────────────────────────
async function loadRanking() {
    const container = document.getElementById("rankingList");
    try {
        const [ranking, pilotos] = await Promise.all([
            getRankingVista(),
            getPilotosVista()
        ]);

        if (!ranking || ranking.length === 0) {
            container.innerHTML = `<p class="empty-msg">Sin datos aún.</p>`;
            return;
        }

        const pilotoMap = Object.fromEntries(
            (pilotos ?? []).map(p => [p.Id, p])
        );

        const medals   = ["🥇", "🥈", "🥉"];
        const posClass = ["pos-gold", "pos-silver", "pos-bronze"];
        const maxPts   = ranking[0]?.Puntos ?? 1;

        // Alturas base: P1=280px, P2=210px, P3=160px
        const heights  = [280, 210, 160];

        // Orden visual: P2 — P1 — P3
        const orden = [1, 0, 2];

        const cols = orden.map(i => {
            const d = ranking[i];
            if (!d) return "";

            const piloto   = pilotoMap[d.Piloto];
            const nombre   = piloto?.Nombre ?? `Piloto #${d.Piloto}`;
            const numero   = piloto?.Numero ?? "—";
            const altura   = heights[i] ?? 140;
            const diff     = i === 0
                ? `<span style="color:var(--gold);font-weight:900">Líder</span>`
                : `-${maxPts - d.Puntos} pts`;

            return `
            <div class="ranking-col ${posClass[i]}">

                <div class="ranking-col-top">
                    <span class="ranking-col-medal">${medals[i]}</span>
                    <span class="ranking-col-name">${nombre}</span>
                    <span class="ranking-col-kart">#${numero}</span>
                </div>

                <div class="ranking-bar-wrap">
                    <div class="ranking-bar" style="height:${altura}px">
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

        container.innerHTML = cols ;

    } catch (err) {
        console.error("Ranking:", err);
        container.innerHTML = `<p class="empty-msg">Error al cargar ranking.</p>`;
    }
}

// ── Mejor Tiempo ───────────────────────────────
async function loadMejorTiempo() {
    const container = document.getElementById("mejorTiempoList");
    try {
        const data = await getTiempoVista();

        if (!data || data.length === 0) {
            container.innerHTML = `<p class="empty-msg">Sin tiempos registrados.</p>`;
            return;
        }

        const sorted = [...data].sort((a, b) => {
            const tA = a.Tiempos ?? "";
            const tB = b.Tiempos ?? "";
            return tA.localeCompare(tB);
        });

        container.innerHTML = sorted.map((d, i) => {
            const esRapida = d.VueltaRapida === true;
            return `
            <div class="tiempo-row ${esRapida ? "vuelta-rapida" : ""}">
                <div class="tiempo-pos">${i + 1}</div>
                <div class="tiempo-nombre">${d.NombrePiloto ?? "—"}</div>
                ${esRapida ? `<span class="tiempo-badge">⚡ Vuelta Rápida</span>` : ""}
                <div class="tiempo-valor">${formatTiempo(d.Tiempos)}</div>
            </div>`;
        }).join("");

    } catch (err) {
        console.error("Mejor Tiempo:", err);
        container.innerHTML = `<p class="empty-msg">Error al cargar tiempos.</p>`;
    }
}

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


// ── Última Carrera ─────────────────────────────
async function loadUltimaCarrera() {
    const container = document.getElementById("resultsList");
    try {
        const data = await getCarreraVista();

        if (!data || data.length === 0) {
            container.innerHTML = "<p class='empty-msg'>No hay carreras completadas aún.</p>";
            return;
        }

        // Todos los rows son de la misma carrera (RangoCarrera = 1)
        const { NombreCarrera, Circuito, Fecha } = data[0];

        const fechaStr = Fecha
            ? new Date(Fecha).toLocaleDateString("es-DO", {
                day: "numeric", month: "long", year: "numeric"
              })
            : "";

        const posClass = (pos) => {
            if (pos === 1) return "p1";
            if (pos === 2) return "p2";
            if (pos === 3) return "p3";
            return "px";
        };

        container.innerHTML = `
            <div class="carrera-meta">
                <span class="carrera-meta-icon">📍</span>
                <span>${NombreCarrera}${Circuito ? " · " + Circuito : ""}${fechaStr ? " · " + fechaStr : ""}</span>
            </div>
            ${data.map(r => `
                <div class="result-item">
                    <div class="result-pos ${posClass(r.Posicion)}">${r.Posicion}</div>
                    <div class="result-name">${r.NombrePiloto}</div>
                    <div class="result-pts">${r.Puntos}<span class="result-pts-label">pts</span></div>
                </div>
            `).join("")}
        `;

    } catch (err) {
        console.error("Última carrera:", err);
        container.innerHTML = "<p class='empty-msg'>Error al cargar resultados.</p>";
    }
}

// ── Pilotos Destacados ─────────────────────────
async function loadPilotos() {
    const grid = document.getElementById("driversGrid");
    try {
        const data = await getPilotosVista();

        if (!data || data.length === 0) {
            grid.innerHTML = "<p class='empty-msg'>No hay pilotos registrados.</p>";
            return;
        }

        grid.innerHTML = data.map(d => `
            <div class="driver-card">
                <div class="driver-num">#${d.Numero ?? "—"}</div>
                <div class="driver-name">${d.Nombre}</div>
                <div class="driver-stats">
                    <div class="driver-stat">
                        <span class="driver-stat-value">${d.Campeonato ?? 0}</span>
                        <span class="driver-stat-label">Campeonatos</span>
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

    } catch (err) {
        console.error("Pilotos:", err);
        grid.innerHTML = "<p class='empty-msg'>Error al cargar pilotos.</p>";
    }
}


// ── Modal Próxima Carrera ──────────────────────
const modal = document.getElementById("raceModal");
document.getElementById("btnNextRace").onclick   = () => modal.style.display = "flex";
document.getElementById("closeModal").onclick    = () => modal.style.display = "none";
document.getElementById("closeModalBtn").onclick = () => modal.style.display = "none";
window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };


// ── Arrancar ───────────────────────────────────
async function init() {
    await Promise.all([
        loadRanking(),
        loadMejorTiempo(),
        loadUltimaCarrera(),
        loadPilotos()
    ]);
}

init();