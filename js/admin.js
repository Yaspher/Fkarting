// ══════════════════════════════════════════════
//  FKarting - admin.js  (conectado a Supabase)
// ══════════════════════════════════════════════

const SUPABASE_URL = "https://kgzqqaxhqcydrvzqnxmk.supabase.co";
const SUPABASE_KEY = "sb_publishable_svTNXiFYYvt9mZy1eXf_Gg_NXMoVvhg";

const sbHeaders = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Prefer": "return=representation"
};

async function sbGet(table, params = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
        headers: sbHeaders
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function sbPost(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: sbHeaders,
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function sbDelete(table, id, idField) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${id}`, {
        method: "DELETE",
        headers: sbHeaders
    });
    if (!res.ok) throw new Error(await res.text());
}

// ── Navegación del sidebar ─────────────────────
document.querySelectorAll(".sidebar li[data-section]").forEach(item => {
    item.addEventListener("click", () => {
        document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
        document.getElementById(item.dataset.section).classList.remove("hidden");
        // Recargar sección activa
        const section = item.dataset.section;
        if (section === "championships") loadChampionships();
        if (section === "drivers")       loadDrivers();
        if (section === "results")       loadResultsAdmin();
        if (section === "dashboard")     loadDashboard();
    });
});

// ══════════════════════════════
//  DASHBOARD
// ══════════════════════════════
async function loadDashboard() {
    try {
        const [pilotos, campeonatos, resultados] = await Promise.all([
            sbGet("piloto",     "select=id_piloto"),
            sbGet("campeonato", "select=id_campeonato"),
            sbGet("resultado",  "select=id_resultado")
        ]);
        document.getElementById("statDrivers").textContent = `Pilotos: ${pilotos.length}`;
        document.getElementById("statChamps").textContent  = `Campeonatos: ${campeonatos.length}`;
        document.getElementById("statResults").textContent = `Resultados: ${resultados.length}`;
    } catch (err) { console.error("Dashboard:", err); }
}

// ══════════════════════════════
//  CAMPEONATOS
// ══════════════════════════════
async function loadChampionships() {
    try {
        const data = await sbGet("campeonato", "order=ano.desc");
        document.getElementById("yearList").innerHTML = data.map(c => `
            <li>
                <span>${c.ano}${c.descripcion ? " — " + c.descripcion : ""}
                    ${c.activo ? ' <em style="color:#27ae60">(activo)</em>' : ""}
                </span>
                <button class="del-btn" onclick="deleteChamp(${c.id_campeonato})">✕</button>
            </li>
        `).join("");
    } catch (err) { showMsg("saveMsgChamp", "❌ Error cargando campeonatos"); }
}

document.getElementById("addYear").onclick = async () => {
    const ano = parseInt(document.getElementById("yearInput").value);
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
    if (!confirm("¿Eliminar este campeonato? Se borrarán sus carreras y resultados.")) return;
    try {
        await sbDelete("campeonato", id, "id_campeonato");
        await loadChampionships();
        await loadDashboard();
    } catch (err) { alert("Error al eliminar: " + err.message); }
}

// ══════════════════════════════
//  PILOTOS
// ══════════════════════════════
async function loadDrivers() {
    try {
        const data = await sbGet("piloto", "order=numero.asc");
        document.getElementById("driverList").innerHTML = data.map(d => `
            <li>
                <span>#${d.numero ?? "—"} ${d.nombre}
                    ${!d.activo ? ' <em style="color:#999">(inactivo)</em>' : ""}
                </span>
                <button class="del-btn" onclick="deleteDriver(${d.id_piloto})">✕</button>
            </li>
        `).join("");
    } catch (err) { showMsg("saveMsgDrivers", "❌ Error cargando pilotos"); }
}

document.getElementById("addDriver").onclick = async () => {
    const nombre = document.getElementById("driverName").value.trim();
    const numero = parseInt(document.getElementById("driverNumber").value);
    if (!nombre) return showMsg("saveMsgDrivers", "⚠️ El nombre es obligatorio");
    try {
        await sbPost("piloto", { nombre, numero: isNaN(numero) ? null : numero, activo: true });
        document.getElementById("driverName").value   = "";
        document.getElementById("driverNumber").value = "";
        await loadDrivers();
        await loadDashboard();
        showMsg("saveMsgDrivers", "✅ Piloto guardado");
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
    } catch (err) { alert("No se puede eliminar: tiene resultados asociados."); }
}

// ══════════════════════════════
//  RESULTADOS
// ══════════════════════════════
async function loadResultsAdmin() {
    try {
        // Cargar pilotos y campeonatos para los selects
        const [pilotos, campeonatos] = await Promise.all([
            sbGet("piloto",     "activo=eq.true&order=nombre.asc"),
            sbGet("campeonato", "activo=eq.true&order=ano.desc")
        ]);

        document.getElementById("resultPiloto").innerHTML =
            pilotos.map(p => `<option value="${p.id_piloto}">${p.nombre}</option>`).join("");

        document.getElementById("resultCampeonato").innerHTML =
            campeonatos.map(c => `<option value="${c.id_campeonato}">${c.ano}</option>`).join("");

        // Cargar carreras del primer campeonato
        if (campeonatos.length > 0) await loadCarrerasSelect(campeonatos[0].id_campeonato);

        // Resultados guardados
        const resultados = await sbGet(
            "resultado",
            "order=id_carrera.desc,posicion.asc&select=id_resultado,posicion,puntos,piloto(nombre),carrera(nombre)"
        );

        document.getElementById("resultList").innerHTML = resultados.map(r => `
            <li>
                <span>${r.posicion}° ${r.piloto.nombre} — ${r.puntos} pts
                    <em style="opacity:.6;font-size:12px"> (${r.carrera.nombre})</em>
                </span>
                <button class="del-btn" onclick="deleteResult(${r.id_resultado})">✕</button>
            </li>
        `).join("");

    } catch (err) { console.error("Results:", err); }
}

async function loadCarrerasSelect(id_campeonato) {
    const carreras = await sbGet("carrera", `id_campeonato=eq.${id_campeonato}&order=fecha.asc`);
    document.getElementById("resultCarrera").innerHTML =
        carreras.map(c => `<option value="${c.id_carrera}">${c.nombre}</option>`).join("");
}

document.getElementById("resultCampeonato").addEventListener("change", async function() {
    await loadCarrerasSelect(this.value);
});

document.getElementById("addResult").onclick = async () => {
    const id_piloto  = document.getElementById("resultPiloto").value;
    const id_carrera = document.getElementById("resultCarrera").value;
    const posicion   = parseInt(document.getElementById("resultPosicion").value);
    const puntos     = parseInt(document.getElementById("resultPoints").value);

    if (!id_piloto || !id_carrera || isNaN(posicion) || isNaN(puntos)) {
        return showMsg("saveMsgResults", "⚠️ Completa todos los campos");
    }

    try {
        await sbPost("resultado", { id_piloto: parseInt(id_piloto), id_carrera: parseInt(id_carrera), posicion, puntos });
        document.getElementById("resultPosicion").value = "";
        document.getElementById("resultPoints").value   = "";
        await loadResultsAdmin();
        await loadDashboard();
        showMsg("saveMsgResults", "✅ Resultado guardado — ya aparece en el sitio");
    } catch (err) {
        const msg = err.message.includes("resultado_unique_piloto_carrera")
            ? "⚠️ Ese piloto ya tiene resultado en esta carrera"
            : err.message.includes("resultado_unique_posicion")
            ? "⚠️ Esa posición ya está ocupada en esta carrera"
            : "❌ Error al guardar resultado";
        showMsg("saveMsgResults", msg);
    }
};

async function deleteResult(id) {
    if (!confirm("¿Eliminar este resultado?")) return;
    try {
        await sbDelete("resultado", id, "id_resultado");
        await loadResultsAdmin();
        await loadDashboard();
    } catch (err) { alert("Error al eliminar: " + err.message); }
}

// ── Helpers ────────────────────────────────────
function showMsg(id, text) {
    const el = document.getElementById(id);
    el.textContent = text;
    setTimeout(() => el.textContent = "", 4000);
}

document.getElementById("logout").onclick = () => window.location.href = "index.html";

// ── Cargar al iniciar ──────────────────────────
loadDashboard();