// ── Datos por defecto (se usan si el Admin aún no guardó nada) ──
const defaultRanking = [
    { position: 1, name: "Carlos Martínez", team: "Red Speed",    points: 125 },
    { position: 2, name: "Luis Gómez",      team: "Blue Racing",  points: 110 },
    { position: 3, name: "Andrés Peña",     team: "Black Motors", points: 98  }
];
const defaultResults = [
    { driver: "Carlos Martínez", points: 25 },
    { driver: "Luis Gómez",      points: 18 },
    { driver: "Andrés Peña",     points: 15 }
];

// ── Leer datos guardados por el Admin (localStorage) ──
function getData(key, fallback) {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
    } catch {
        return fallback;
    }
}

const adminDrivers  = getData("fk_drivers",  null);   // [{name, team}]
const adminResults  = getData("fk_results",  null);   // [{driver, points}]

// ── Construir ranking ──
// Si el admin cargó resultados, los usamos para construir el ranking
let ranking;

if (adminResults && adminResults.length > 0) {
    // Agrupar puntos por piloto
    const pointsMap = {};
    const teamMap   = {};

    // Si hay pilotos registrados en admin, mapear equipo
    if (adminDrivers) {
        adminDrivers.forEach(d => { teamMap[d.name] = d.team; });
    }

    adminResults.forEach(r => {
        pointsMap[r.driver] = (pointsMap[r.driver] || 0) + Number(r.points);
    });

    ranking = Object.entries(pointsMap)
        .map(([name, points]) => ({ name, team: teamMap[name] || "—", points }))
        .sort((a, b) => b.points - a.points)
        .map((d, i) => ({ position: i + 1, ...d }));
} else {
    ranking = defaultRanking;
}

// Resultados para mostrar en "Última Carrera"
const resultsToShow = (adminResults && adminResults.length > 0)
    ? adminResults
    : defaultResults;

// ── Renderizar Ranking ──
const rankingTable = document.querySelector("#rankingTable tbody");
ranking.forEach(d => {
    rankingTable.innerHTML += `<tr>
        <td>${d.position}</td>
        <td>${d.name}</td>
        <td>${d.team}</td>
        <td>${d.points}</td>
    </tr>`;
});

// ── Renderizar Pilotos Destacados ──
const driversGrid = document.getElementById("driversGrid");
ranking.forEach(d => {
    driversGrid.innerHTML += `<div class="driver-card">
        <h3>#${d.position}</h3>
        <h4>${d.name}</h4>
        <p>${d.team}</p>
    </div>`;
});

// ── Renderizar Última Carrera ──
const resultsList = document.getElementById("resultsList");
resultsList.innerHTML = resultsToShow
    .map((r, i) => `<p>${i + 1}° ${r.driver} — ${r.points} pts</p>`)
    .join("");

// ── Modal ──
const modal = document.getElementById("raceModal");
document.getElementById("btnNextRace").onclick    = () => modal.style.display = "flex";
document.getElementById("closeModal").onclick     = () => modal.style.display = "none";
document.getElementById("closeModalBtn").onclick  = () => modal.style.display = "none";
window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };