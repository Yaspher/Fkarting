import { VERSION } from './connection.js';

/**
 * Rellena todos los elementos [data-version] con la versión actual.
 * Se puede llamar varias veces (por si inyectas HTML dinámico).
 */
export function applyVersion(scope = document) {
  scope.querySelectorAll('[data-version]').forEach(el => {
    el.textContent = VERSION;
  });
}

// Auto-ejecuta al cargar
applyVersion();