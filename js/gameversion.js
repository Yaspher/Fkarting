
export const VERSION = 'v2.2.5';

export function applyVersion(scope = document) {
  scope.querySelectorAll('[data-version]').forEach(el => {
    el.textContent = VERSION;
  });
}

applyVersion();