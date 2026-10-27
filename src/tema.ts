// Tema claro / oscuro. La preferencia vive en localStorage ('pos_tema') y
// se refleja en <html data-tema="claro|oscuro">, que es lo que lee index.css.
// Por defecto es "claro": nadie ve un cambio a menos que lo active.
export type PreferenciaTema = 'claro' | 'oscuro' | 'auto';

const CLAVE = 'pos_tema';
const consultaOscuro = () => window.matchMedia('(prefers-color-scheme: dark)');

export function leerPreferenciaTema(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CLAVE);
    if (v === 'claro' || v === 'oscuro' || v === 'auto') return v;
  } catch {
    // modo privado o almacenamiento bloqueado: se queda en claro
  }
  return 'claro';
}

function resolverTema(pref: PreferenciaTema): 'claro' | 'oscuro' {
  if (pref === 'auto') return consultaOscuro().matches ? 'oscuro' : 'claro';
  return pref;
}

export function aplicarTema(pref: PreferenciaTema) {
  document.documentElement.dataset.tema = resolverTema(pref);
}

export function guardarPreferenciaTema(pref: PreferenciaTema) {
  try {
    localStorage.setItem(CLAVE, pref);
  } catch {
    // sin almacenamiento: el cambio vale solo para esta sesion
  }
  aplicarTema(pref);
}

export function iniciarTema() {
  aplicarTema(leerPreferenciaTema());
  consultaOscuro().addEventListener('change', () => {
    if (leerPreferenciaTema() === 'auto') aplicarTema('auto');
  });
}
