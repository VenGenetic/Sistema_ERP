/**
 * installState.ts
 * Estado de instalación de la app en la pantalla de inicio.
 *
 * Vive fuera de React a propósito. Chrome dispara `beforeinstallprompt` en
 * cuanto decide que el sitio es instalable, y en una segunda visita —service
 * worker ya activo y manifiesto en caché— eso puede ocurrir antes de que React
 * monte y ponga su escuchador. El evento no se repite: si nadie lo recogió, la
 * app ya no puede ofrecer instalarse en toda esa sesión, y el usuario ve un
 * sistema que sencillamente nunca propone instalarse.
 *
 * `captureInstallPrompt()` se llama desde index.tsx antes de renderizar, así
 * que el evento queda guardado aunque llegue en el primer instante.
 */

export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Evento guardado, o null si Chrome todavía no lo ha ofrecido. */
let storedPrompt: BeforeInstallPromptEvent | null = null;

type Listener = (prompt: BeforeInstallPromptEvent | null) => void;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((fn) => fn(storedPrompt));

export const getInstallPrompt = () => storedPrompt;

export const subscribeInstallPrompt = (fn: Listener): (() => void) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
};

export const consumeInstallPrompt = () => {
    // El navegador no permite reutilizar el mismo evento.
    storedPrompt = null;
    emit();
};

/** Se abrió desde el icono y no desde el navegador. */
export const isRunningStandalone = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia?.('(display-mode: standalone)').matches ||
        // iOS no soporta display-mode y lo marca en el navigator.
        (window.navigator as any).standalone === true
    );
};

export const captureInstallPrompt = (): void => {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (event) => {
        // Sin preventDefault Chrome saca su propia barra y habría dos
        // invitaciones a instalar compitiendo en pantalla.
        event.preventDefault();
        storedPrompt = event as BeforeInstallPromptEvent;
        emit();
    });

    window.addEventListener('appinstalled', () => {
        storedPrompt = null;
        emit();
    });
};

/* ────────────────────────────────────────────────────────────────────────────
   Diagnóstico
   ──────────────────────────────────────────────────────────────────────── */

export type InstallBlocker =
    | 'instalada'
    | 'sin-https'
    | 'ios'
    | 'esperando'
    | null;

/**
 * Por qué el navegador no está ofreciendo instalar.
 *
 * Sin esto, un sistema que no se deja instalar no da ninguna pista: el aviso
 * simplemente no aparece. Y la causa más habitual no es un fallo de la app sino
 * la dirección por la que se entró — abrir el servidor de desarrollo por la IP
 * de la red local (http://192.168.x.x:3000) no es un contexto seguro, así que
 * Chrome ni registra el service worker ni ofrece instalar nada.
 */
export const getInstallBlocker = (): InstallBlocker => {
    if (typeof window === 'undefined') return null;
    if (isRunningStandalone()) return 'instalada';

    // localhost cuenta como seguro aunque sea http.
    if (!window.isSecureContext) return 'sin-https';

    // Safari no implementa beforeinstallprompt: en iPhone se instala a mano.
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) return 'ios';

    return 'esperando';
};
