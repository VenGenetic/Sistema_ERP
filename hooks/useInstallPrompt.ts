/**
 * useInstallPrompt.ts
 * Expone la instalación de la app en la pantalla de inicio del teléfono.
 *
 * Chrome dispara `beforeinstallprompt` cuando el sitio cumple los requisitos
 * (manifiesto completo, service worker con manejador de fetch, HTTPS) y esconde
 * la instalación detrás del menú de tres puntos, donde nadie la busca. Guardar
 * ese evento permite ofrecer un botón visible dentro de la propia app.
 *
 * El evento sólo puede usarse una vez, así que después de mostrarlo se descarta
 * y el botón desaparece.
 */
import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Ya está instalada si se abrió desde el icono en vez de desde el navegador. */
const isRunningStandalone = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia?.('(display-mode: standalone)').matches ||
        // iOS no soporta display-mode y marca esto en el navigator.
        (window.navigator as any).standalone === true
    );
};

export const useInstallPrompt = () => {
    const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(isRunningStandalone);

    useEffect(() => {
        const handleBeforeInstall = (event: Event) => {
            // Sin preventDefault Chrome muestra su propia barra, y entonces
            // habría dos invitaciones a instalar compitiendo en pantalla.
            event.preventDefault();
            setPromptEvent(event as BeforeInstallPromptEvent);
        };

        const handleInstalled = () => {
            setPromptEvent(null);
            setInstalled(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
        if (!promptEvent) return 'unavailable';
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        // Consumido: el navegador no permite reutilizar el mismo evento.
        setPromptEvent(null);
        return outcome;
    }, [promptEvent]);

    return {
        canInstall: !installed && promptEvent !== null,
        installed,
        promptInstall,
    };
};
