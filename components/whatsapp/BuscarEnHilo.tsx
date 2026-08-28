import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { MensajeHilo } from './ChatThread';
import { cn } from '../ui/styles';

interface Props {
    mensajes: MensajeHilo[];
    onCerrar: () => void;
    tactil?: boolean;
}

function normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export const BuscarEnHilo: React.FC<Props> = ({ mensajes, onCerrar, tactil = false }) => {
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

    useEffect(() => setIndice(Math.max(0, coincidencias.length - 1)), [termino, coincidencias.length]);

    const ir = (nuevo: number) => {
        if (coincidencias.length === 0) return;
        const siguiente = (nuevo + coincidencias.length) % coincidencias.length;
        setIndice(siguiente);
        const nodo = document.getElementById(`wa-message-${coincidencias[siguiente]}`);
        nodo?.scrollIntoView({ behavior: 'auto', block: 'center' });
        nodo?.classList.add('ring-2', 'ring-wa-accent', 'ring-offset-2');
        window.setTimeout(() => nodo?.classList.remove('ring-2', 'ring-wa-accent', 'ring-offset-2'), 1400);
    };

    return (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-wa-divider bg-wa-panel px-2 py-2">
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
    );
};

export default BuscarEnHilo;
