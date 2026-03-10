const SUPABASE_URL = "https://kgzqqaxhqcydrvzqnxmk.supabase.co";
const SUPABASE_KEY = "sb_publishable_svTNXiFYYvt9mZy1eXf_Gg_NXMoVvhg";

const sbHeaders = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
};

async function sbGet(table, params = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: sbHeaders });
    if (!res.ok) throw new Error(`Error ${res.status} en ${table}`);
    return res.json();
}

// ══════════════════════════════════════════════
//  Vistas Frontales
// ══════════════════════════════════════════════

// ── Ranking ────────────────────────────────────
export const getRankingVista  = () => sbGet("vista_ranking", "select=Campeonato,Piloto,Puntos,Vitorias,Podios");

// ── Tiempos ────────────────────────────────────
export const getTiempoVista   = () => sbGet("vista_tiempos", "select=SecTiempo,SecCarrera,SecPiloto,Tiempos,VueltaRapida,NombrePiloto");

// ── Pilotos ────────────────────────────────────
export const getPilotosVista  = () => sbGet("vista_piloto",  "select=Id,Nombre,Numero,Campeonato,Victorias,Podios");

// ── Carreras ───────────────────────────────────
export const getCarreraVista = () => sbGet("vista_carrera",  "select=id_carrera,NombreCarrera,Circuito,Fecha,Posicion,Puntos,NombrePiloto&RangoCarrera=eq.1");