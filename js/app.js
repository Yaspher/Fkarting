// ══════════════════════════════════════════════
//  FKarting - app.js  (conectado a Supabase)
// ══════════════════════════════════════════════

const SUPABASE_URL = "https://kgzqqaxhqcydrvzqnxmk.supabase.co";
const SUPABASE_KEY = "sb_publishable_svTNXiFYYvt9mZy1eXf_Gg_NXMoVvhg";

const sbHeaders = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
};

// Helper GET
async function sbGet(table, params = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: sbHeaders });
    if (!res.ok) throw new Error(`Error ${res.status} en ${table}`);
    return res.json();
}

// ── Iniciar todo ───────────────────────────────
async function init() {
    await Promise.all([
        loadRanking(),
        loadUltimaCarrera(),
        loadPilotos()
    ]);
}

// ── Ranking General (usa la vista ranking_general) ──
async function loadRanking() {
    const tbody = document.querySelector("#rankingTable tbody");
    try {
        const data = await sbGet("ranking_general", "order=total_puntos.desc");

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="padding:20px">Sin datos aún</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((d, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${d.nombre}</td>
                <td>${d.carreras_corridas} carrera(s)</td>
                <td>${d.total_puntos}</td>
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
        // Carrera completada más reciente
        const carreras = await sbGet("carrera", "completada=eq.true&order=fecha.desc&limit=1");

        if (!carreras || carreras.length === 0) {
            container.innerHTML = "<p>No hay carreras completadas aún.</p>";
            return;
        }

        const carrera = carreras[0];
        const fechaStr = carrera.fecha
            ? new Date(carrera.fecha).toLocaleDateString("es-DO", { day:"numeric", month:"long", year:"numeric" })
            : "";

        // Resultados con nombre del piloto (join via select)
        const resultados = await sbGet(
            "resultado",
            `id_carrera=eq.${carrera.id_carrera}&order=posicion.asc&select=posicion,puntos,piloto(nombre)`
        );

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
        // Intentar con ranking (si ya hay resultados)
        const data = await sbGet("ranking_general", "order=total_puntos.desc&limit=6");

        if (data && data.length > 0) {
            grid.innerHTML = data.map((d, i) => `
                <div class="driver-card">
                    <h3>#${d.numero ?? i + 1}</h3>
                    <h4>${d.nombre}</h4>
                    <p>${d.total_puntos} puntos · ${d.carreras_corridas} carrera(s)</p>
                </div>
            `).join("");
        } else {
            // Fallback: pilotos registrados sin resultados aún
            const pilotos = await sbGet("piloto", "activo=eq.true&order=numero.asc");
            if (!pilotos || pilotos.length === 0) {
                grid.innerHTML = "<p>No hay pilotos registrados.</p>";
                return;
            }
            grid.innerHTML = pilotos.map(p => `
                <div class="driver-card">
                    <h3>#${p.numero ?? "—"}</h3>
                    <h4>${p.nombre}</h4>
                    <p>Sin resultados aún</p>
                </div>
            `).join("");
        }

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
init();