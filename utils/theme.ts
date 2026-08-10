/**
 * Control del tema claro/oscuro.
 *
 * El valor se aplica antes del primer pintado por el script inline de
 * `index.html`; estas funciones solo lo cambian en caliente y lo persisten.
 * Los tokens de color viven en index.html (`:root` y `.dark`), así que
 * alternar la clase `dark` en <html> basta para repintar toda la app.
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Tema guardado. 'light' por defecto (base del sistema de diseño). */
export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* localStorage bloqueado */
  }
  return 'light';
}

/** ¿Se está pintando oscuro ahora mismo? */
export function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function applyTheme(theme: Theme): void {
  const useDark = theme === 'dark' || (theme === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', useDark);
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* localStorage bloqueado — el cambio se pierde al recargar */
  }
  applyTheme(theme);
}

/** Alterna entre claro y oscuro explícitos. */
export function toggleTheme(): Theme {
  const next: Theme = isDark() ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/**
 * Mantiene sincronizado el modo 'system' con el ajuste del sistema operativo.
 * Devuelve la función de limpieza.
 */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined') return () => {};

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getTheme() === 'system') applyTheme('system');
  };

  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
