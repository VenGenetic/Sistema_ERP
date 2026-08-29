import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { MediaLightbox, type MediaItem } from './MediaLightbox';
import { cn, focusRing } from './ui/styles';

/**
 * La foto de un repuesto, que se abre en grande al hacer clic.
 *
 * Antes cada pantalla tenía su propia "Miniatura" copiada: la del aviso de
 * llegada, la de mandar catálogo, la de la proforma, la de anotar un pedido.
 * Ninguna se podía abrir, y en una miniatura de 44px dos retenes distintos se
 * ven iguales. Como lo que se decide mirando esa foto es qué repuesto se le
 * pide a la importadora para un cliente, equivocarse ahí cuesta un pedido y
 * una devolución.
 *
 * Se abre solo si hay foto y carga bien: cuando no hay, queda el hueco con su
 * ícono y no es un botón, para que nadie haga clic en algo que no responde.
 *
 * Trae su propio visor. Ponerla en cualquier lista es una línea, sin estado
 * que subir al componente padre; el visor no pinta nada mientras está cerrado.
 */
interface Props {
    url: string | null | undefined;
    /**
     * SKU y nombre arman el título del visor con el formato `"SKU - Nombre"`
     * que MediaLightbox espera: de ahí saca con qué nombre descargar el
     * archivo y qué abrir con el botón "Abrir en Catálogo".
     */
    sku?: string | null;
    nombre?: string | null;
    /** Tamaño y forma. Por defecto, miniatura cuadrada de 44px. */
    className?: string;
    /** Fotos extra del repuesto (columna `gallery`), para pasarlas en el visor. */
    gallery?: Array<{ url: string; type: 'image' | 'video' }> | null;
    /** Encaja la foto entera en vez de recortarla. Para fichas grandes. */
    contain?: boolean;
    /** Tamaño del ícono del hueco cuando no hay foto. */
    iconSize?: number;
}

export const FotoRepuesto: React.FC<Props> = ({
    url,
    sku,
    nombre,
    className,
    gallery,
    contain = false,
    iconSize = 16,
}) => {
    const [falló, setFalló] = useState(false);
    const [abierto, setAbierto] = useState(false);

    const medida = className || 'h-11 w-11 rounded-lg';
    const alt = nombre || sku || 'Repuesto';

    if (!url || falló) {
        return (
            <div className={cn(medida, 'shrink-0 flex items-center justify-center bg-surface-3 text-fg-subtle')}>
                <ImageOff size={iconSize} aria-hidden="true" />
            </div>
        );
    }

    const título = [sku, nombre].filter(Boolean).join(' - ') || 'Repuesto';

    const media: MediaItem[] = [
        { type: 'image', url, title: título },
        ...(gallery ?? [])
            .filter((m) => m?.url && m.url !== url)
            .map((m) => ({ type: m.type, url: m.url, title: título })),
    ];

    return (
        <>
            <button
                type="button"
                onClick={(e) => {
                    // Estas miniaturas viven dentro de filas y tarjetas que ya
                    // hacen algo al hacer clic (elegir el repuesto, abrir la
                    // ficha). Mirar la foto no debe disparar además eso.
                    e.stopPropagation();
                    setAbierto(true);
                }}
                title="Ver la foto en grande"
                aria-label={`Ver la foto de ${alt} en grande`}
                className={cn(medida, focusRing, 'group/foto shrink-0 cursor-zoom-in overflow-hidden bg-surface-3')}
            >
                <img
                    src={url}
                    alt={alt}
                    loading="lazy"
                    onError={() => setFalló(true)}
                    className={cn(
                        'h-full w-full transition-transform duration-200 group-hover/foto:scale-105',
                        contain ? 'object-contain' : 'object-cover',
                    )}
                />
            </button>

            <MediaLightbox isOpen={abierto} media={media} onClose={() => setAbierto(false)} />
        </>
    );
};

export default FotoRepuesto;
