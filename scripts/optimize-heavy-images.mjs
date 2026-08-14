/**
 * optimize-heavy-images.mjs
 *
 * Convierte a WebP las imágenes de producto que quedaron pesadas (los PNG/JPG
 * que se subieron crudos desde la app antes de que existiera la compresión en
 * utils/imageCompression.ts). El 97% del catálogo ya son WebP de ~16 KB; esto
 * empareja al resto.
 *
 * Se corre una sola vez:
 *   node scripts/optimize-heavy-images.mjs --dry-run   (ver qué haría)
 *   node scripts/optimize-heavy-images.mjs             (aplicar)
 *
 * La conversión la hace el propio transformador de imágenes de Supabase, en
 * vez de instalar una librería nativa como sharp: pidiendo el objeto con
 * `Accept: image/webp` devuelve la versión convertida y ya redimensionada. Esas
 * imágenes ya se transformaron este mes (era justamente el gasto que se está
 * eliminando), así que reutilizarlas ahora no agrega imágenes origen nuevas al
 * consumo.
 *
 * El objeto original NO se borra: se sube uno nuevo con extensión .webp y se
 * repunta products.image_url. Si algo saliera mal, la imagen anterior sigue en
 * el bucket y basta con revertir la columna.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

// El lado mayor que deja utils/imageCompression.ts para las subidas nuevas.
const MAX_SIDE = 1600;
const BUCKET = 'product_images';

const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const readEnv = (key) => {
    const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
};

const SUPABASE_URL = readEnv('VITE_SUPABASE_URL');
// Hace falta la clave de servicio: el script escribe en Storage y actualiza
// products, y la clave anónima está limitada por RLS.
const SERVICE_KEY = readEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
}

const authHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
};

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

/** Productos cuya imagen no es WebP: son las que conviene convertir. */
const fetchHeavyProducts = async () => {
    const rows = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/products?select=id,sku,image_url&is_active=eq.true&image_url=not.is.null&limit=${pageSize}&offset=${offset}`,
            { headers: authHeaders }
        );
        if (!res.ok) throw new Error(`No se pudo listar productos: ${res.status} ${await res.text()}`);
        const page = await res.json();
        if (!page.length) break;
        rows.push(...page);
        if (page.length < pageSize) break;
    }

    return rows.filter((row) => {
        const url = row.image_url || '';
        if (!url.includes('/storage/v1/object/public/')) return false;
        const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
        return ext && ext !== 'webp';
    });
};

/** Ruta del objeto dentro del bucket, tal como la espera la API de Storage. */
const objectPathFromUrl = (url) => {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const at = url.indexOf(marker);
    if (at === -1) return null;
    return decodeURIComponent(url.slice(at + marker.length).split('?')[0]);
};

const downloadAsWebp = async (publicUrl) => {
    const transformed = publicUrl.replace('/object/public/', '/render/image/public/') +
        `?width=${MAX_SIDE}&height=${MAX_SIDE}&resize=contain&quality=82`;

    const res = await fetch(transformed, { headers: { Accept: 'image/webp' } });
    if (!res.ok) throw new Error(`descarga falló: ${res.status}`);

    const type = res.headers.get('content-type') || '';
    if (!type.includes('webp')) throw new Error(`el servidor devolvió ${type || 'formato desconocido'}`);

    return Buffer.from(await res.arrayBuffer());
};

const uploadWebp = async (objectPath, buffer) => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
        method: 'POST',
        headers: {
            ...authHeaders,
            'Content-Type': 'image/webp',
            'Cache-Control': '31536000',
            'x-upsert': 'true',
        },
        body: buffer,
    });
    if (!res.ok) throw new Error(`subida falló: ${res.status} ${await res.text()}`);
};

const updateProductImage = async (id, newUrl) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ image_url: newUrl }),
    });
    if (!res.ok) throw new Error(`update falló: ${res.status} ${await res.text()}`);
};

const main = async () => {
    console.log(DRY_RUN ? '— SIMULACIÓN, no se modifica nada —\n' : '— APLICANDO CAMBIOS —\n');

    const heavy = await fetchHeavyProducts();
    console.log(`Imágenes a convertir: ${heavy.length}\n`);
    if (!heavy.length) return;

    let converted = 0, failed = 0, before = 0, after = 0;

    for (const product of heavy) {
        const objectPath = objectPathFromUrl(product.image_url);
        if (!objectPath) {
            console.log(`  ${product.sku}: URL con formato inesperado, se omite`);
            failed++;
            continue;
        }

        try {
            const head = await fetch(product.image_url, { method: 'HEAD' });
            const originalSize = Number(head.headers.get('content-length') || 0);

            const webp = await downloadAsWebp(product.image_url);

            // Convertir sólo si realmente adelgaza: alguna imagen ya pequeña
            // podría no mejorar, y reescribirla sería puro riesgo sin ganancia.
            if (originalSize && webp.length >= originalSize) {
                console.log(`  ${product.sku.padEnd(20)} ${kb(originalSize)} → sin mejora, se deja igual`);
                continue;
            }

            const newPath = objectPath.replace(/\.[^./]+$/, '') + '.webp';
            const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${newPath}`;

            if (!DRY_RUN) {
                await uploadWebp(newPath, webp);
                await updateProductImage(product.id, newUrl);
            }

            before += originalSize;
            after += webp.length;
            converted++;
            console.log(`  ${product.sku.padEnd(20)} ${kb(originalSize).padStart(8)} → ${kb(webp.length).padStart(8)}`);
        } catch (err) {
            failed++;
            console.log(`  ${product.sku.padEnd(20)} ERROR: ${err.message}`);
        }
    }

    console.log(`\nConvertidas: ${converted}   Fallidas/omitidas: ${failed}`);
    if (converted) {
        console.log(`Peso: ${kb(before)} → ${kb(after)}  (${(100 - (after / before) * 100).toFixed(1)}% menos)`);
    }
    if (DRY_RUN) console.log('\nNada se modificó. Corre sin --dry-run para aplicar.');
};

main().catch((err) => {
    console.error('\nFalló el script:', err.message);
    process.exit(1);
});
