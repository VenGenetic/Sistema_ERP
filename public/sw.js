/*
 * sw.js — Service worker del ERP.
 *
 * Existe sobre todo para que Chrome ofrezca instalar la app en la pantalla de
 * inicio: sin un service worker con manejador de `fetch`, el navegador no
 * considera instalable el sitio por más completo que esté el manifiesto.
 *
 * El objetivo NO es funcionar sin conexión. Todo el sistema vive de Supabase,
 * así que una copia local serviría datos viejos como si fueran buenos. Lo que
 * sí se cachea es el armazón de la aplicación, para que abrir desde el icono
 * sea inmediato y para mostrar algo entendible si se abre sin señal.
 *
 * El peligro de un service worker mal armado es entregar una versión vieja del
 * sistema después de publicar cambios, y que nadie entienda por qué el arreglo
 * "no llegó". Por eso:
 *
 *   - La navegación va SIEMPRE a la red primero. El HTML cacheado sólo aparece
 *     si la red falla, nunca compitiendo contra un despliegue nuevo.
 *   - Sólo se cachean de forma agresiva los archivos de /assets/, que Vite
 *     nombra con un hash de contenido: si cambian, cambia el nombre, así que es
 *     imposible que uno viejo se sirva en lugar de uno nuevo.
 *   - Nada de Supabase se toca. Son datos y credenciales que deben pedirse
 *     frescos siempre.
 */

// Cambiar este número invalida todo lo guardado por versiones anteriores.
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `lvparts-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `lvparts-assets-${CACHE_VERSION}`;

// Lo mínimo para que la app arranque y se vea como ella misma sin conexión.
const SHELL_URLS = [
    '/',
    '/icon.svg',
    '/site.webmanifest',
    '/android-chrome-192x192.png',
    '/android-chrome-512x512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(SHELL_CACHE)
            // addAll falla entero si un solo recurso falla; se piden por
            // separado para que un icono ausente no impida instalar.
            .then((cache) => Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => null))))
            // Sin esto el service worker nuevo espera a que se cierren todas
            // las pestañas abiertas, y una corrección podría tardar días en
            // aplicarse en el teléfono del mostrador.
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
                        .map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Un service worker no debe meterse con envíos de datos ni con peticiones
    // de otro origen (Supabase, fuentes, el CDN de Tailwind): que pasen.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Navegación: la red manda. El caché es sólo la red de contención para
    // cuando no hay señal, así nunca compite con un despliegue reciente.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy));
                    return response;
                })
                .catch(() => caches.match('/').then((cached) => cached || Response.error()))
        );
        return;
    }

    // Archivos con hash en el nombre: si está guardado es exactamente el que se
    // pidió, así que se sirve directo y se guarda la primera vez.
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Iconos y manifiesto: se intenta la red y se cae al caché si no hay.
    event.respondWith(fetch(request).catch(() => caches.match(request)));
});
