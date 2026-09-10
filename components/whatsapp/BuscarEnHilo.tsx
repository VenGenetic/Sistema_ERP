import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Search, X } from 'lucide-react';
import type { MensajeHilo } from './ChatThread';
import { cn } from '../ui/styles';

interface Props {
    mensajes: MensajeHilo[];
    onCerrar: () => void;
    tactil?: boolean;
    /**
     * Queda conversación sin cargar más arriba.
     *
     * Sin esto el buscador MENTÍA: solo mira los mensajes que están en
     * pantalla (los últimos 100, o 40 en el teléfono), así que buscar
     * «Dmax» en un chat largo decía «0» aunque la palabra estuviera diez
     * veces más atrás -- y un «0» se lee como «no está», no como «no lo
     * busqué». Ahora, mientras quede historial, el contador lo dice y
     * ofrece traer más sin cerrar la búsqueda.
     */
    hayMasHistorial?: boolean;
    cargandoHistorial?: boolean;
    onCargarMas?: () => void;
}

function normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export const BuscarEnHilo: React.FC<Props> = ({
    mensajes,
    onCerrar,
    tactil = false,
    hayMasHistorial = false,
    cargandoHistorial = false,
    onCargarMas,
}) => {
    const [termino, setTermino] = useState('');
    const [indice, setIndice] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const coincidencias = useMemo(() => {
        const q = normalizar(termino.trim());
        if (!q) return [];
        return mensajes.filter((m) => !m.deleted_at && normalizar(m.body ?? '').includes(q)).map((m) => m.id);
    }, [mensajes, termino]);

    /** Lleva el hilo hasta ese mensaje y lo marca un momento. */
    const resaltar = (id: number) => {
        const nodo = document.getElementById(`wa-message-${id}`);
        if (!nodo) return;
        nodo.scrollIntoView({ behavior: 'auto', block: 'center' });
        nodo.classList.add('ring-2', 'ring-wa-accent', 'ring-offset-2');
        window.setTimeout(() => nodo.classList.remove('ring-2', 'ring-wa-accent', 'ring-offset-2'), 1400);
    };

    /*
        Al escribir se salta SOLO a la coincidencia más reciente.

        Antes el buscador contaba los resultados y no se movía: decía
        «5/5» con el hilo clavado donde estaba, y había que apretar Enter
        para que pasara algo -- y ese Enter, desde la última, daba la
        vuelta y llevaba a la MÁS VIEJA. Buscar «transferencia» en un chat
        de meses aterrizaba en el comprobante del año pasado.

        Se depende de los ids y no del array: el repaso del hilo cada
        ocho segundos lo reconstruye, y sin esto cada repaso volvería a
        arrancarle la pantalla de las manos a quien está leyendo.
    */
    const idsCoincidentes = coincidencias.join(',');
    useEffect(() => {
        if (coincidencias.length === 0) {
            setIndice(0);
            return;
        }
        const ultima = coincidencias.length - 1;
        setIndice(ultima);
        resaltar(coincidencias[ultima]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsCoincidentes]);

    const ir = (nuevo: number) => {
        if (coincidencias.length === 0) return;
        const siguiente = (nuevo + coincidencias.length) % coincidencias.length;
        setIndice(siguiente);
        resaltar(coincidencias[siguiente]);
    };

    const puedeTraerMas = hayMasHistorial && !!onCargarMas;
    const buscando = termino.trim().length > 0;

    return (
        <div className="shrink-0 border-b border-wa-divider bg-wa-panel">
        <div className="flex items-center gap-1.5 px-2 py-2">
            <Search size={17} className="shrink-0 text-wa-meta" aria-hidden="true" />
            <input
                ref={inputRef}
                type="search"
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') ir(indice + (e.shiftKey ? -1 : 1));
                    if (e.key === 'Escape') onCerrar();
                }}
                placeholder="Buscar en esta conversación"
                aria-label="Buscar en esta conversación"
                className={cn('min-w-0 flex-1 rounded-lg border-none bg-wa-input px-3 text-wa-text outline-none', tactil ? 'h-11 text-base' : 'h-9 text-sm')}
            />
            <span className="min-w-[54px] text-center text-xs text-wa-meta">
                {termino.trim() ? (coincidencias.length ? `${indice + 1}/${coincidencias.length}` : '0') : ''}
            </span>
            <button onClick={() => ir(indice - 1)} disabled={!coincidencias.length} aria-label="Coincidencia anterior" className="flex h-9 w-9 items-center justify-center rounded-full text-wa-meta hover:bg-wa-hover disabled:opacity-30">
                <ChevronUp size={17} aria-hidden="true" />
            </button>
            <button onClick={() => ir(indice + 1)} disabled={!coincidencias.length} aria-label="Coincidencia siguiente" className="flex h-9 w-9 items-center justify-center rounded-full text-wa-meta hover:bg-wa-hover disabled:opacity-30">
                <ChevronDown size={17} aria-hidden="true" />
            </button>
            <button onClick={onCerrar} aria-label="Cerrar búsqueda" className="flex h-9 w-9 items-center justify-center rounded-full text-wa-meta hover:bg-wa-hover">
                <X size={18} aria-hidden="true" />
            </button>
        </div>

        {/* El alcance real de la búsqueda, dicho solo cuando cambia algo:
            con la conversación entera cargada no hay nada que aclarar. */}
        {buscando && puedeTraerMas && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2 text-[11.5px] leading-4 text-wa-meta">
                <span>
                    Se buscó en los {mensajes.length} mensajes cargados. Más atrás hay conversación sin
                    revisar.
                </span>
                <button
                    type="button"
                    onClick={onCargarMas}
                    disabled={cargandoHistorial}
                    className={cn(
                        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-wa-accent',
                        'hover:bg-wa-hover disabled:opacity-60',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wa-accent',
                        tactil && 'min-h-[32px]',
                    )}
                >
                    {cargandoHistorial && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                    {cargandoHistorial ? 'Trayendo…' : 'Traer más y volver a buscar'}
                </button>
            </div>
        )}
        </div>
    );
};

export default BuscarEnHilo;
