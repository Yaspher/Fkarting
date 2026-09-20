
export const VERSION = 'v2.0.1';

export function applyVersion(scope = document) {
  scope.querySelectorAll('[data-version]').forEach(el => {
    el.textContent = VERSION;
  });
}

applyVersion();