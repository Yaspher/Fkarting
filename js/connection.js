// ══════════════════════════════════════════════════════════════
//  FKarting — Connection.js  v1.2.0
//  Capa de Acceso a Datos (DAL)
//  Único archivo que habla con Supabase.
//
//  SEGURIDAD: La key sb_publishable es pública por diseño en Supabase.
//  La seguridad real depende de Row Level Security (RLS) activo
//  en todas las tablas. Verificar en el dashboard de Supabase.
//
//  VISTAS DISPONIBLES:
//    - vista_ranking   → columnas: Campeonato, Piloto, Puntos, Vitorias, Podios
//    - vista_tiempos   → columnas: SecTiempo, SecCarrera, SecPiloto, Tiempos, VueltaRapida, NombrePiloto
//    - vista_piloto    → columnas: Id, Nombre, Numero, Campeonato, Victorias, Podios
//    - vista_carrera   → columnas: id_carrera, nombre, circuito, Fecha, posicion, puntos, NombrePiloto
//
//  NOTA: Todas las vistas usan select=* para evitar errores de
//  case-sensitivity en PostgREST. El ordenamiento se hace en JS.
// ══════════════════════════════════════════════════════════════

const SUPABASE_URL = "https://kgzqqaxhqcydrvzqnxmk.supabase.co";
const SUPABASE_KEY = "sb_publishable_svTNXiFYYvt9mZy1eXf_Gg_NXMoVvhg";

const BASE_HEADERS = {
    "Content-Type":  "application/json",
    "apikey":        SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Prefer":        "return=representation"
};

const FETCH_TIMEOUT = 10_000; // 10 segundos


// ════════════════════════════════════════════════════════════════
//  CORE — fetch con timeout automático
// ════════════════════════════════════════════════════════════════

function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    return fetch(url, { ...options, signal: controller.signal })
        .catch(err => {
            if (err.name === "AbortError")
                throw new Error("Tiempo de espera agotado. Verifica tu conexión.");
            throw err;
        })
        .finally(() => clearTimeout(timer));
}


// ════════════════════════════════════════════════════════════════
//  HELPERS INTERNOS — no se exportan
// ════════════════════════════════════════════════════════════════

async function sbGet(table, params = "") {
    const url = `${SUPABASE_URL}/rest/v1/${table}${params ? "?" + params : ""}`;
    const res = await fetchWithTimeout(url, { headers: BASE_HEADERS });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function sbPost(table, body) {
    const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}`,
        { method: "POST", headers: BASE_HEADERS, body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function sbPatch(table, id, idField, body) {
    const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${id}`,
        { method: "PATCH", headers: BASE_HEADERS, body: JSON.stringify(body) }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function sbDelete(table, id, idField) {
    const res = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table}?${idField}=eq.${id}`,
        {
            method: "DELETE",
            headers: { ...BASE_HEADERS, "Prefer": "return=representation" }
        }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (!data.length) throw new Error("Registro no encontrado o ya fue eliminado.");
    return data;
}


// ════════════════════════════════════════════════════════════════
//  VISTAS — Solo lectura · select=* en todas para evitar
//           errores de case-sensitivity en nombres de columna.
//           El orden se maneja en app.js / admin.js.
// ════════════════════════════════════════════════════════════════

// Columnas conocidas: Campeonato, Piloto, Puntos, Victorias, Podios
export const getRankingVista = () =>
    sbGet("vista_ranking", "select=*");

// Columnas conocidas: SecTiempo, SecCarrera, SecPiloto, Tiempos, VueltaRapida, NombrePiloto
export const getTiempoVista = () =>
    sbGet("vista_tiempos", "select=*");

// Columnas conocidas: Id, Nombre, Numero, Campeonato, Victorias, Podios
export const getPilotosVista = () =>
    sbGet("vista_piloto", "select=*");

// Columnas conocidas: id_carrera, nombre, circuito, Fecha, posicion, puntos, NombrePiloto
// Sin order= — Fecha tiene mayúscula y PostgREST es case-sensitive en el parámetro order=
export const getCarreraVista = () =>
    sbGet("vista_carrera", "select=*");


// ════════════════════════════════════════════════════════════════
//  CAMPEONATOS
//  Tabla: campeonato
//  Campos: id_campeonato, camp_ano, camp_descripcion, camp_activo
// ════════════════════════════════════════════════════════════════

export const getCampeonatos        = () => sbGet("campeonato", "order=camp_ano.desc");
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
//  Tabla: piloto
//  Campos: id_piloto, pilo_nombre, pilo_numero, pilo_activo
// ════════════════════════════════════════════════════════════════

export const getPilotos             = () => sbGet("vista_piloto", "select=*&order=Id.asc");
export const getPilotoById          = (id) => sbGet("piloto", `id_piloto=eq.${id}`);
export const getPilotosActivosAdmin = () => sbGet("piloto", "pilo_activo=eq.true&order=pilo_nombre.asc&select=id_piloto,pilo_nombre,pilo_numero");
export const getPilotosActivosCount = () => sbGet("piloto", "pilo_activo=eq.true&select=id_piloto");

export const createPiloto = (body) => sbPost("piloto", {
    pilo_nombre: body.nombre,
    pilo_numero: body.numero ?? null,
    pilo_activo: body.activo ?? true
});

export const updatePiloto = (id, body) => sbPatch("piloto", id, "id_piloto", {
    ...(body.nombre !== undefined && { pilo_nombre:               body.nombre }),
    ...(body.numero !== undefined && { pilo_numero:               body.numero }),
    ...(body.activo !== undefined && { pilo_activo:               body.activo }),
    ...(body.wdc    !== undefined && { pilo_cantidadcampeonatos:  body.wdc   }),
    ...(body.win    !== undefined && { pilo_cantidadvictoria:     body.win   }),
    ...(body.poles  !== undefined && { pilo_cantidadpodios:       body.poles })
});

export const deletePiloto = (id) => sbDelete("piloto", id, "id_piloto");


// ════════════════════════════════════════════════════════════════
//  CARRERAS
//  Tabla: carrera
//  Campos: id_carrera, id_campeonato, nombre, circuito, fecha, completada
// ════════════════════════════════════════════════════════════════

export const getCarrerasByCampeonato   = (id) => sbGet("carrera", `id_campeonato=eq.${id}&order=fecha.asc`);
export const getCarrerasByCampeonatoId = (id) => sbGet("carrera", `id_campeonato=eq.${id}&order=fecha.asc&select=id_carrera,nombre,circuito,fecha,completada`);
export const getUltimaCarreraCompletada = (id) => sbGet("carrera", `id_campeonato=eq.${id}&completada=eq.true&order=fecha.desc&limit=1`);
export const getCarreraById            = (id) => sbGet("carrera", `id_carrera=eq.${id}`);

export const createCarrera = (body) => sbPost("carrera", body);
export const updateCarrera = (id, body) => sbPatch("carrera", id, "id_carrera", body);
export const deleteCarrera = (id) => sbDelete("carrera", id, "id_carrera");


// ════════════════════════════════════════════════════════════════
//  RESULTADOS
//  Tabla: resultado
//  Campos: id_resultado, id_carrera, id_piloto,
//          res_posicion, res_puntos, res_tiempo_seg, res_vueltas
//  Nota: res_tiempo_seg → interval de Postgres "00:MM:SS.mmm"
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
//  Tabla: ranking
//  Campos: id_ranking, id_campeonato, id_piloto,
//          ran_puntos, ran_carreras, ran_victorias, ran_podios, ran_showranking
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
//  Tabla: tablapuntosbase
//  Campos: id_tablapuntosbase (= posición 1–12), tpb_puntos
// ════════════════════════════════════════════════════════════════

export const getTablaPuntos       = () => sbGet("tablapuntosbase", "order=id_tablapuntosbase.asc");
export const upsertPuntosPosicion = (id, puntos) => sbPatch("tablapuntosbase", id, "id_tablapuntosbase", { tpb_puntos: puntos });
export const initPuntosFila       = (id, puntos) => sbPost("tablapuntosbase", { id_tablapuntosbase: id, tpb_puntos: puntos });