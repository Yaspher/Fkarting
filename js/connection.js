// ══════════════════════════════════════════════
//  FKarting — conection.js  v1.0
//  Capa de Acceso a Datos (DAL)
//  Único archivo que habla con Supabase.
//
//  SEGURIDAD: La key sb_publishable es pública por diseño en Supabase.
//  La seguridad real depende de Row Level Security (RLS) activo
//  en todas las tablas. Verificar en el dashboard de Supabase antes
//  de lanzar a producción.
// ══════════════════════════════════════════════

const SUPABASE_URL = "https://kgzqqaxhqcydrvzqnxmk.supabase.co";

// Esta key es pública (sb_publishable) — seguridad depende de RLS en Supabase
const SUPABASE_KEY = "sb_publishable_svTNXiFYYvt9mZy1eXf_Gg_NXMoVvhg";

const sbHeaders = {
    "Content-Type":  "application/json",
    "apikey":        SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Prefer":        "return=representation"
};

// Timeout global para todos los fetches (ms)
const FETCH_TIMEOUT = 10_000;


// ════════════════════════════════════════════════════════════════
//  HELPERS INTERNOS — no se exportan
// ════════════════════════════════════════════════════════════════

// ✅ Crea un fetch con timeout automático de 10 segundos
function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    return fetch(url, { ...options, signal: controller.signal })
        .catch(err => {
            if (err.name === "AbortError") throw new Error("Tiempo de espera agotado. Verifica tu conexión.");
            throw err;
        })
        .finally(() => clearTimeout(timer));
}

async function sbGet(table, params = "") {
    const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}?${params}`,
        { headers: sbHeaders }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function sbPost(table, body) {
    const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}`,
        { method: "POST", headers: sbHeaders, body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function sbPatch(table, id, idField, body) {
    const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${id}`,
        { method: "PATCH", headers: sbHeaders, body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ✅ FIX: sbDelete ahora detecta si el registro no existía
async function sbDelete(table, id, idField) {
    const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${id}`,
        {
            method: "DELETE",
            // return=representation hace que Supabase devuelva las filas eliminadas
            headers: { ...sbHeaders, "Prefer": "return=representation" }
        }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!data.length) throw new Error("Registro no encontrado o ya fue eliminado.");
    return data;
}


// ════════════════════════════════════════════════════════════════
//  VISTAS — Consultas de solo lectura (índice público)
// ════════════════════════════════════════════════════════════════

export const getRankingVista = () =>
    sbGet("vista_ranking", "select=Campeonato,Piloto,Puntos,Vitorias,Podios");

// select=* porque los nombres de columna en estas vistas usan PascalCase
export const getTiempoVista = () =>
    sbGet("vista_tiempos", "select=*");

export const getPilotosVista = () =>
    sbGet("vista_piloto", "select=Id,Nombre,Numero,Campeonato,Victorias,Podios");

// Sin order= para evitar errores por case-sensitivity; el sort se hace en app.js
export const getCarreraVista = () =>
    sbGet("vista_carrera", "select=*");


// ════════════════════════════════════════════════════════════════
//  CAMPEONATOS
//  Tabla: campeonato | Campos: camp_ano, camp_descripcion, camp_activo
// ════════════════════════════════════════════════════════════════

export const getCampeonatos        = () => sbGet("campeonato", "order=camp_ano.desc");
export const getCampeonatosAdmin   = () => sbGet("campeonato", "camp_activo=eq.true&order=camp_ano.desc");
export const getCampeonatosActivos = () => sbGet("campeonato", "camp_activo=eq.true&order=camp_ano.desc");
export const getCampeonatoActivo   = () => sbGet("campeonato", "camp_activo=eq.true&order=camp_ano.desc&limit=1");

export const createCampeonato = (body) => sbPost("campeonato", {
    camp_ano:         body.ano,
    camp_descripcion: body.descripcion ?? null,
    camp_activo:      body.activo      ?? true
});

export const updateCampeonato = (id, body) => sbPatch("campeonato", id, "id_campeonato", {
    ...(body.ano         !== undefined && { camp_ano:         body.ano }),
    ...(body.descripcion !== undefined && { camp_descripcion: body.descripcion }),
    ...(body.activo      !== undefined && { camp_activo:      body.activo })
});

export const deleteCampeonato = (id) => sbDelete("campeonato", id, "id_campeonato");


// ════════════════════════════════════════════════════════════════
//  PILOTOS
//  Tabla: piloto | Campos: pilo_nombre, pilo_numero, pilo_activo
// ════════════════════════════════════════════════════════════════

export const getPilotos             = () => sbGet("vista_piloto", "order=Id.asc");
export const getPilotoById          = (id) => sbGet("piloto", `id_piloto=eq.${id}`);
export const getPilotosActivosAdmin = () => sbGet("piloto", "pilo_activo=eq.true&order=pilo_nombre.asc&select=id_piloto,pilo_nombre,pilo_numero");
export const getPilotosActivosCount = () => sbGet("piloto", "pilo_activo=eq.true&select=id_piloto");

export const createPiloto = (body) => sbPost("piloto", {
    pilo_nombre: body.nombre,
    pilo_numero: body.numero ?? null,
    pilo_activo: body.activo ?? true
});

export const updatePiloto = (id, body) => sbPatch("piloto", id, "id_piloto", {
    ...(body.nombre !== undefined && { pilo_nombre: body.nombre }),
    ...(body.numero !== undefined && { pilo_numero: body.numero }),
    ...(body.activo !== undefined && { pilo_activo: body.activo })
});

export const deletePiloto = (id) => sbDelete("piloto", id, "id_piloto");


// ════════════════════════════════════════════════════════════════
//  CARRERAS
//  Tabla: carrera | Campos: nombre, circuito, fecha, completada
// ════════════════════════════════════════════════════════════════

export const getCarrerasByCampeonato    = (id) => sbGet("carrera", `id_campeonato=eq.${id}&order=fecha.asc`);
export const getCarrerasByCampeonatoId  = (id) => sbGet("carrera", `id_campeonato=eq.${id}&order=fecha.asc&select=id_carrera,nombre,circuito,fecha,completada`);
export const getUltimaCarreraCompletada = (id) => sbGet("carrera", `id_campeonato=eq.${id}&completada=eq.true&order=fecha.desc&limit=1`);
export const getCarreraById             = (id) => sbGet("carrera", `id_carrera=eq.${id}`);

export const createCarrera = (body) => sbPost("carrera", body);
export const updateCarrera = (id, body) => sbPatch("carrera", id, "id_carrera", body);
export const deleteCarrera = (id) => sbDelete("carrera", id, "id_carrera");


// ════════════════════════════════════════════════════════════════
//  RESULTADOS
//  Tabla: resultado | Campos: res_posicion, res_puntos, res_tiempo_seg, res_vueltas
//  Nota: res_tiempo_seg usa formato interval de Postgres → "00:MM:SS.mmm"
// ════════════════════════════════════════════════════════════════

export const getResultadosByCarrera = (id) =>
    sbGet("resultado", `id_carrera=eq.${id}&order=res_posicion.asc&select=id_resultado,res_posicion,res_puntos,res_tiempo_seg,res_vueltas,piloto(id_piloto,pilo_nombre,pilo_numero)`);

export const getResultadosTop3 = (id) =>
    sbGet("resultado", `id_carrera=eq.${id}&order=res_posicion.asc&limit=3&select=res_posicion,res_puntos,piloto(pilo_nombre,pilo_numero)`);

export const getResultadosCompletos = (id) =>
    sbGet("resultado", `id_carrera=eq.${id}&select=res_posicion,res_tiempo_seg,res_vueltas,piloto(pilo_nombre,pilo_numero)`);

export const createResultado = (body) => sbPost("resultado", {
    id_carrera:     body.id_carrera,
    id_piloto:      body.id_piloto,
    res_posicion:   body.posicion,
    res_puntos:     body.puntos     ?? 0,
    res_tiempo_seg: body.tiempo_seg ?? null,
    res_vueltas:    body.vueltas    ?? null
});

export const updateResultado = (id, body) => sbPatch("resultado", id, "id_resultado", {
    ...(body.posicion   !== undefined && { res_posicion:   body.posicion }),
    ...(body.puntos     !== undefined && { res_puntos:     body.puntos }),
    ...(body.tiempo_seg !== undefined && { res_tiempo_seg: body.tiempo_seg }),
    ...(body.vueltas    !== undefined && { res_vueltas:    body.vueltas })
});

export const deleteResultado = (id) => sbDelete("resultado", id, "id_resultado");


// ════════════════════════════════════════════════════════════════
//  RANKING
//  Tabla: ranking | Campos: ran_puntos, ran_carreras, ran_victorias, ran_podios
// ════════════════════════════════════════════════════════════════

export const getRankingByCampeonato = (id) =>
    sbGet("ranking", `id_campeonato=eq.${id}&order=ran_puntos.desc&select=id_ranking,ran_puntos,ran_carreras,ran_victorias,ran_podios,ran_showranking,piloto(id_piloto,pilo_nombre,pilo_numero)`);

export const getRankingTop3ByCampeonato = (id) =>
    sbGet("ranking", `id_campeonato=eq.${id}&order=ran_puntos.desc&limit=3&select=ran_puntos,ran_victorias,ran_podios,ran_carreras,piloto(pilo_nombre,pilo_numero)`);

export const createRanking = (body) => sbPost("ranking", {
    id_campeonato:   body.id_campeonato,
    id_piloto:       body.id_piloto,
    ran_puntos:      body.puntos      ?? 0,
    ran_carreras:    body.carreras    ?? 0,
    ran_victorias:   body.victorias   ?? 0,
    ran_podios:      body.podios      ?? 0,
    ran_showranking: body.showranking ?? true
});

export const updateRanking = (id, body) => sbPatch("ranking", id, "id_ranking", {
    ...(body.puntos    !== undefined && { ran_puntos:    body.puntos }),
    ...(body.carreras  !== undefined && { ran_carreras:  body.carreras }),
    ...(body.victorias !== undefined && { ran_victorias: body.victorias }),
    ...(body.podios    !== undefined && { ran_podios:    body.podios })
});

export const deleteRanking = (id) => sbDelete("ranking", id, "id_ranking");


// ════════════════════════════════════════════════════════════════
//  TABLA DE PUNTOS BASE
//  Tabla: tablapuntosbase | id = posición (1–12) | tpb_puntos = puntos
// ════════════════════════════════════════════════════════════════

export const getTablaPuntos       = () => sbGet("tablapuntosbase", "order=id_tablapuntosbase.asc");
export const upsertPuntosPosicion = (id, puntos) => sbPatch("tablapuntosbase", id, "id_tablapuntosbase", { tpb_puntos: puntos });
export const initPuntosFila       = (id, puntos) => sbPost("tablapuntosbase", { id_tablapuntosbase: id, tpb_puntos: puntos });
