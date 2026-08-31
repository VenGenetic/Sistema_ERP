import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './styles';

/**
 * Globo con el texto completo de algo que en pantalla sale recortado.
 *
 * Por qué existe: las descripciones de los repuestos son largas de verdad
 * («PARABRISAS DELANTERO VERDE CON SENSOR DE LLUVIA Y ANTENA…») y en las
 * tarjetas del catálogo entran dos líneas y nada más. Quien atiende tenía
 * que abrir el repuesto en otra pantalla solo para confirmar de cuál de
 * los cuatro parecidos se trataba, con el cliente esperando del otro lado.
 *
 * Se dibuja con un portal sobre el `body`: las tarjetas y las listas del
 * WhatsApp tienen `overflow-hidden` y scroll propio, así que colgado
 * adentro el globo quedaba cortado justo en la parte que hacía falta leer.
 *
 * `soloSiRecortado` (por defecto) mide el elemento y solo arma el globo
 * cuando el texto NO entra: un nombre corto no gana nada con un globo
 * encima, y el ruido constante enseña a ignorarlo.
 */

/** Aire contra el borde de la ventana. */
const MARGEN = 8;
const ANCHO_MAX = 320;

export interface TooltipProps {
    /** Lo que se muestra en el globo. Si viene vacío, no se muestra nada. */
    texto?: string | null;
    /**
     * Mostrar solo cuando el contenido no entra en su caja (recortado por
     * `truncate` o `line-clamp-*`). Ponelo en `false` para una aclaración
     * que siempre vale la pena, aunque el texto entre.
     */
    soloSiRecortado?: boolean;
    /** El elemento al que se le pega el globo. Tiene que aceptar `ref`. */
    children: React.ReactElement<any>;
}

export const Tooltip: React.FC<TooltipProps> = ({
    texto,
    soloSiRecortado = true,
    children,
}) => {
    const anclaRef = useRef<HTMLElement | null>(null);
    const [caja, setCaja] = useState<DOMRect | null>(null);
    const id = useId();
    const contenido = texto?.trim() ?? '';

    const abrir = useCallback(() => {
        const el = anclaRef.current;
        if (!el || !contenido) return;
        if (soloSiRecortado) {
            const recortado =
                el.scrollHeight - el.clientHeight > 1 || el.scrollWidth - el.clientWidth > 1;
            if (!recortado) return;
        }
        setCaja(el.getBoundingClientRect());
    }, [contenido, soloSiRecortado]);

    const cerrar = useCallback(() => setCaja(null), []);

    /*
        El globo queda anclado a una posición fija calculada una sola vez,
        así que si la lista se desplaza debajo hay que bajarlo: si no,
        queda flotando lejos del repuesto que lo abrió. `capture` para
        enterarse también del scroll de los paneles internos, que no
        burbujea hasta la ventana.
    */
    useEffect(() => {
        if (!caja) return;
        const tecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape') cerrar();
        };
        document.addEventListener('keydown', tecla);
        window.addEventListener('scroll', cerrar, true);
        window.addEventListener('resize', cerrar);
        return () => {
            document.removeEventListener('keydown', tecla);
            window.removeEventListener('scroll', cerrar, true);
            window.removeEventListener('resize', cerrar);
        };
    }, [caja, cerrar]);

    const hijo = React.cloneElement(children, {
        ref: (nodo: HTMLElement | null) => {
            anclaRef.current = nodo;
            const refHija = (children as any).ref;
            if (typeof refHija === 'function') refHija(nodo);
            else if (refHija && typeof refHija === 'object') refHija.current = nodo;
        },
        onMouseEnter: (e: React.MouseEvent) => {
            children.props.onMouseEnter?.(e);
            abrir();
        },
        onMouseLeave: (e: React.MouseEvent) => {
            children.props.onMouseLeave?.(e);
            cerrar();
        },
        onFocus: (e: React.FocusEvent) => {
            children.props.onFocus?.(e);
            abrir();
        },
        onBlur: (e: React.FocusEvent) => {
            children.props.onBlur?.(e);
            cerrar();
        },
        'aria-describedby': caja ? id : children.props['aria-describedby'],
    });

    if (!contenido) return children;

    return (
        <>
            {hijo}
            {caja &&
                createPortal(
                    <Globo id={id} ancla={caja} texto={contenido} />,
                    document.body,
                )}
        </>
    );
};

/**
 * El globo en sí. Va en su propio componente para poder medirlo YA
 * dibujado: el texto puede ocupar una o cinco líneas según el repuesto, y
 * sin el alto real no hay forma de saber si cabe abajo del ancla.
 */
const Globo: React.FC<{ id: string; ancla: DOMRect; texto: string }> = ({ id, ancla, texto }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [alto, setAlto] = useState(0);

    useEffect(() => {
        setAlto(ref.current?.offsetHeight ?? 0);
    }, [texto, ancla]);

    const cabeDebajo = ancla.bottom + alto + MARGEN + 6 < window.innerHeight;
    const top = cabeDebajo ? ancla.bottom + 6 : Math.max(MARGEN, ancla.top - alto - 6);
    const left = Math.min(
        Math.max(MARGEN, ancla.left),
        Math.max(MARGEN, window.innerWidth - ANCHO_MAX - MARGEN),
    );

    return (
        <div
            ref={ref}
            id={id}
            role="tooltip"
            style={{ top, left, maxWidth: ANCHO_MAX, opacity: alto ? 1 : 0 }}
            className={cn(
                'pointer-events-none fixed z-[110] rounded-lg border border-strong bg-surface-3',
                'px-2.5 py-1.5 text-xs leading-snug text-fg shadow-xl',
            )}
        >
            {texto}
        </div>
    );
};
