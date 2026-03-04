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

// ── Ranking ────────────────────────────────────
export const getPodiumTop3    = () => sbGet("ranking_general", "order=total_puntos.desc&limit=3");
export const getRankingTop3   = () => sbGet("ranking", "select=puntos,carreras,piloto(nombre)&order=puntos.desc&limit=3");
export const getPilotosTop6   = () => sbGet("ranking_general", "order=total_puntos.desc&limit=6");

// ── Carreras ───────────────────────────────────
export const getUltimaCarrera = () => sbGet("carrera", "completada=eq.true&order=fecha.desc&limit=1");
export const getResultados    = (id) => sbGet("resultado", `id_carrera=eq.${id}&order=posicion.asc&select=posicion,puntos,piloto(nombre)`);

// ── Pilotos ────────────────────────────────────
export const getPilotosActivos = () => sbGet("piloto", "activo=eq.true&order=numero.asc");
export const getPilotosVista   = () => sbGet("vista_piloto", "select=Id,Nombre,Numero,Campeonato,Podios");