/**
 * Utilitario para la detección de dispositivos móviles y preferencia de vista (Móvil vs Escritorio)
 */

export type ViewMode = 'mobile' | 'desktop' | null;

const PREFERRED_VIEW_KEY = 'preferred_view_mode';

/**
 * Detecta si el dispositivo del usuario es móvil mediante User-Agent o ancho de pantalla.
 */
export const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
    }

    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
    
    const isMobileUA = mobileRegex.test(userAgent);
    const isSmallScreen = window.innerWidth <= 768;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Se considera móvil si cumple la firma del UA o si es pantalla pequeña con capacidad táctil
    return isMobileUA || (isSmallScreen && hasTouch);
};

/**
 * Obtiene la preferencia de vista elegida manualmente por el usuario en esta sesión ('mobile' | 'desktop' | null).
 */
export const getPreferredViewMode = (): ViewMode => {
    if (typeof window === 'undefined') return null;
    const val = sessionStorage.getItem(PREFERRED_VIEW_KEY);
    if (val === 'mobile' || val === 'desktop') return val;
    return null;
};

/**
 * Guarda o resetea la preferencia manual del usuario para la sesión actual.
 */
export const setPreferredViewMode = (mode: ViewMode): void => {
    if (typeof window === 'undefined') return;
    if (mode) {
        sessionStorage.setItem(PREFERRED_VIEW_KEY, mode);
    } else {
        sessionStorage.removeItem(PREFERRED_VIEW_KEY);
    }
};

/**
 * Determina si se debe redirigir al usuario al Modo Móvil (`/mobile`).
 */
export const shouldRedirectToMobile = (): boolean => {
    const preference = getPreferredViewMode();
    if (preference === 'desktop') {
        return false;
    }
    if (preference === 'mobile') {
        return true;
    }
    return isMobileDevice();
};
