import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ClipboardList, Pencil, Send } from 'lucide-react';
import { cn, focusRing } from '../ui/styles';
import type { ProductoCatalogo } from '../../utils/whatsappOutbox';

/**
 * Lo que se puede hacer con un repuesto sin salir de la búsqueda.
 *
 * Por qué un menú y no más botones en la tarjeta: la tarjeta del resultado
 * ya tiene la foto, el precio, el stock, el código y el botón de ampliar la
 * imagen, en 150 píxeles de ancho y con doce de estas en pantalla. Meter
 * "editar" y "anotar pedido" como botones visibles rompería la grilla y, lo
 * que importa más, competiría visualmente con la acción que se hace el 90 %
 * de las veces: tocar para mandárselo al cliente.
 *
 * Clic derecho en el escritorio, mantener pulsado en el teléfono. Es el
 * mismo gesto que ya abre las acciones de un mensaje en el hilo
 * (`ChatThread`) y las de una conversación en la lista del móvil, así que no
 * hay un gesto nuevo que aprender.
 */

export interface AccionesRepuesto {
    /** Mandárselo al cliente: la acción de siempre, la que hace el clic normal. */
    onEnviar?: () => void;
    /** Abrir la ficha del repuesto para corregirlo. */
    onEditar: () => void;
    /**
     * Anotar que ESTE cliente lo está esperando (`product_demands`).
     *
     * Opcional porque en un chat de GRUPO no hay cliente a quien anotarle
     * nada: el "teléfono" de un grupo son los dígitos de su JID. Sin esta
     * función la opción no se dibuja.
     */
    onPedido?: () => void;
}

export interface MenuAbierto extends AccionesRepuesto {
    producto: ProductoCatalogo;
    x: number;
    y: number;
}

/** Ancho fijo: el menú se ancla a un punto, y para no salirse hay que medirlo. */
const ANCHO = 232;

interface Props {
    menu: MenuAbierto | null;
    onCerrar: () => void;
    /** Nombre del cliente del chat, para que el pedido diga de quién es. */
    clienteLabel: string;
}

export const MenuRepuesto: React.FC<Props> = ({ menu, onCerrar, clienteLabel }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });

    /*
        La posición se corrige DESPUÉS de montar y antes de pintar: la altura
        depende de cuántas opciones haya, y sólo se sabe una vez en el DOM.
        Con `useEffect` en vez de `useLayoutEffect` el menú aparecería un
        fotograma fuera de la pantalla y saltaría a su sitio.
    */
    useLayoutEffect(() => {
        if (!menu) return;
        const alto = ref.current?.offsetHeight ?? 150;
        setPos({
            x: Math.max(8, Math.min(menu.x, window.innerWidth - ANCHO - 8)),
            y: Math.max(8, Math.min(menu.y, window.innerHeight - alto - 8)),
        });
    }, [menu]);

    useEffect(() => {
        if (!menu) return;
        const fuera = (e: Event) => {
            if (!ref.current?.contains(e.target as Node)) onCerrar();
        };
        const escape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); }
        };
        /*
            En captura: la tarjeta de debajo tiene su propio `onClick` que
            manda el repuesto al cliente. Sin capturar, cerrar el menú tocando
            fuera dispararía además esa acción -- y lo que se envía por
            WhatsApp no se puede deshacer.
        */
        document.addEventListener('pointerdown', fuera, true);
        document.addEventListener('keydown', escape, true);
        return () => {
            document.removeEventListener('pointerdown', fuera, true);
            document.removeEventListener('keydown', escape, true);
        };
    }, [menu, onCerrar]);

    // Al abrirse, el foco entra en el menú: quien navega con teclado queda
    // dentro de lo que acaba de abrir, no en la tarjeta de atrás.
    useEffect(() => {
        if (menu) ref.current?.focus();
    }, [menu]);

    if (!menu) return null;

    const opcion = (
        icono: React.ReactNode,
        texto: string,
        detalle: string,
        onClick: () => void,
    ) => (
        <button
            type="button"
            onClick={() => { onCerrar(); onClick(); }}
            className={cn(
                focusRing,
                'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-hover',
            )}
        >
            <span className="mt-0.5 shrink-0 text-fg-subtle">{icono}</span>
            <span className="min-w-0">
                <span className="block text-[13px] font-medium leading-tight text-fg">{texto}</span>
                <span className="mt-0.5 block text-[11px] leading-tight text-fg-subtle">{detalle}</span>
            </span>
        </button>
    );

    return (
        <div
            ref={ref}
            role="menu"
            tabIndex={-1}
            aria-label={`Acciones para ${menu.producto.name}`}
            style={{ left: pos.x, top: pos.y, width: ANCHO }}
            className={cn(
                focusRing,
                'fixed z-[130] overflow-hidden rounded-xl border border-subtle bg-surface py-1 shadow-xl',
            )}
        >
            <p className="truncate border-b border-subtle px-3 pb-1.5 pt-1 text-[11px] font-semibold text-fg-subtle">
                {menu.producto.sku}
            </p>

            {menu.onEnviar &&
                opcion(
                    <Send size={15} aria-hidden="true" />,
                    'Mandar al cliente',
                    'Lo agrega a lo que se va a enviar',
                    menu.onEnviar,
                )}

            {opcion(
                <Pencil size={15} aria-hidden="true" />,
                'Editar el repuesto',
                'Precio, stock, fotos y descripción',
                menu.onEditar,
            )}

            {menu.onPedido &&
                opcion(
                    <ClipboardList size={15} aria-hidden="true" />,
                    'Agregar a pedido',
                    `Queda anotado para ${clienteLabel}`,
                    menu.onPedido,
                )}
        </div>
    );
};

/**
 * Los manejadores que abren el menú en una tarjeta de resultado.
 *
 * Se reparten como props para que las tres pantallas que muestran resultados
 * (catálogo, proforma y pedido) abran el menú con el MISMO gesto sin copiar
 * la lógica del temporizador tres veces.
 *
 * `pulsacionLarga` es un ref y no un estado a propósito: lo lee el `onClick`
 * que se dispara justo después de soltar, y un estado todavía no se habría
 * actualizado -- el repuesto se enviaría al cliente además de abrirse el
 * menú.
 */
export function usarGestoMenu(
    abrir: (x: number, y: number) => void,
): {
    pulsacionLarga: React.MutableRefObject<boolean>;
    props: {
        onContextMenu: (e: React.MouseEvent) => void;
        onPointerDown: (e: React.PointerEvent) => void;
        onPointerUp: () => void;
        onPointerMove: () => void;
        onPointerCancel: () => void;
    };
} {
    const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pulsacionLarga = useRef(false);

    const cancelar = () => {
        if (temporizador.current) {
            clearTimeout(temporizador.current);
            temporizador.current = null;
        }
    };

    useEffect(() => cancelar, []);

    return {
        pulsacionLarga,
        props: {
            onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
                abrir(e.clientX, e.clientY);
            },
            onPointerDown: (e) => {
                pulsacionLarga.current = false;
                // Sólo con el dedo: con ratón, mantener pulsado es el gesto de
                // arrastrar, y el clic derecho ya cubre este caso.
                if (e.pointerType === 'mouse') return;
                const { clientX, clientY } = e;
                cancelar();
                temporizador.current = setTimeout(() => {
                    pulsacionLarga.current = true;
                    navigator.vibrate?.(12);
                    abrir(clientX, clientY);
                }, 500);
            },
            onPointerUp: cancelar,
            onPointerMove: cancelar,
            onPointerCancel: cancelar,
        },
    };
}
