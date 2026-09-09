# Contexto del proyecto FKarting

## Identidad y estado

- **Nombre:** FKarting.
- **Versión del proyecto:** v1.8.0.
- **Tipo:** sitio web estático para un campeonato de karting, con vista
  pública y panel administrativo.
- **Objetivo:** publicar el campeonato activo, el ranking general, los mejores
  tiempos, los resultados de la última carrera y la información de los
  pilotos.
- **Fuente de verdad:** los datos operativos se consultan y modifican en
  Supabase mediante su API REST.

El código contiene referencias históricas a versiones anteriores. La versión
visible de la aplicación debe mantenerse en `js/connection.js` (`VERSION`) y
se muestra en los elementos con `data-version`.

## Arquitectura y despliegue

- Frontend sin framework: HTML, CSS y JavaScript nativo con módulos ES.
- No existe backend propio.
- `js/connection.js` centraliza las llamadas REST a Supabase, el timeout de
  red y las operaciones CRUD.
- `js/app.js` carga y renderiza la experiencia pública.
- `js/admin.js` protege y opera el panel administrativo.
- `css/styles.css` contiene los estilos públicos; `css/admin.css` los estilos
  del panel.
- El despliegue se realiza mediante GitHub Actions en GitHub Pages al hacer
  push a `main`, usando `.github/workflows/static.yml`.
- Supabase debe estar configurado con las tablas y vistas esperadas antes de
  que la aplicación pueda cargar datos.

## Superficies de la aplicación

### Vista pública

- `index.html`: inicio con hero, ranking, mejores tiempos, última carrera,
  listado de pilotos, modal de próxima carrera y acceso a la ruleta.
- `ayuda.html`: guía del campeonato, sistema de puntos, ranking y vuelta
  rápida.
- `ruleta.html`: utilidad visual de ruleta racing; no forma parte del CRUD
  administrativo.
- La navegación es responsive y ofrece variantes para desktop y móvil.

### Administración

- `login.html`: acceso al panel.
- `admin.html`: dashboard y gestión de campeonatos, pilotos, puntos,
  carreras, resultados y ranking.
- `testconnection.html`: comprobación manual de la conexión.
- El panel exige `sessionStorage["fk_admin_auth"] === "true"` antes de
  mostrar su contenido.
- Las credenciales de referencia se mantienen únicamente en
  `README.md`; el login actual es una protección básica del frontend y debe
  migrarse a Supabase Auth antes de considerarse autenticación robusta.

## Funcionalidad y reglas del campeonato

- **Campeonatos:** año, descripción y estado activo.
- **Pilotos:** nombre, número y estado activo; también se muestran
  estadísticas históricas cuando existen.
- **Carreras:** campeonato, nombre, circuito, fecha y estado de completada.
- **Resultados:** piloto, posición, puntos, tiempo de vuelta y vueltas.
- **Ranking:** puntos, carreras disputadas, victorias, podios y visibilidad.
- **Puntos por posición predeterminados:** 1° 15, 2° 13, 3° 11, 4° 9,
  5° 7, 6° 5, 7° 4, 8° 3, 9° 2 y 10° 1; las posiciones 11° y 12° no
  reciben puntos.
- El panel valida posiciones, pilotos repetidos y tiempos antes de guardar.
  La integridad definitiva debe reforzarse también con índices y constraints
  en la base de datos.
- `doc/refresh_ranking.sql` define el recálculo del ranking mediante función,
  trigger sobre `resultado` y backfill inicial. Debe ejecutarse en Supabase
  por un rol con permisos suficientes.

## Modelo de datos y vistas Supabase

Tablas utilizadas por `js/connection.js`:

- `campeonato`: `id_campeonato`, `camp_ano`, `camp_descripcion`,
  `camp_activo`.
- `piloto`: `id_piloto`, `pilo_nombre`, `pilo_numero`, `pilo_activo` y
  estadísticas históricas.
- `carrera`: `id_carrera`, `id_campeonato`, `nombre`, `circuito`, `fecha`,
  `completada`.
- `resultado`: `id_resultado`, `id_carrera`, `id_piloto`, `res_posicion`,
  `res_puntos`, `res_tiempo_seg`, `res_vueltas`.
- `ranking`: `id_ranking`, `id_campeonato`, `id_piloto`, `ran_puntos`,
  `ran_carreras`, `ran_victorias`, `ran_podios`, `ran_showranking`.
- `tablapuntosbase`: `id_tablapuntosbase` y `tpb_puntos`.

Vistas públicas esperadas:

- `vista_ranking`
- `vista_tiempos`
- `vista_piloto`
- `vista_pilotos_legendarios` (script pendiente de ejecutar cuando Supabase
  vuelva a estar disponible)
- `vista_carrera`

Los nombres y las mayúsculas de las columnas de las vistas deben respetarse,
porque PostgREST es sensible a los identificadores usados en los parámetros
de consulta.

## Diseño visual

- Tema oscuro, premium y deportivo, con acento rojo institucional.
- Fondo principal: `#080808`.
- Fondo oscuro: `#0a0a0a`.
- Fondo de tarjeta: `#0e0e0e`.
- Texto principal: `#ffffff`.
- Texto secundario: `#d1d5db`.
- Texto suave: `#9ca3af`.
- Gris medio: `#4b5563`.
- Rojo principal: `#dc2626`.
- Rojo 700: `#b91c1c`.
- Rojo 500: `#ef4444`.
- Rojo 900: `#7f1d1d`.
- Borde rojo: `rgba(127, 29, 29, 0.30)`.
- Oro: `#eab308`; plata: `#d1d5db`; bronce: `#d97706`.
- Las tipografías externas son Barlow y Barlow Condensed.

## Documentación relacionada y pendientes

- `README.md`: identificación breve, historial de versiones y credenciales
  de referencia.
- `doc/AUTOMATION.md`: oportunidades de automatización, validaciones,
  índices, constraints, vistas, seed, pruebas e importación/exportación.
- `doc/refresh_ranking.sql`: automatización SQL del ranking.

No hay backend de autenticación, migraciones completas, seed formal, suite de
pruebas automatizadas ni configuración por entorno. Estas son áreas pendientes
descritas con más detalle en `AUTOMATION.md`.
