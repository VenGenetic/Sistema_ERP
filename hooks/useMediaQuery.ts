import { useEffect, useState } from 'react';

/**
 * Responde a una media query desde JavaScript, para cuando la decisión no
 * es "cómo se ve" sino "qué se monta".
 *
 * Tailwind alcanza para esconder y mostrar, pero acá hace falta otra cosa:
 * la proforma se arma en un panel lateral cuando hay ancho para leer el
 * chat al lado, y en un modal cuando no. Montar las dos versiones y tapar
 * una con `hidden` duplicaría el componente entero -- dos búsquedas al
 * catálogo, dos consultas de stock, dos copias de la hoja que se captura.
 *
 * Arranca en `false` en el servidor y en el primer render: es lo mismo que
 * hace Tailwind con `min-width` (parte de lo chico y agranda), así que la
 * pantalla nunca aparece con el layout ancho para después achicarse.
 */
export function useMediaQuery(query: string): boolean {
    const [coincide, setCoincide] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
    );

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mql = window.matchMedia(query);
        const alCambiar = (e: MediaQueryListEvent) => setCoincide(e.matches);
        // Se lee de nuevo al montar: entre el useState inicial y este efecto
        // la ventana pudo cambiar de tamaño (o el navegador restaurarla).
        setCoincide(mql.matches);
        mql.addEventListener('change', alCambiar);
        return () => mql.removeEventListener('change', alCambiar);
    }, [query]);

    return coincide;
}

/** El ancho a partir del cual la bandeja puede mostrar una tercera columna (Tailwind `xl`). */
export const CONSULTA_PANTALLA_ANCHA = '(min-width: 1280px)';
