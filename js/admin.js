// ══════════════════════════════════════════════════════════════
//  FKarting — admin.js
//  Secciones: Dashboard · Campeonatos · Pilotos · Carreras · Tiempos · Ranquin
// ══════════════════════════════════════════════════════════════

const SUPABASE_URL = "https://kgzqqaxhqcydrvzqnxmk.supabase.co";
const SUPABASE_KEY = "sb_publishable_svTNXiFYYvt9mZy1eXf_Gg_NXMoVvhg";

const sbHeaders = {
  "Content-Type":  "application/json",
  "apikey":        SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer":        "return=representation"
};

// ── Supabase helpers ───────────────────────────────────────────

async function sbGet(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: sbHeaders
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  "POST",
    headers: sbHeaders,
    body:    JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbPatch(table, id, idField, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${id}`, {
    method:  "PATCH",
    headers: sbHeaders,
    body:    JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbDelete(table, id, idField) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${id}`, {
    method:  "DELETE",
    headers: sbHeaders
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── Navegación ─────────────────────────────────────────────────

const sectionTitles = {
  dashboard:     "Panel Administrativo",
  championships: "Campeonatos",
  drivers:       "Pilotos",
  carreras:      "Carreras",
  tiempos:       "Tiempos",
  ranking:       "Ranquin"
};

document.querySelectorAll(".sidebar-item[data-section]").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-item").forEach(s => s.classList.remove("active"));
    item.classList.add("active");

    document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
    document.getElementById(item.dataset.section).classList.remove("hidden");

    document.getElementById("headerTitle").textContent =
      sectionTitles[item.dataset.section] || "";

    const section = item.dataset.section;
    if (section === "dashboard")     loadDashboard();
    if (section === "championships") loadChampionships();
    if (section === "drivers")       loadDrivers();
    if (section === "carreras")      loadCarrerasSection();
    if (section === "tiempos")       loadTiemposSection();
    if (section === "ranking")       loadRankingSection();
  });
});

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════

async function loadDashboard() {
  try {
    const [pilotos, campeonatos, rankingRows] = await Promise.all([
      sbGet("piloto",     "select=id_piloto"),
      sbGet("campeonato", "select=id_campeonato"),
      sbGet("ranking",    "select=id_ranking")
    ]);
    document.getElementById("statDriversVal").textContent  = pilotos.length;
    document.getElementById("statChampsVal").textContent   = campeonatos.length;
    document.getElementById("statRankingVal").textContent  = rankingRows.length;
  } catch (err) {
    console.error("Dashboard:", err);
  }
}

// ══════════════════════════════════════════════════════════════
//  CAMPEONATOS
// ══════════════════════════════════════════════════════════════

async function loadChampionships() {
  try {
    const data = await sbGet("campeonato", "order=ano.desc");
    document.getElementById("champCount").textContent =
      `${data.length} campeonato${data.length !== 1 ? "s" : ""} registrado${data.length !== 1 ? "s" : ""}`;

    document.getElementById("yearList").innerHTML = data.map(c => `
      <li>
        <span>
          ${c.ano}${c.descripcion ? " — " + c.descripcion : ""}
          ${c.activo ? '<em style="color:#27ae60;margin-left:6px">(activo)</em>' : ""}
        </span>
        <button class="del-btn" onclick="deleteChamp(${c.id_campeonato})" title="Eliminar">✕</button>
      </li>
    `).join("");
  } catch (err) {
    showMsg("saveMsgChamp", "❌ Error cargando campeonatos");
  }
}

document.getElementById("addYear").onclick = async () => {
  const ano  = parseInt(document.getElementById("yearInput").value);
  const desc = document.getElementById("champDesc").value.trim();
  if (!ano || isNaN(ano)) return showMsg("saveMsgChamp", "⚠️ Ingresa un año válido");
  try {
    await sbPost("campeonato", { ano, descripcion: desc || null, activo: true });
    document.getElementById("yearInput").value = "";
    document.getElementById("champDesc").value = "";
    await loadChampionships();
    await loadDashboard();
    showMsg("saveMsgChamp", "✅ Campeonato guardado");
  } catch (err) {
    const msg = err.message.includes("campeonato_ano_unique")
      ? "⚠️ Ya existe un campeonato para ese año"
      : "❌ Error al guardar";
    showMsg("saveMsgChamp", msg);
  }
};

async function deleteChamp(id) {
  if (!confirm("¿Eliminar este campeonato? Se borrarán sus datos de ranking.")) return;
  try {
    await sbDelete("campeonato", id, "id_campeonato");
    await loadChampionships();
    await loadDashboard();
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
}

// ══════════════════════════════════════════════════════════════
//  PILOTOS
// ══════════════════════════════════════════════════════════════

const iconEdit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const iconTrash = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;

async function loadDrivers() {
  try {
    const data = await sbGet("piloto", "order=numero.asc");
    document.getElementById("driverCount").textContent =
      `${data.length} piloto${data.length !== 1 ? "s" : ""} registrado${data.length !== 1 ? "s" : ""}`;

    const tbody = document.getElementById("driverList");

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--gray-600)">No hay pilotos registrados aún.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(d => {
      const activo = d.activo !== false;
      return `
        <tr>
          <td><span class="pilot-num">${d.numero ?? "—"}</span></td>
          <td><span class="pilot-name">${escAttr(d.nombre)}</span></td>
          <td>
            <span class="status-badge ${activo ? "active" : "inactive"}">
              <span class="status-badge-dot"></span>
              <span>${activo ? "Activo" : "Inactivo"}</span>
            </span>
          </td>
          <td>
            <div class="td-actions">
              <button class="action-btn" onclick="openDriverModal(${d.id_piloto})" title="Editar">${iconEdit}</button>
              <button class="action-btn danger" onclick="deleteDriver(${d.id_piloto})" title="Eliminar">${iconTrash}</button>
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

function openDriverModal(id = null) {
  document.getElementById("driverEditId").value  = id ?? "";
  document.getElementById("driverName").value    = "";
  document.getElementById("driverNumber").value  = "";
  document.getElementById("driverEstado").value  = "true";
  document.getElementById("driverModalTitle").textContent = id ? "Editar Piloto" : "Nuevo Piloto";

  if (id) {
    sbGet("piloto", `id_piloto=eq.${id}`).then(data => {
      if (!data.length) return;
      const d = data[0];
      document.getElementById("driverName").value   = d.nombre;
      document.getElementById("driverNumber").value = d.numero ?? "";
      document.getElementById("driverEstado").value = String(d.activo !== false);
    });
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

  if (!nombre) return showMsg("saveMsgDrivers", "⚠️ El nombre es obligatorio");

  const payload = { nombre, numero: isNaN(numero) ? null : numero, activo };

  try {
    if (editId) {
      await sbPatch("piloto", parseInt(editId), "id_piloto", payload);
      showMsg("saveMsgDrivers", "✅ Piloto actualizado");
    } else {
      await sbPost("piloto", payload);
      showMsg("saveMsgDrivers", "✅ Piloto guardado");
    }
    closeDriverModal();
    await loadDrivers();
    await loadDashboard();
  } catch (err) {
    const msg = err.message.includes("piloto_numero_key")
      ? "⚠️ Ese número ya está en uso"
      : "❌ Error al guardar piloto";
    showMsg("saveMsgDrivers", msg);
  }
};

async function deleteDriver(id) {
  if (!confirm("¿Eliminar este piloto?")) return;
  try {
    await sbDelete("piloto", id, "id_piloto");
    await loadDrivers();
    await loadDashboard();
    showMsg("saveMsgDrivers", "✅ Piloto eliminado");
  } catch (err) {
    alert("No se puede eliminar: tiene datos de ranking asociados.");
  }
}

// ══════════════════════════════════════════════════════════════
//  CARRERAS
// ══════════════════════════════════════════════════════════════

let _carrerasCampeonatoCache = [];

async function loadCarrerasSection() {
  try {
    _carrerasCampeonatoCache = await sbGet("campeonato", "order=ano.desc");
    const sel = document.getElementById("carrerasCampeonato");
    sel.innerHTML = _carrerasCampeonatoCache.length
      ? _carrerasCampeonatoCache.map(c =>
          `<option value="${c.id_campeonato}">${c.ano}${c.descripcion ? " — " + c.descripcion : ""}</option>`
        ).join("")
      : `<option value="">Sin campeonatos</option>`;

    if (_carrerasCampeonatoCache.length) {
      await loadCarrerasByCampeonato(_carrerasCampeonatoCache[0].id_campeonato);
    }
  } catch (err) {
    showMsg("saveMsgCarreras", "❌ Error cargando campeonatos");
  }
}

document.getElementById("carrerasCampeonato").addEventListener("change", async function () {
  if (this.value) await loadCarrerasByCampeonato(parseInt(this.value));
});

async function loadCarrerasByCampeonato(id_campeonato) {
  try {
    const data = await sbGet("carrera", `id_campeonato=eq.${id_campeonato}&order=fecha.asc`);
    const tbody = document.getElementById("carrerasList");

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No hay carreras para este campeonato.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(c => {
      const completada = c.completada;
      const fecha = c.fecha
        ? new Date(c.fecha + "T00:00:00").toLocaleDateString("es-DO", { day:"2-digit", month:"short", year:"numeric" })
        : "—";
      return `
        <tr>
          <td><span class="pilot-name">${escAttr(c.nombre)}</span></td>
          <td><span style="color:var(--gray-400);font-size:0.875rem">${escAttr(c.circuito ?? "—")}</span></td>
          <td><span class="created-at">${fecha}</span></td>
          <td>
            <span class="completada-badge ${completada ? "done" : "pending"}">
              ${completada ? "✓ Completada" : "● Pendiente"}
            </span>
          </td>
          <td>
            <div class="td-actions">
              <button class="action-btn" onclick="openCarreraModal(${c.id_carrera})" title="Editar">${iconEdit}</button>
              <button class="action-btn danger" onclick="deleteCarrera(${c.id_carrera})" title="Eliminar">${iconTrash}</button>
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

function openCarreraModal(id = null) {
  document.getElementById("carreraEditId").value       = id ?? "";
  document.getElementById("carreraNombre").value       = "";
  document.getElementById("carreraCircuito").value     = "";
  document.getElementById("carreraFecha").value        = "";
  document.getElementById("carreraCompletada").value   = "false";
  document.getElementById("carreraModalTitle").textContent = id ? "Editar Carrera" : "Nueva Carrera";

  if (id) {
    sbGet("carrera", `id_carrera=eq.${id}`).then(data => {
      if (!data.length) return;
      const c = data[0];
      document.getElementById("carreraNombre").value     = c.nombre;
      document.getElementById("carreraCircuito").value   = c.circuito ?? "";
      document.getElementById("carreraFecha").value      = c.fecha ?? "";
      document.getElementById("carreraCompletada").value = String(c.completada);
    });
  }

  document.getElementById("carreraModal").classList.remove("hidden");
}

function closeCarreraModal() {
  document.getElementById("carreraModal").classList.add("hidden");
}

document.getElementById("btnSaveCarrera").onclick = async () => {
  const editId      = document.getElementById("carreraEditId").value;
  const nombre      = document.getElementById("carreraNombre").value.trim();
  const circuito    = document.getElementById("carreraCircuito").value.trim();
  const fecha       = document.getElementById("carreraFecha").value;
  const completada  = document.getElementById("carreraCompletada").value === "true";
  const id_campeonato = parseInt(document.getElementById("carrerasCampeonato").value);

  if (!nombre) return showMsg("saveMsgCarreras", "⚠️ El nombre es obligatorio");

  const payload = {
    nombre,
    circuito: circuito || null,
    fecha: fecha || null,
    completada,
    id_campeonato
  };

  try {
    if (editId) {
      await sbPatch("carrera", parseInt(editId), "id_carrera", payload);
      showMsg("saveMsgCarreras", "✅ Carrera actualizada");
    } else {
      await sbPost("carrera", payload);
      showMsg("saveMsgCarreras", "✅ Carrera guardada");
    }
    closeCarreraModal();
    await loadCarrerasByCampeonato(id_campeonato);
  } catch (err) {
    showMsg("saveMsgCarreras", "❌ Error al guardar carrera");
    console.error(err);
  }
};

async function deleteCarrera(id) {
  if (!confirm("¿Eliminar esta carrera? Se borrarán también sus tiempos.")) return;
  try {
    await sbDelete("carrera", id, "id_carrera");
    const id_campeonato = parseInt(document.getElementById("carrerasCampeonato").value);
    await loadCarrerasByCampeonato(id_campeonato);
    showMsg("saveMsgCarreras", "✅ Carrera eliminada");
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
}

// ══════════════════════════════════════════════════════════════
//  TIEMPOS
//  — Inserción: tabla `tiempo`
//  — Visualización: vista `vista_tiempos` (VueltaRapida auto)
// ══════════════════════════════════════════════════════════════

async function loadTiemposSection() {
  try {
    const campeonatos = await sbGet("campeonato", "order=ano.desc");
    const selCamp = document.getElementById("tiemposCampeonato");
    selCamp.innerHTML = campeonatos.length
      ? campeonatos.map(c =>
          `<option value="${c.id_campeonato}">${c.ano}${c.descripcion ? " — " + c.descripcion : ""}</option>`
        ).join("")
      : `<option value="">Sin campeonatos</option>`;

    if (campeonatos.length) {
      await loadCarrerasForTiempos(campeonatos[0].id_campeonato);
    }
  } catch (err) {
    showMsg("saveMsgTiempos", "❌ Error cargando sección");
  }
}

async function loadCarrerasForTiempos(id_campeonato) {
  const carreras = await sbGet("carrera", `id_campeonato=eq.${id_campeonato}&order=fecha.asc`);
  const selCar = document.getElementById("tiemposCarrera");
  selCar.innerHTML = carreras.length
    ? carreras.map(c =>
        `<option value="${c.id_carrera}">${c.nombre}${c.fecha ? " · " + c.fecha : ""}</option>`
      ).join("")
    : `<option value="">Sin carreras en este campeonato</option>`;

  if (carreras.length) await loadTiemposByCarrera(carreras[0].id_carrera);
  else document.getElementById("tiemposList").innerHTML =
    `<tr><td colspan="4" class="table-empty">Sin carreras. Agrégalas en la sección Carreras.</td></tr>`;
}

document.getElementById("tiemposCampeonato").addEventListener("change", async function () {
  if (this.value) await loadCarrerasForTiempos(parseInt(this.value));
});

document.getElementById("tiemposCarrera").addEventListener("change", async function () {
  if (this.value) await loadTiemposByCarrera(parseInt(this.value));
});

async function loadTiemposByCarrera(id_carrera) {
  try {
    const [vistaData, pilotos] = await Promise.all([
      sbGet("vista_tiempos", `SecCarrera=eq.${id_carrera}&order=Tiempos.asc`),
      sbGet("piloto", "select=id_piloto,nombre,numero")
    ]);

    const pilotoMap = {};
    pilotos.forEach(p => { pilotoMap[p.id_piloto] = p; });

    const tbody = document.getElementById("tiemposList");

    if (!vistaData.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No hay tiempos registrados para esta carrera.</td></tr>`;
      return;
    }

    tbody.innerHTML = vistaData.map(t => {
      const piloto = pilotoMap[t.SecPiloto];
      const pilotoNombre = piloto
        ? `${piloto.numero ? "#" + piloto.numero + " " : ""}${piloto.nombre}`
        : `Piloto #${t.SecPiloto}`;

      return `
        <tr>
          <td><span class="pilot-name">${escAttr(pilotoNombre)}</span></td>
          <td><span class="tiempo-val">${formatInterval(t.Tiempos)}</span></td>
          <td>
            ${t.VueltaRapida
              ? `<span class="vuelta-rap-badge">🏁 Vuelta rápida</span>`
              : `<span style="color:var(--gray-600);font-size:0.8rem">—</span>`
            }
          </td>
          <td>
            <div class="td-actions">
              <button class="action-btn danger" onclick="deleteTiempo(${t.SecTiempo})" title="Eliminar">${iconTrash}</button>
            </div>
          </td>
        </tr>`;
    }).join("");
  } catch (err) {
    showMsg("saveMsgTiempos", "❌ Error cargando tiempos");
    console.error(err);
  }
}

// Convierte interval de Postgres a MM:SS.mmm legible
function formatInterval(interval) {
  if (!interval) return "—";
  const match = String(interval).match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return interval;
  const hh = parseInt(match[1]);
  const mm = parseInt(match[2]) + hh * 60;
  const ss = parseFloat(match[3]).toFixed(3);
  return `${String(mm).padStart(2, "0")}:${ss.padStart(6, "0")}`;
}

// Convierte MM:SS.mmm a interval Postgres
function toInterval(str) {
  str = str.trim();
  const match = str.match(/^(\d{1,2}):(\d{2})\.(\d{1,3})$/);
  if (!match) throw new Error("Formato inválido. Usa MM:SS.mmm (ej: 01:12.450)");
  const mm = match[1].padStart(2, "0");
  const ss = match[2];
  const ms = match[3].padEnd(3, "0");
  return `00:${mm}:${ss}.${ms}`;
}

// ── Modal Tiempos ──────────────────────────────────────────────

document.getElementById("btnNewTiempo").onclick         = () => openTiempoModal();
document.getElementById("btnCloseTiempoModal").onclick  = closeTiempoModal;
document.getElementById("btnCancelTiempoModal").onclick = closeTiempoModal;

document.getElementById("tiempoModal").addEventListener("click", e => {
  if (e.target === document.getElementById("tiempoModal")) closeTiempoModal();
});

async function openTiempoModal() {
  document.getElementById("tiempoEditId").value  = "";
  document.getElementById("tiempoValor").value   = "";
  document.getElementById("tiempoModalTitle").textContent = "Registrar Tiempo";

  try {
    const pilotos = await sbGet("piloto", "activo=eq.true&order=numero.asc");
    document.getElementById("tiempoPiloto").innerHTML = pilotos.map(p =>
      `<option value="${p.id_piloto}">#${p.numero ?? "—"} ${p.nombre}</option>`
    ).join("");
  } catch (e) {
    document.getElementById("tiempoPiloto").innerHTML = `<option>Error cargando pilotos</option>`;
  }

  document.getElementById("tiempoModal").classList.remove("hidden");
}

function closeTiempoModal() {
  document.getElementById("tiempoModal").classList.add("hidden");
}

document.getElementById("btnSaveTiempo").onclick = async () => {
  const id_piloto  = parseInt(document.getElementById("tiempoPiloto").value);
  const tiempoStr  = document.getElementById("tiempoValor").value.trim();
  const id_carrera = parseInt(document.getElementById("tiemposCarrera").value);

  if (!id_piloto || !id_carrera) return showMsg("saveMsgTiempos", "⚠️ Selecciona piloto y carrera");

  let tiempo_seg;
  try {
    tiempo_seg = toInterval(tiempoStr);
  } catch (e) {
    return showMsg("saveMsgTiempos", "⚠️ " + e.message);
  }

  try {
    await sbPost("tiempo", { id_piloto, id_carrera, tiempo_seg });
    showMsg("saveMsgTiempos", "✅ Tiempo registrado");
    closeTiempoModal();
    await loadTiemposByCarrera(id_carrera);
  } catch (err) {
    showMsg("saveMsgTiempos", "❌ Error al guardar tiempo");
    console.error(err);
  }
};

async function deleteTiempo(id) {
  if (!confirm("¿Eliminar este tiempo?")) return;
  try {
    await sbDelete("tiempo", id, "id_tiempo");
    const id_carrera = parseInt(document.getElementById("tiemposCarrera").value);
    await loadTiemposByCarrera(id_carrera);
    showMsg("saveMsgTiempos", "✅ Tiempo eliminado");
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
}

// ══════════════════════════════════════════════════════════════
//  RANQUIN
// ══════════════════════════════════════════════════════════════

let _campeonatosCache = [];

async function loadRankingSection() {
  try {
    _campeonatosCache = await sbGet("campeonato", "activo=eq.true&order=ano.desc");
    const sel = document.getElementById("rankingCampeonato");
    sel.innerHTML = _campeonatosCache.length
      ? _campeonatosCache.map(c =>
          `<option value="${c.id_campeonato}">${c.ano}${c.descripcion ? " — " + c.descripcion : ""}</option>`
        ).join("")
      : `<option value="">Sin campeonatos activos</option>`;

    if (_campeonatosCache.length > 0) {
      await loadRankingByCampeonato(_campeonatosCache[0].id_campeonato);
    } else {
      document.getElementById("rankingList").innerHTML =
        `<div class="rank-empty">No hay campeonatos activos. Crea uno en la sección Campeonatos.</div>`;
    }
  } catch (err) {
    showMsg("saveMsgRanking", "❌ Error cargando ranquin");
    console.error(err);
  }
}

document.getElementById("rankingCampeonato").addEventListener("change", async function () {
  if (this.value) await loadRankingByCampeonato(parseInt(this.value));
});

async function loadRankingByCampeonato(id_campeonato) {
  try {
    const data = await sbGet(
      "ranking",
      `id_campeonato=eq.${id_campeonato}&order=puntos.desc&select=id_ranking,puntos,carreras,victorias,podios,piloto(id_piloto,nombre,numero)`
    );

    const list = document.getElementById("rankingList");

    if (!data.length) {
      list.innerHTML = `<div class="rank-empty">No hay pilotos en este ranquin todavía.<br>Usa el botón "Agregar Piloto al Ranquin" para comenzar.</div>`;
      return;
    }

    list.innerHTML = data.map((r, i) => {
      const pos  = i + 1;
      const cls  = pos === 1 ? "rank-card-1" : pos === 2 ? "rank-card-2" : pos === 3 ? "rank-card-3" : "rank-card-n";
      const color = pos === 1 ? "var(--gold)" : pos === 2 ? "var(--silver)" : pos === 3 ? "var(--bronze)" : "var(--gray-500)";
      const nombre = r.piloto?.nombre ?? "—";
      const numero = r.piloto?.numero ?? "";

      return `
        <div class="rank-card ${cls}">
          <div class="rank-pos" style="color:${color}">${pos}</div>
          <div class="rank-info">
            <div class="rank-name">${numero ? `#${numero} ` : ""}${nombre}</div>
            <div class="rank-stats">
              <span class="rank-stat">${r.carreras} carrera${r.carreras !== 1 ? "s" : ""}</span>
              <span class="rank-stat-y">🏆 ${r.victorias} victoria${r.victorias !== 1 ? "s" : ""}</span>
              <span class="rank-stat-w">🥇 ${r.podios} podio${r.podios !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div class="rank-pts">
            <div class="rank-pts-num">${r.puntos}</div>
            <div class="rank-pts-label">pts</div>
          </div>
          <button class="rank-edit-btn" onclick="openRankingModal(${r.id_ranking}, ${r.piloto?.id_piloto}, '${escAttr(nombre)}', ${r.puntos}, ${r.carreras}, ${r.victorias}, ${r.podios})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="del-btn" onclick="deleteRanking(${r.id_ranking})" title="Eliminar">✕</button>
        </div>`;
    }).join("");

  } catch (err) {
    showMsg("saveMsgRanking", "❌ Error cargando datos");
    console.error(err);
  }
}

// ── Modal agregar/editar ranquin ───────────────────────────────

document.getElementById("btnAddRanking").onclick  = () => openRankingModal();
document.getElementById("btnCloseModal").onclick  = closeRankingModal;
document.getElementById("btnCancelModal").onclick = closeRankingModal;

function openRankingModal(id = null, id_piloto = null, nombre = "", puntos = 0, carreras = 0, victorias = 0, podios = 0) {
  const isEdit = id !== null;
  document.getElementById("rankingModalTitle").textContent = isEdit ? "Editar Ranquin" : "Agregar al Ranquin";
  document.getElementById("rankingEditId").value    = id ?? "";
  document.getElementById("rankingPuntos").value    = puntos;
  document.getElementById("rankingCarreras").value  = carreras;
  document.getElementById("rankingVictorias").value = victorias;
  document.getElementById("rankingPodios").value    = podios;

  _loadPilotosSelect(id_piloto);

  document.getElementById("rankingModal").classList.remove("hidden");
}

async function _loadPilotosSelect(selectedId = null) {
  try {
    const pilotos = await sbGet("piloto", "activo=eq.true&order=nombre.asc");
    document.getElementById("rankingPiloto").innerHTML =
      pilotos.map(p =>
        `<option value="${p.id_piloto}" ${p.id_piloto === selectedId ? "selected" : ""}>#${p.numero ?? "—"} ${p.nombre}</option>`
      ).join("");
  } catch (err) {
    document.getElementById("rankingPiloto").innerHTML = `<option value="">Error cargando pilotos</option>`;
  }
}

function closeRankingModal() {
  document.getElementById("rankingModal").classList.add("hidden");
}

document.getElementById("rankingModal").addEventListener("click", e => {
  if (e.target === document.getElementById("rankingModal")) closeRankingModal();
});

document.getElementById("btnSaveRanking").onclick = async () => {
  const editId     = document.getElementById("rankingEditId").value;
  const id_piloto  = parseInt(document.getElementById("rankingPiloto").value);
  const puntos     = parseInt(document.getElementById("rankingPuntos").value)    || 0;
  const carreras   = parseInt(document.getElementById("rankingCarreras").value)  || 0;
  const victorias  = parseInt(document.getElementById("rankingVictorias").value) || 0;
  const podios     = parseInt(document.getElementById("rankingPodios").value)    || 0;
  const id_campeonato = parseInt(document.getElementById("rankingCampeonato").value);

  if (!id_piloto || !id_campeonato) {
    return showMsg("saveMsgRanking", "⚠️ Selecciona un piloto y un campeonato");
  }

  try {
    if (editId) {
      await sbPatch("ranking", parseInt(editId), "id_ranking", { puntos, carreras, victorias, podios });
      showMsg("saveMsgRanking", "✅ Ranquin actualizado");
    } else {
      await sbPost("ranking", { id_campeonato, id_piloto, puntos, carreras, victorias, podios });
      showMsg("saveMsgRanking", "✅ Piloto agregado al ranquin");
    }
    closeRankingModal();
    await loadRankingByCampeonato(id_campeonato);
    await loadDashboard();
  } catch (err) {
    const msg = err.message.includes("ranking_unique")
      ? "⚠️ Este piloto ya está en el ranquin de este campeonato"
      : "❌ Error al guardar";
    showMsg("saveMsgRanking", msg);
    console.error(err);
  }
};

async function deleteRanking(id) {
  if (!confirm("¿Eliminar este piloto del ranquin?")) return;
  try {
    await sbDelete("ranking", id, "id_ranking");
    const id_campeonato = parseInt(document.getElementById("rankingCampeonato").value);
    await loadRankingByCampeonato(id_campeonato);
    await loadDashboard();
    showMsg("saveMsgRanking", "✅ Eliminado del ranquin");
  } catch (err) {
    alert("Error al eliminar: " + err.message);
  }
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════

function showMsg(id, text, ms = 4000) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.textContent = "", ms);
}

// Escapa comillas para usar en atributos HTML inline
function escAttr(s) {
  return String(s).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

document.getElementById("logout").onclick = () => {
  window.location.href = "index.html";
};

// ── Cargar al iniciar ──────────────────────────────────────────
loadDashboard();