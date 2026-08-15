/**
 * generate-app-icons.mjs
 *
 * Genera los iconos PNG de la app instalable (public/*.png).
 *
 * Hizo falta porque los que había eran marcadores de posición de 1x1 píxel y 70
 * bytes: Chrome exige un icono real de 192x192 o más para ofrecer instalar el
 * sistema en la pantalla de inicio, así que con esos nunca aparecía la opción.
 *
 * Dibuja la marca directamente en píxeles y arma el PNG a mano (zlib viene con
 * Node) en vez de sumar una dependencia de imágenes como sharp, que es binaria
 * y pesada para un script que se corre una vez cada tanto:
 *
 *   node scripts/generate-app-icons.mjs
 *
 * El diseño sigue al modo móvil: fondo ámbar y las letras en el mismo slate
 * oscuro del fondo de la app. Para reemplazarlo por el logo real basta con
 * sobrescribir los PNG de public/ con las mismas medidas.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const AMBER = [245, 158, 11, 255];   // #f59e0b, el acento del modo móvil
const SLATE = [2, 6, 23, 255];       // #020617, el fondo de la app

// Se dibuja a 4x y se promedia al final: sin eso los bordes diagonales de la V
// y las esquinas redondeadas salen dentados.
const SS = 4;

// ── PNG ────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([length, typeAndData, crc]);
};

/** Arma un PNG RGBA de 8 bits a partir de un buffer de píxeles. */
const encodePng = (width, height, rgba) => {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;   // bits por canal
    ihdr[9] = 6;   // color type 6 = RGBA
    ihdr[10] = 0;  // compresión deflate
    ihdr[11] = 0;  // filtro adaptativo
    ihdr[12] = 0;  // sin entrelazado

    // Cada línea va precedida por su byte de filtro; 0 = sin filtrar.
    const raw = Buffer.alloc(height * (width * 4 + 1));
    for (let y = 0; y < height; y++) {
        const rowStart = y * (width * 4 + 1);
        raw[rowStart] = 0;
        rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
    }

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
};

// ── Geometría ──────────────────────────────────────────────────────────
/** Distancia de un punto al segmento ab: sirve para trazar cada palo de la letra. */
const distanceToSegment = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
};

const insideRoundedSquare = (x, y, radius) => {
    // Se mide contra el rectángulo encogido por el radio; fuera de ese núcleo
    // la esquina es un cuarto de círculo.
    const cx = Math.min(Math.max(x, radius), 1 - radius);
    const cy = Math.min(Math.max(y, radius), 1 - radius);
    return Math.hypot(x - cx, y - cy) <= radius;
};

/*
    Trazos de "LV" en coordenadas 0..1.

    Se mantienen dentro del 80% central para que la variante `maskable` del
    manifiesto siga legible: Android recorta el icono a un círculo y todo lo que
    quede fuera de esa zona segura desaparece.
*/
const STROKES = [
    [0.28, 0.33, 0.28, 0.67], // L, palo vertical
    [0.28, 0.67, 0.45, 0.67], // L, base
    [0.53, 0.33, 0.645, 0.67], // V, diagonal descendente
    [0.645, 0.67, 0.76, 0.33], // V, diagonal ascendente
];
const STROKE_HALF_WIDTH = 0.042;
const CORNER_RADIUS = 0.22;

const renderIcon = (size) => {
    const hi = size * SS;
    const acc = new Float64Array(size * size * 4);

    for (let y = 0; y < hi; y++) {
        // Centro del píxel, para que el muestreo quede simétrico.
        const v = (y + 0.5) / hi;
        for (let x = 0; x < hi; x++) {
            const u = (x + 0.5) / hi;

            let color = null;
            if (insideRoundedSquare(u, v, CORNER_RADIUS)) {
                color = AMBER;
                for (const [ax, ay, bx, by] of STROKES) {
                    if (distanceToSegment(u, v, ax, ay, bx, by) <= STROKE_HALF_WIDTH) {
                        color = SLATE;
                        break;
                    }
                }
            }

            // Fuera de la forma se acumula transparente, lo que suaviza el
            // borde exterior al promediar.
            const dst = ((y / SS) | 0) * size + ((x / SS) | 0);
            if (color) {
                acc[dst * 4] += color[0];
                acc[dst * 4 + 1] += color[1];
                acc[dst * 4 + 2] += color[2];
                acc[dst * 4 + 3] += color[3];
            }
        }
    }

    const samples = SS * SS;
    const rgba = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
        // Cada submuestra pintada aportó alpha 255, así que dividir la suma por
        // 255 devuelve cuántas fueron.
        const painted = acc[i * 4 + 3] / 255;

        // El color se promedia sólo entre las que pintaron: promediarlo contra
        // todas mezclaría el negro implícito de las vacías y dejaría un halo
        // oscuro alrededor de la figura.
        if (painted > 0) {
            rgba[i * 4] = Math.round(acc[i * 4] / painted);
            rgba[i * 4 + 1] = Math.round(acc[i * 4 + 1] / painted);
            rgba[i * 4 + 2] = Math.round(acc[i * 4 + 2] / painted);
        }
        // La transparencia sí sale del total: es la cobertura real del píxel.
        rgba[i * 4 + 3] = Math.round(acc[i * 4 + 3] / samples);
    }

    return encodePng(size, size, rgba);
};

const OUTPUTS = [
    ['android-chrome-512x512.png', 512],
    ['android-chrome-192x192.png', 192],
    ['apple-touch-icon.png', 180],
    ['favicon-32x32.png', 32],
    ['favicon-16x16.png', 16],
];

for (const [name, size] of OUTPUTS) {
    const png = renderIcon(size);
    fs.writeFileSync(path.join(PUBLIC_DIR, name), png);
    console.log(`${name.padEnd(28)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
console.log('\nIconos generados en public/.');
