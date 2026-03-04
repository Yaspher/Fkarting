// ══════════════════════════════════════════════
//  FKarting - app.js
//  Solo consume el DAL y maneja el DOM
// ══════════════════════════════════════════════

import {
    getPodiumTop3,
    getRankingTop3,
    getPilotosTop6,
    getUltimaCarrera,
    getResultados,
    getPilotosActivos,
    getPilotosVista
} from './conection.js';


// ── Podio Top 3 ────────────────────────────────
async function loadPodium() {
    const container = document.getElementById("podiumContainer");
    try {
        const data = await getPodiumTop3();

        if (!data || data.length === 0) {
            container.innerHTML = "<p>Sin datos aún</p>";
            return;
        }

        // Orden visual: P2 - P1 - P3
        const positions = [data[1], data[0], data[2]];
        const classes   = ["p2", "p1", "p3"];
        const labels    = ["P2", "P1", "P3"];

        container.innerHTML = positions.map((d, i) => {
            if (!d) return "";
            return `
                <div class="podium-item ${classes[i]}">
                    <div class="podium-position">${labels[i]}</div>
                    <div class="podium-name">${d.nombre}</div>
                    <div class="podium-points">${d.total_puntos} pts</div>
                    <div class="podium-box">${labels[i].replace("P", "")}</div>
                </div>`;
        }).join("");

    } catch (err) {
        console.error("Podium:", err);
        container.innerHTML = "<p>Error al cargar podio</p>";
    }
}


// ── Ranking General ────────────────────────────
async function loadRanking() {
    const tbody = document.querySelector("#rankingTable tbody");
    try {
        const data = await getRankingTop3();

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding:20px">Sin datos aún</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((d, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${d.piloto?.nombre ?? "—"}</td>
                <td>${d.carreras}</td>
                <td>${d.puntos}</td>
            </tr>
        `).join("");

    } catch (err) {
        console.error("Ranking:", err);
        tbody.innerHTML = `<tr><td colspan="4">Error al cargar ranking</td></tr>`;
    }
}


// ── Última Carrera completada ──────────────────
async function loadUltimaCarrera() {
    const container = document.getElementById("resultsList");
    try {
        const carreras = await getUltimaCarrera();

        if (!carreras || carreras.length === 0) {
            container.innerHTML = "<p>No hay carreras completadas aún.</p>";
            return;
        }

        const carrera   = carreras[0];
        const fechaStr  = carrera.fecha
            ? new Date(carrera.fecha).toLocaleDateString("es-DO", {
                day: "numeric", month: "long", year: "numeric"
              })
            : "";

        const resultados = await getResultados(carrera.id_carrera);

        container.innerHTML = `
            <p style="margin-bottom:14px;opacity:.65;font-size:13px;letter-spacing:.5px;">
                📍 ${carrera.nombre}${carrera.circuito ? " · " + carrera.circuito : ""}
                ${fechaStr ? " · " + fechaStr : ""}
            </p>
            ${resultados.map(r =>
                `<p>${r.posicion}°&nbsp; ${r.piloto.nombre} — <strong>${r.puntos} pts</strong></p>`
            ).join("")}
        `;

    } catch (err) {
        console.error("Última carrera:", err);
        container.innerHTML = "<p>Error al cargar resultados.</p>";
    }
}


// ── Pilotos Destacados ─────────────────────────
async function loadPilotos() {
    const grid = document.getElementById("driversGrid");
    try {
        const data = await getPilotosVista();

        if (!data || data.length === 0) {
            grid.innerHTML = "<p>No hay pilotos registrados.</p>";
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
                        <span class="driver-stat-value">${d.Podios ?? 0}</span>
                        <span class="driver-stat-label">Podios</span>
                    </div>
                </div>
            </div>
        `).join("");

    } catch (err) {
        console.error("Pilotos:", err);
        grid.innerHTML = "<p>Error al cargar pilotos.</p>";
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
        loadPodium(),
        loadRanking(),
        loadUltimaCarrera(),
        loadPilotos()
    ]);
}

init();