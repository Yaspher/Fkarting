// ── Navegación del sidebar ──
document.querySelectorAll(".sidebar li[data-section]").forEach(item => {
    item.addEventListener("click", () => {
        document.querySelectorAll(".section").forEach(sec => sec.classList.add("hidden"));
        document.getElementById(item.dataset.section).classList.remove("hidden");
        updateDashboard();
    });
});

// ── Estado en memoria ──
let championships = JSON.parse(localStorage.getItem("fk_championships") || "[]");
let drivers       = JSON.parse(localStorage.getItem("fk_drivers")       || "[]");
let results       = JSON.parse(localStorage.getItem("fk_results")       || "[]");

// ── Renderizar listas al cargar ──
renderChampionships();
renderDrivers();
renderResults();
updateDashboard();

// ══════════════════════════════
//  CAMPEONATOS
// ══════════════════════════════
document.getElementById("addYear").onclick = () => {
    const year = document.getElementById("yearInput").value.trim();
    if (!year) return;
    championships.push(year);
    localStorage.setItem("fk_championships", JSON.stringify(championships));
    document.getElementById("yearInput").value = "";
    renderChampionships();
    updateDashboard();
};

function renderChampionships() {
    document.getElementById("yearList").innerHTML = championships.map((y, i) =>
        `<li>${y} <button class="del-btn" onclick="deleteChamp(${i})">✕</button></li>`
    ).join("");
}

function deleteChamp(i) {
    championships.splice(i, 1);
    localStorage.setItem("fk_championships", JSON.stringify(championships));
    renderChampionships();
    updateDashboard();
}

// ══════════════════════════════
//  PILOTOS
// ══════════════════════════════
document.getElementById("addDriver").onclick = () => {
    const name = document.getElementById("driverName").value.trim();
    const team = document.getElementById("driverTeam").value.trim();
    if (!name || !team) return;
    drivers.push({ name, team });
    document.getElementById("driverName").value = "";
    document.getElementById("driverTeam").value = "";
    renderDrivers();
    updateDashboard();
};

document.getElementById("saveDrivers").onclick = () => {
    localStorage.setItem("fk_drivers", JSON.stringify(drivers));
    showMsg("saveMsgDrivers", "¡Guardado! Los cambios ya aparecen en el sitio.");
};

function renderDrivers() {
    document.getElementById("driverList").innerHTML = drivers.map((d, i) =>
        `<li>${d.name} — ${d.team} <button class="del-btn" onclick="deleteDriver(${i})">✕</button></li>`
    ).join("");
}

function deleteDriver(i) {
    drivers.splice(i, 1);
    renderDrivers();
    updateDashboard();
}

// ══════════════════════════════
//  RESULTADOS
// ══════════════════════════════
document.getElementById("addResult").onclick = () => {
    const driver = document.getElementById("resultDriver").value.trim();
    const points = document.getElementById("resultPoints").value.trim();
    if (!driver || !points) return;
    results.push({ driver, points: Number(points) });
    document.getElementById("resultDriver").value = "";
    document.getElementById("resultPoints").value = "";
    renderResults();
    updateDashboard();
};

document.getElementById("saveResults").onclick = () => {
    localStorage.setItem("fk_results", JSON.stringify(results));
    showMsg("saveMsgResults", "¡Guardado! El ranking y resultados ya aparecen en el sitio.");
};

function renderResults() {
    document.getElementById("resultList").innerHTML = results.map((r, i) =>
        `<li>${r.driver} — ${r.points} pts <button class="del-btn" onclick="deleteResult(${i})">✕</button></li>`
    ).join("");
}

function deleteResult(i) {
    results.splice(i, 1);
    renderResults();
    updateDashboard();
}

// ══════════════════════════════
//  DASHBOARD
// ══════════════════════════════
function updateDashboard() {
    document.getElementById("statDrivers").textContent = `Pilotos: ${drivers.length}`;
    document.getElementById("statResults").textContent = `Resultados: ${results.length}`;
    document.getElementById("statChamps").textContent  = `Campeonatos: ${championships.length}`;
}

// ── Helpers ──
function showMsg(id, text) {
    const el = document.getElementById(id);
    el.textContent = text;
    setTimeout(() => el.textContent = "", 3000);
}

document.getElementById("logout").onclick = () => {
    window.location.href = "index.html";
};