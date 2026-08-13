import { useEffect, useRef } from 'react';

/**
 * Hace que el botón «atrás» del teléfono cierre un overlay en vez de salir de la pantalla.
 *
 * El problema: sin esto, abrir una foto y presionar atrás dispara la navegación del
 * navegador — el usuario acaba en el inicio y pierde búsqueda, filtros y scroll.
 *
 * Cómo funciona: al abrirse el overlay se empuja una entrada «centinela» al historial
 * (misma URL, así HashRouter no cambia de ruta). El botón atrás consume esa entrada,
 * llega el `popstate` y llamamos a `onClose` en lugar de navegar. Si el overlay se
 * cierra por otra vía (la X, Escape, el fondo), retiramos la centinela nosotros para
 * no dejar basura en el historial.
 */

let sentinelSeq = 0;

/** Cada `history.back()` programático genera un popstate que no debe cerrar nada. */
let programmaticBacks = 0;

/**
 * Overlays abiertos, del más antiguo al de encima. Un `popstate` lo escuchan todos
 * los hooks montados a la vez, así que sin esta pila un atrás con el visor abierto
 * sobre un modal cerraría los dos de golpe.
 */
const openSentinels: number[] = [];

export function useBackDismiss(isOpen: boolean, onClose: () => void): void {
  // El callback suele recrearse en cada render; con la ref evitamos re-suscribir
  // (y, peor, re-empujar la centinela) en cada uno de ellos.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;

    const sentinelId = ++sentinelSeq;
    openSentinels.push(sentinelId);
    window.history.pushState({ ...window.history.state, __overlay: sentinelId }, '');

    const handlePopState = () => {
      // Es el eco de un back() nuestro (el cierre de un overlay anidado), no el usuario.
      if (programmaticBacks > 0) {
        programmaticBacks -= 1;
        return;
      }

      // El atrás solo cierra el overlay de encima; los de debajo siguen abiertos.
      if (openSentinels[openSentinels.length - 1] !== sentinelId) return;

      openSentinels.pop();
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      const stackIndex = openSentinels.indexOf(sentinelId);
      if (stackIndex !== -1) openSentinels.splice(stackIndex, 1);

      // Solo retiramos la centinela si sigue siendo la entrada activa. Si no lo es,
      // el atrás ya la consumió (o hubo una navegación real encima) y un back()
      // aquí sacaría al usuario de la página.
      if (window.history.state?.__overlay === sentinelId) {
        programmaticBacks += 1;
        window.history.back();
      }
    };
  }, [isOpen]);
}

export default useBackDismiss;
