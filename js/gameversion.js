
export const VERSION = 'v2.1.0';

export function applyVersion(scope = document) {
  scope.querySelectorAll('[data-version]').forEach(el => {
    el.textContent = VERSION;
  });
}

applyVersion();