/**
 * useInstallPrompt.ts
 * Expone la instalación de la app en la pantalla de inicio del teléfono.
 *
 * Chrome dispara `beforeinstallprompt` cuando el sitio cumple los requisitos
 * (manifiesto completo, service worker con manejador de fetch, HTTPS) y esconde
 * la instalación detrás del menú de tres puntos, donde nadie la busca. Guardar
 * ese evento permite ofrecer un botón visible dentro de la propia app.
 *
 * El evento se recoge en utils/installState.ts, ANTES de que React monte: el
 * escuchador vivía aquí dentro, en un `useEffect`, y en una segunda visita
 * —service worker ya activo, manifiesto en caché— Chrome puede dispararlo antes
 * de ese punto. Como no se repite, la app se quedaba sin poder ofrecer la
 * instalación durante toda la sesión, sin ninguna señal de que algo iba mal.
 *
 * Cuando no se puede instalar, `blocker` dice por qué, para que la pantalla lo
 * explique en vez de callarse.
 */
import { useCallback, useEffect, useState } from 'react';
import {
    consumeInstallPrompt,
    getInstallBlocker,
    getInstallPrompt,
    isRunningStandalone,
    subscribeInstallPrompt,
    type BeforeInstallPromptEvent,
    type InstallBlocker,
} from '../utils/installState';

export const useInstallPrompt = () => {
    const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(getInstallPrompt);
    const [installed, setInstalled] = useState(isRunningStandalone);
    const [blocker, setBlocker] = useState<InstallBlocker>(getInstallBlocker);

    useEffect(() => {
        const unsubscribe = subscribeInstallPrompt((evt) => {
            setPromptEvent(evt);
            if (!evt && isRunningStandalone()) setInstalled(true);
            setBlocker(getInstallBlocker());
        });

        const onInstalled = () => setInstalled(true);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            unsubscribe();
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
        if (!promptEvent) return 'unavailable';
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        consumeInstallPrompt();
        return outcome;
    }, [promptEvent]);

    return {
        canInstall: !installed && promptEvent !== null,
        installed,
        /** Por qué no se puede instalar ahora mismo. Null si sí se puede. */
        blocker: promptEvent ? null : blocker,
        promptInstall,
    };
};
