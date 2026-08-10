/**
 * Auditor de contraste WCAG 2.1 para los tokens de DropshipERP.
 * Lee las variables de :root y .dark directamente de index.html, así que
 * mide la paleta real, no una copia.
 *
 *   AA texto normal .......... 4.5:1
 *   AA texto grande (>=18.66px bold / 24px) .... 3.0:1
 *   AA componentes/bordes .... 3.0:1
 */
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

function parseBlock(selector) {
  const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm');
  const body = html.match(re)?.[1] ?? '';
  const tokens = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([\d]+)\s+([\d]+)\s+([\d]+)\s*;/g)) {
    tokens[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return tokens;
}

const themes = {
  CLARO: parseBlock(':root'),
  OSCURO: parseBlock('\\.dark'),
};

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) =>
  0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);

function ratio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** [fg, bg, umbral, descripción] */
const PAIRS = [
  ['fg', 'bg', 4.5, 'Texto principal sobre la página'],
  ['fg', 'surface', 4.5, 'Texto principal sobre tarjeta'],
  ['fg', 'surface-2', 4.5, 'Texto sobre cabecera de tabla'],
  ['fg', 'surface-3', 4.5, 'Texto sobre campo deshabilitado'],
  ['fg-muted', 'surface', 4.5, 'Dato secundario sobre tarjeta'],
  ['fg-muted', 'surface-2', 4.5, 'Cabecera de columna'],
  ['fg-muted', 'bg', 4.5, 'Dato secundario sobre página'],
  ['fg-subtle', 'surface', 3.0, 'Placeholder / pista (no esencial)'],
  ['border', 'surface', 1.2, 'Borde hairline (solo separación)'],
  ['border-strong', 'surface', 3.0, 'Borde de input (componente)'],
  ['primary', 'surface', 4.5, 'Enlace / icono primario'],
  ['primary-fg', 'primary', 4.5, 'Texto del botón primario'],
  ['primary-soft-fg', 'primary-soft', 4.5, 'Badge informativo'],
  ['primary', 'primary-soft', 3.0, 'Icono sobre tinte primario'],
  ['success', 'surface', 4.5, 'Texto de éxito'],
  ['success-soft-fg', 'success-soft', 4.5, 'Badge de stock alto'],
  ['warning', 'surface', 4.5, 'Texto de alerta'],
  ['warning-soft-fg', 'warning-soft', 4.5, 'Badge de stock bajo'],
  ['danger', 'surface', 4.5, 'Texto de error'],
  ['danger-soft-fg', 'danger-soft', 4.5, 'Badge de agotado'],
  ['ring', 'surface', 3.0, 'Anillo de foco'],
  ['ring', 'bg', 3.0, 'Anillo de foco sobre página'],
  ['success-fg', 'success', 4.5, 'Texto del botón de éxito'],
  ['danger-fg', 'danger', 4.5, 'Texto del botón destructivo'],
  ['warning-fg', 'warning', 4.5, 'Texto del botón de alerta'],
  ['success', 'bg', 4.5, 'Texto de éxito sobre página'],
  ['danger', 'bg', 4.5, 'Texto de error sobre página'],
  ['warning', 'bg', 4.5, 'Texto de alerta sobre página'],
  ['primary', 'bg', 4.5, 'Enlace sobre página'],
];

const WHITE = [255, 255, 255];
const ON_COLOR = [];

let failures = 0;

for (const [themeName, tokens] of Object.entries(themes)) {
  console.log(`\n${'='.repeat(78)}\n  TEMA ${themeName}\n${'='.repeat(78)}`);

  const check = (fgName, bgName, min, label, fgOverride) => {
    const fg = fgOverride ?? tokens[fgName];
    const bg = tokens[bgName];
    if (!fg || !bg) {
      console.log(`  ?  ${label} — token ausente (${fgName}/${bgName})`);
      return;
    }
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(
      `  ${ok ? 'OK  ' : 'FALLA'} ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${label}`,
    );
  };

  for (const [fg, bg, min, label] of PAIRS) check(fg, bg, min, label);
  for (const [bg, label] of ON_COLOR) check('white', bg, 4.5, label, WHITE);
}

console.log(
  `\n${'='.repeat(78)}\n  ${failures === 0 ? 'Todos los pares cumplen.' : `${failures} par(es) por debajo del umbral.`}\n`,
);

// Sale con código 1 si algo falla, para poder engancharlo a CI o a un hook.
process.exit(failures === 0 ? 0 : 1);
