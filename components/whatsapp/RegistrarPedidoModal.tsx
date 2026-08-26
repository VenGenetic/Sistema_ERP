import React, { useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, Package, Search, X } from 'lucide-react';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { supabase } from '../../supabaseClient';
import { badge, button, cn, input, modal } from '../ui/styles';
import { buscarEnCatalogo, formatearPrecio, precioParaCliente, stockUtil, type ProductoCatalogo } from '../../utils/whatsappOutbox';

/**
 * Anota que este cliente está esperando un repuesto que hoy no hay
 * (`product_demands`, la misma tabla que usa la pantalla de Solicitudes).
 *
 * Por qué desde el chat: el momento en que se sabe que falta un repuesto
 * es justo este, hablando con el cliente. Si hay que ir a otra pantalla a
 * cargarlo, no se carga -- y cuando el repuesto llega, nadie sabe a quién
 * avisarle. Anotado acá, el pedido aparece en la ficha del cliente y el
 * agente puede avisar solo cuando entre stock.
 */

interface Props {
    isOpen: boolean;
    onClose: () => void;
    phoneNumber: string;
    customerName: string | null;
    userId: string | null;
    onRegistrado: () => void;
}

const Miniatura: React.FC<{ url: string | null; alt: string }> = ({ url, alt }) => {
    const [falló, setFalló] = useState(false);
    if (!url || falló) {
        return (
            <div className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center bg-surface-3 text-fg-subtle">
                <ImageOff size={16} aria-hidden="true" />
            </div>
        );
    }
    return (
        <img src={url} alt={alt} loading="lazy" onError={() => setFalló(true)} className="w-11 h-11 rounded-lg shrink-0 object-cover bg-surface-3" />
    );
};

export const RegistrarPedidoModal: React.FC<Props> = ({
    isOpen,
    onClose,
    phoneNumber,
    customerName,
    userId,
    onRegistrado,
}) => {
    const [termino, setTermino] = useState('');
    const [resultados, setResultados] = useState<ProductoCatalogo[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [elegido, setElegido] = useState<ProductoCatalogo | null>(null);
    const [notas, setNotas] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);

    const buscadorRef = useRef<HTMLInputElement>(null);
    useBackDismiss(isOpen, onClose);

    useEffect(() => {
        if (!isOpen) return;
        setTermino('');
        setResultados([]);
        setElegido(null);
        setNotas('');
        setError(null);
        setAviso(null);
        const t = setTimeout(() => buscadorRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || elegido) return;
        const texto = termino.trim();
        if (texto.length < 2) {
            setResultados([]);
            return;
        }
        let cancelado = false;
        setBuscando(true);
        const t = setTimeout(async () => {
            try {
                const filas = await buscarEnCatalogo(texto, 12);
                if (!cancelado) setResultados(filas);
            } catch (err: any) {
                if (!cancelado) setError(err?.message ?? 'No se pudo buscar.');
            } finally {
                if (!cancelado) setBuscando(false);
            }
        }, 300);
        return () => {
            cancelado = true;
            clearTimeout(t);
        };
    }, [termino, isOpen, elegido]);

    const guardar = async () => {
        if (!elegido || guardando) return;
        setGuardando(true);
        setError(null);
        setAviso(null);

        try {
            // Un mismo cliente no puede tener dos pedidos vivos del mismo
            // repuesto: cuando llegue el stock recibiría dos avisos. Es el
            // mismo chequeo que hace ProductDemandModal.
            const { data: existentes, error: errorCheck } = await supabase
                .from('product_demands')
                .select('id')
                .eq('product_id', elegido.product_id)
                .eq('phone_number', phoneNumber)
                .in('status', ['pending_stock', 'stock_available'])
                .limit(1);
            if (errorCheck) throw errorCheck;

            if (existentes && existentes.length > 0) {
                setAviso('Este cliente ya tenía anotado este repuesto. No se duplicó.');
                setGuardando(false);
                return;
            }

            const { error: errorInsert } = await supabase.from('product_demands').insert([
                {
                    product_id: elegido.product_id,
                    phone_number: phoneNumber,
                    customer_name: customerName || null,
                    notes: notas.trim() || null,
                    created_by: userId,
                    status: 'pending_stock',
                },
            ]);
            if (errorInsert) throw errorInsert;

            onRegistrado();
            onClose();
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo anotar el pedido.');
        } finally {
            setGuardando(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={modal.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={cn(modal.panel, modal.width.lg)} role="dialog" aria-modal="true" aria-label="Anotar pedido">
                <div className={modal.header}>
                    <div>
                        <h2 className={modal.title}>Anotar un pedido</h2>
                        <p className={modal.subtitle}>
                            Queda esperando stock. Cuando llegue, se puede avisar a este cliente.
                        </p>
                    </div>
                    <button onClick={onClose} className={modal.close} aria-label="Cerrar">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className={modal.body}>
                    {!elegido ? (
                        <>
                            <div className="relative">
                                <Search size={16} className={input.leadingIcon} aria-hidden="true" />
                                <input
                                    ref={buscadorRef}
                                    value={termino}
                                    onChange={(e) => setTermino(e.target.value)}
                                    placeholder="¿Qué repuesto está buscando?"
                                    aria-label="Buscar repuesto"
                                    className={cn(input.base, input.size.md, input.withLeadingIcon)}
                                />
                                {buscando && (
                                    <Loader2
                                        size={16}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-fg-subtle"
                                        aria-hidden="true"
                                    />
                                )}
                            </div>

                            <div className="mt-3 divide-y divide-subtle">
                                {termino.trim().length < 2 && (
                                    <p className="py-10 text-center text-sm text-fg-muted">
                                        Buscá el repuesto en el catálogo para anotarlo.
                                    </p>
                                )}
                                {resultados.map((p) => {
                                    const stock = stockUtil(p);
                                    return (
                                        <button
                                            key={p.product_id}
                                            onClick={() => setElegido(p)}
                                            className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-surface-hover"
                                        >
                                            <Miniatura url={p.image_url} alt={p.name} />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium text-fg line-clamp-2 leading-snug">{p.name}</p>
                                                <p className="text-2xs text-fg-subtle truncate">{p.sku}</p>
                                            </div>
                                            <span
                                                className={cn(
                                                    badge.base,
                                                    badge.size.sm,
                                                    stock.hay ? badge.tone.success : badge.tone.danger,
                                                    'shrink-0',
                                                )}
                                            >
                                                {stock.hay ? 'hay stock' : 'sin stock'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 rounded-xl border border-subtle bg-surface-2 p-3">
                                <Miniatura url={elegido.image_url} alt={elegido.name} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-fg leading-snug">{elegido.name}</p>
                                    <p className="text-2xs text-fg-subtle">
                                        {elegido.sku}
                                        {elegido.price != null && ` · ${formatearPrecio(precioParaCliente(elegido.price))}`}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setElegido(null)}
                                    className={cn(button.base, button.variant.ghost, button.size.xs)}
                                >
                                    Cambiar
                                </button>
                            </div>

                            {/* Si YA hay stock, anotar un pedido es un error: hay que
                                venderlo ahora, no ponerlo a esperar. */}
                            {stockUtil(elegido).hay && (
                                <p className="mt-2 text-xs text-warning-soft-fg bg-warning-soft border border-warning/30 rounded-lg px-3 py-2">
                                    Ojo: este repuesto SÍ tiene stock. Si lo hay, conviene cotizarlo y venderlo ahora
                                    en vez de dejarlo anotado.
                                </p>
                            )}

                            <label className="block mt-3">
                                <span className="text-xs font-semibold text-fg-muted">Nota (opcional)</span>
                                <textarea
                                    value={notas}
                                    onChange={(e) => setNotas(e.target.value)}
                                    rows={3}
                                    placeholder="Marca, modelo, año, color… lo que sirva para conseguirlo."
                                    className={cn(input.textarea, 'mt-1')}
                                />
                            </label>

                            <p className="mt-2 text-2xs text-fg-subtle">
                                Se anota para {customerName ? `${customerName} · ` : ''}
                                {phoneNumber}
                            </p>
                        </>
                    )}

                    {error && <p className="mt-3 text-xs text-danger">{error}</p>}
                    {aviso && <p className="mt-3 text-xs text-warning-soft-fg">{aviso}</p>}
                </div>

                <div className={modal.footer}>
                    <button onClick={onClose} className={cn(button.base, button.variant.secondary, button.size.md)}>
                        Cancelar
                    </button>
                    <button
                        onClick={guardar}
                        disabled={!elegido || guardando}
                        className={cn(button.base, button.variant.primary, button.size.md)}
                    >
                        {guardando ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Package size={15} aria-hidden="true" />
                        )}
                        Anotar pedido
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegistrarPedidoModal;
