// ══════════════════════════════════════════════
//  FKarting — admin.js
//  Solo lógica UI · Todas las queries en connection.js
// ══════════════════════════════════════════════

import {
    // Dashboard
    getDashboardPilotos, getDashboardCampeonatos, getDashboardRanking,
    getCampeonatoActivo, getCarrerasByCampeonatoId, getRankingTop3ByCampeonato,
    getUltimaCarreraCompletada, getResultadosTop3, getResultadosCompletos, getPilotosActivosCount,
    // Campeonatos
    getCampeonatos, createCampeonato, updateCampeonato, deleteCampeonato,
    // Pilotos
    getPilotos, getPilotoById, getPilotosActivosAdmin, createPiloto, updatePiloto, deletePiloto,
    // Carreras
    getCampeonatosAdmin, getCarrerasByCampeonato, getCarreraById, createCarrera, updateCarrera, deleteCarrera,
    // Resultados
    getResultadosByCarrera, createResultado, updateResultado, deleteResultado,
    // Ranking
    getCampeonatosActivos, getRankingByCampeonato, createRanking, updateRanking, deleteRanking,
    // Puntos
    getTablaPuntos, upsertPuntosPosicion, initPuntosFila
} from './conection.js';


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


// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

// Convierte interval de Postgres "00:01:23.456" → "01:23.456"
function formatInterval(interval) {
    if (!interval) return "—";
    const match = String(interval).match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!match) return interval;
    const hh = parseInt(match[1]);
    const mm = parseInt(match[2]) + hh * 60;
    const ss = parseFloat(match[3]).toFixed(3);
    return `${String(mm).padStart(2, "0")}:${ss.padStart(6, "0")}`;
}

// Convierte "MM:SS.mmm" → interval Postgres "00:MM:SS.mmm"
function toInterval(str) {
    str = str.trim();
    const match = str.match(/^(\d{1,2}):(\d{2})\.(\d{1,3})$/);
    if (!match) throw new Error("Formato inválido. Usa MM:SS.mmm (ej: 01:12.450)");
    const mm = parseInt(match[1]);
    const ss = parseInt(match[2]);
    const ms = match[3].padEnd(3, "0");
    if (ss > 59) throw new Error("Los segundos no pueden ser mayores a 59");
    if (mm > 99) throw new Error("Los minutos no pueden ser mayores a 99");
    return `00:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${ms}`;
}

// Convierte interval Postgres a segundos (para comparar tiempos)
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
    return String(s).replace(/'/g, "\\'").replace(/"/g, "&quot;");
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

document.getElementById("logout").onclick = () => { window.location.href = "index.html"; };


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

        // ── Progreso del campeonato ───────────────────────
        const carreras    = await getCarrerasByCampeonatoId(camp.id_campeonato);
        const completadas = carreras.filter(c => c.completada).length;
        const pct         = carreras.length ? Math.round((completadas / carreras.length) * 100) : 0;

        document.getElementById("dashCampeonatoBody").innerHTML = `
            <div class="dash-champ-name">${camp.camp_ano}</div>
            <div class="dash-champ-desc">${camp.camp_descripcion ?? "Sin descripción"}</div>
            <div class="progress-wrap">
                <div class="progress-label">
                    <span>${completadas} de ${carreras.length} carreras completadas</span>
                    <span style="color:var(--red-500);font-weight:700">${pct}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${pct}%"></div>
                </div>
            </div>`;

        // ── Top 3 ranking ─────────────────────────────────
        const top3 = await getRankingTop3ByCampeonato(camp.id_campeonato);
        if (top3.length) {
            const colors = ["var(--gold)", "var(--silver)", "var(--bronze)"];
            const clases = ["p1", "p2", "p3"];
            const emojis = ["🥇", "🥈", "🥉"];
            document.getElementById("dashTop3Body").innerHTML = `
                <div class="dash-podium">
                    ${top3.map((r, i) => {
                        const nombre = r.piloto?.pilo_nombre ?? "—";
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

        // ── Última carrera ────────────────────────────────
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

        // Podio última carrera
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
                    const nombre = r.piloto?.pilo_nombre ?? "—";
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

        // Vuelta más rápida
        const conTiempo = resultadosAll.filter(r => r.res_tiempo_seg && intervalToSeconds(r.res_tiempo_seg) > 0);
        if (conTiempo.length) {
            const rapido = conTiempo.reduce((best, r) =>
                intervalToSeconds(r.res_tiempo_seg) < intervalToSeconds(best.res_tiempo_seg) ? r : best
            );
            const nombre = rapido.piloto?.pilo_nombre ?? "—";
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

        // Más vueltas
        const conVueltas = resultadosAll.filter(r => r.res_vueltas > 0);
        if (conVueltas.length) {
            const lider  = conVueltas.reduce((best, r) => r.res_vueltas > best.res_vueltas ? r : best);
            const nombre = lider.piloto?.pilo_nombre ?? "—";
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
//  Campos: camp_ano, camp_descripcion, camp_activo
// ════════════════════════════════════════════════════════════════

async function loadChampionships() {
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

// ── Modal Campeonatos ──────────────────────────────────────────

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
window.openChampModal = openChampModal;

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
window.handleDeleteChamp = handleDeleteChamp;


// ════════════════════════════════════════════════════════════════
//  PILOTOS
//  Campos: pilo_nombre, pilo_numero, pilo_activo
// ════════════════════════════════════════════════════════════════

async function loadDrivers() {
    try {
        const data = await getPilotos();
        document.getElementById("driverCount").textContent =
            `${data.length} piloto${data.length !== 1 ? "s" : ""} registrado${data.length !== 1 ? "s" : ""}`;

        const tbody = document.getElementById("driverList");
        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--gray-600)">No hay pilotos registrados aún.</td></tr>`;
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

// ── Modal Pilotos ──────────────────────────────────────────────

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
    document.getElementById("driverModalTitle").textContent = id ? "Editar Piloto" : "Nuevo Piloto";

    if (id) {
        const data = await getPilotoById(id);
        if (data.length) {
            const d = data[0];
            document.getElementById("driverName").value   = d.pilo_nombre;
            document.getElementById("driverNumber").value = d.pilo_numero ?? "";
            document.getElementById("driverEstado").value = String(d.pilo_activo !== false);
        }
    }
    document.getElementById("driverModal").classList.remove("hidden");
}
window.openDriverModal = openDriverModal;

function closeDriverModal() {
    document.getElementById("driverModal").classList.add("hidden");
}

document.getElementById("btnSaveDriver").onclick = async () => {
    const editId = document.getElementById("driverEditId").value;
    const nombre = document.getElementById("driverName").value.trim();
    const numero = parseInt(document.getElementById("driverNumber").value);
    const activo = document.getElementById("driverEstado").value === "true";

    if (!nombre) return showMsg("saveMsgDrivers", "⚠️ El nombre es obligatorio");

    const payload = { nombre, numero: isNaN(numero) ? null : numero, activo };

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
        await loadDashboard();
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
        await loadDashboard();
        showMsg("saveMsgDrivers", "✅ Piloto eliminado");
    } catch (err) {
        alert("No se puede eliminar: tiene datos de ranking asociados.");
    }
}
window.handleDeleteDriver = handleDeleteDriver;


// ════════════════════════════════════════════════════════════════
//  CARRERAS
// ════════════════════════════════════════════════════════════════

async function loadCarrerasSection() {
    try {
        const campeonatos = await getCampeonatosAdmin();
        const sel = document.getElementById("carrerasCampeonato");
        sel.innerHTML = campeonatos.length
            ? campeonatos.map(c =>
                `<option value="${c.id_campeonato}">${c.camp_ano}${c.camp_descripcion ? " — " + c.camp_descripcion : ""}</option>`
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

// ── Modal Carreras ─────────────────────────────────────────────

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
window.openCarreraModal = openCarreraModal;

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
window.handleDeleteCarrera = handleDeleteCarrera;


// ════════════════════════════════════════════════════════════════
//  RESULTADOS
//  Campos: res_posicion, res_puntos, res_tiempo_seg, res_vueltas
// ════════════════════════════════════════════════════════════════

async function loadResultadosSection() {
    try {
        const campeonatos = await getCampeonatosAdmin();
        const selCamp = document.getElementById("resultadosCampeonato");
        selCamp.innerHTML = campeonatos.length
            ? campeonatos.map(c =>
                `<option value="${c.id_campeonato}">${c.camp_ano}${c.camp_descripcion ? " — " + c.camp_descripcion : ""}</option>`
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
            `<option value="${c.id_carrera}">${c.nombre}${c.fecha ? " · " + c.fecha : ""}</option>`
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
    try {
        const data  = await getResultadosByCarrera(id_carrera);
        const tbody = document.getElementById("resultadosList");

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No hay resultados registrados para esta carrera.</td></tr>`;
            return;
        }

        // Calcular vuelta rápida: menor res_tiempo_seg (ignorar nulos y ceros)
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
            const nombre     = r.piloto ? `${r.piloto.pilo_numero ? "#" + r.piloto.pilo_numero + " " : ""}${r.piloto.pilo_nombre}` : "—";
            const esVueltaRap = minId !== null && r.id_resultado === minId;
            return `
                <tr>
                    <td>
                        <span class="pos-badge pos-${r.res_posicion <= 3 ? r.res_posicion : "n"}">${r.res_posicion}</span>
                    </td>
                    <td><span class="pilot-name">${escAttr(nombre)}</span></td>
                    <td><span class="stat-pill stat-win">${r.res_puntos} pts</span></td>
                    <td><span style="color:var(--gray-400);font-size:0.875rem">${r.res_vueltas ?? "—"}</span></td>
                    <td><span class="tiempo-val">${r.res_tiempo_seg ? formatInterval(r.res_tiempo_seg) : "—"}</span></td>
                    <td>
                        ${esVueltaRap
                            ? `<span class="vuelta-rap-badge">🏁 Rápida</span>`
                            : `<span style="color:var(--gray-700);font-size:0.8rem">—</span>`}
                    </td>
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

// ── Modal Resultados ───────────────────────────────────────────

document.getElementById("btnNewResultado").onclick         = () => openResultadoModal();
document.getElementById("btnCloseResultadoModal").onclick  = closeResultadoModal;
document.getElementById("btnCancelResultadoModal").onclick = closeResultadoModal;
document.getElementById("resultadoModal").addEventListener("click", e => {
    if (e.target === document.getElementById("resultadoModal")) closeResultadoModal();
});

// Carga posiciones libres en el select; en edición deja libre la posición actual
async function cargarPosicionesDisponibles(id_carrera, posicionActual = null) {
    const sel = document.getElementById("resultadoPosicion");
    try {
        const data    = await getResultadosByCarrera(id_carrera);
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

    // Cargar pilotos
    try {
        const pilotos = await getPilotosActivosAdmin();
        document.getElementById("resultadoPiloto").innerHTML =
            `<option value="">Seleccionar piloto...</option>` +
            pilotos.map(p =>
                `<option value="${p.id_piloto}">${p.pilo_numero ? "#" + p.pilo_numero + " " : ""}${p.pilo_nombre}</option>`
            ).join("");
    } catch (e) {
        document.getElementById("resultadoPiloto").innerHTML = `<option value="">Error cargando pilotos</option>`;
    }

    if (id) {
        // Modo edición: prefill
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
        // Modo nuevo: verificar que haya posiciones libres
        const hayDisponibles = await cargarPosicionesDisponibles(id_carrera);
        if (!hayDisponibles) {
            showMsg("saveMsgResultados", "⚠️ Esta carrera ya tiene los 12 resultados registrados");
            return;
        }
    }

    document.getElementById("resultadoModal").classList.remove("hidden");
}
window.openResultadoModal = openResultadoModal;

// Auto-asignar puntos al seleccionar posición
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
window.handleDeleteResultado = handleDeleteResultado;


// ════════════════════════════════════════════════════════════════
//  TABLA DE PUNTOS
//  id_tablapuntosbase = posición (1–12) | tpb_puntos = puntos
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
    const mapaExistente = {};
    data.forEach(r => { mapaExistente[r.id_tablapuntosbase] = r.tpb_puntos ?? 0; });

    tbody.innerHTML = Array.from({ length: 12 }, (_, i) => {
        const pos    = i + 1;
        const puntos = mapaExistente[pos] ?? "—";
        const existe = Object.prototype.hasOwnProperty.call(mapaExistente, pos);
        return `
            <tr id="puntos-row-${pos}">
                <td><span class="pos-badge pos-${pos <= 3 ? pos : "n"}">${pos}</span></td>
                <td><span style="color:var(--gray-400);font-size:0.875rem">${POSICION_LABELS[pos]}</span></td>
                <td id="puntos-val-${pos}">
                    <span class="stat-pill stat-win">${puntos} pts</span>
                </td>
                <td>
                    <div class="td-actions">
                        <button class="action-btn" onclick="editPuntosFila(${pos}, ${existe ? mapaExistente[pos] : 0})" title="Editar">${iconEdit}</button>
                    </div>
                </td>
            </tr>`;
    }).join("");
}

// Edición inline de una fila
function editPuntosFila(pos, valorActual) {
    const cell = document.getElementById(`puntos-val-${pos}`);
    cell.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center">
            <input
                type="number"
                id="puntosInput-${pos}"
                class="form-input"
                value="${valorActual}"
                min="0"
                style="width:80px;padding:5px 8px"
                onkeydown="if(event.key==='Enter') savePuntosFila(${pos}); if(event.key==='Escape') loadPuntosSection();"
            >
            <button class="btn-primary" style="padding:5px 12px;font-size:0.75rem" onclick="savePuntosFila(${pos})">✓</button>
            <button class="btn-ghost"   style="padding:5px 10px;font-size:0.75rem" onclick="loadPuntosSection()">✕</button>
        </div>`;
    document.getElementById(`puntosInput-${pos}`).focus();
}
window.editPuntosFila = editPuntosFila;

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
window.savePuntosFila = savePuntosFila;


// ════════════════════════════════════════════════════════════════
//  RANKING
//  Campos: ran_puntos, ran_carreras, ran_victorias, ran_podios
// ════════════════════════════════════════════════════════════════

async function loadRankingSection() {
    try {
        const campeonatos = await getCampeonatosActivos();
        const sel = document.getElementById("rankingCampeonato");
        sel.innerHTML = campeonatos.length
            ? campeonatos.map(c =>
                `<option value="${c.id_campeonato}">${c.camp_ano}${c.camp_descripcion ? " — " + c.camp_descripcion : ""}</option>`
              ).join("")
            : `<option value="">Sin campeonatos activos</option>`;

        if (campeonatos.length) await loadRankingList(campeonatos[0].id_campeonato);
        else document.getElementById("rankingList").innerHTML =
            `<div class="rank-empty">No hay campeonatos activos. Crea uno en la sección Campeonatos.</div>`;
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
            list.innerHTML = `<div class="rank-empty">No hay pilotos en este ranquin todavía.<br>Usa el botón "Agregar Piloto al Ranquin" para comenzar.</div>`;
            return;
        }

        list.innerHTML = data.map((r, i) => {
            const pos    = i + 1;
            const cls    = pos === 1 ? "rank-card-1" : pos === 2 ? "rank-card-2" : pos === 3 ? "rank-card-3" : "rank-card-n";
            const color  = pos === 1 ? "var(--gold)" : pos === 2 ? "var(--silver)" : pos === 3 ? "var(--bronze)" : "var(--gray-500)";
            const nombre = r.piloto?.pilo_nombre ?? "—";
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
                    <button class="rank-edit-btn" onclick="openRankingModal(${r.id_ranking}, ${r.piloto?.id_piloto}, '${escAttr(nombre)}', ${r.ran_puntos}, ${r.ran_carreras}, ${r.ran_victorias}, ${r.ran_podios})" title="Editar">
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

// ── Modal Ranking ──────────────────────────────────────────────

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
                ${p.pilo_numero ? "#" + p.pilo_numero + " " : ""}${p.pilo_nombre}
            </option>`
        ).join("");
    } catch (err) {
        document.getElementById("rankingPiloto").innerHTML = `<option value="">Error cargando pilotos</option>`;
    }
    document.getElementById("rankingModal").classList.remove("hidden");
}
window.openRankingModal = openRankingModal;

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
window.handleDeleteRanking = handleDeleteRanking;


// ════════════════════════════════════════════════════════════════
//  ARRANCAR
// ════════════════════════════════════════════════════════════════

loadDashboard();