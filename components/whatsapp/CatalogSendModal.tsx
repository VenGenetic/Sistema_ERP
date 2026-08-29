import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImageOff, Loader2, Minus, Package, Plus, Search, Send, Trash2, X, ZoomIn } from 'lucide-react';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { badge, button, cn, focusRing, input, modal } from '../ui/styles';
import { MediaLightbox, type MediaItem } from '../MediaLightbox';
import {
    buscarEnCatalogo,
    formatearPrecio,
    fotosDe,
    mimeDeUrl,
    precioParaCliente,
    stockUtil,
    textoDeProducto,
    type NuevoMensaje,
    type ProductoCatalogo,
} from '../../utils/whatsappOutbox';

/**
 * Buscar un repuesto en el catálogo y mandárselo al cliente por WhatsApp,
 * con foto y precio, sin salir de la conversación.
 *
 * Por qué existe: es LO que hace quien atiende todo el día. Antes había
 * que abrir el catálogo en otra pestaña, buscar el repuesto, descargar la
 * foto, volver al WhatsApp del teléfono, adjuntarla y escribir el precio a
 * mano -- seis pasos, dos sistemas, y el precio tipeado de memoria (con lo
 * que a veces se cotizaba distinto de lo que cotiza el bot).
 *
 * Acá es: buscar, elegir, enviar. El precio y la disponibilidad salen del
 * catálogo con las MISMAS reglas que usa el agente (ver
 * `utils/whatsappOutbox.ts`), así que el cliente escucha siempre lo mismo
 * conteste quien conteste.
 */

interface Props {
    isOpen: boolean;
    onClose: () => void;
    conversationId: number;
    /** Nombre del cliente, solo para encabezar el modal. */
    clienteLabel: string;
    /** Se llama con los mensajes ya armados; el que abre decide cómo encolarlos. */
    onEnviar: (mensajes: NuevoMensaje[]) => Promise<void>;
}

/** Un producto elegido, con lo que se le va a mandar al cliente. */
interface Armado {
    producto: ProductoCatalogo;
    /** Fotos marcadas para enviar, en orden. */
    fotos: string[];
    texto: string;
    incluirPrecio: boolean;
    incluirDisponibilidad: boolean;
    /**
     * Precio a cotizar. Arranca en el del catálogo y se puede subir o
     * bajar: el de lista no siempre es el que se cierra.
     */
    precio: number;
    /** Si alguien tocó el texto a mano, los interruptores dejan de pisarlo. */
    textoEditado: boolean;
}

function armadoInicial(producto: ProductoCatalogo): Armado {
    const opciones = {
        incluirPrecio: true,
        incluirDisponibilidad: true,
        precio: producto.price != null ? precioParaCliente(producto.price) : 0,
    };
    const fotos = fotosDe(producto);
    return {
        producto,
        // La foto principal va marcada; el resto de la galería se agrega a mano.
        fotos: fotos.slice(0, 1),
        texto: textoDeProducto(producto, opciones),
        ...opciones,
        textoEditado: false,
    };
}

/** Miniatura con respaldo cuando el producto no tiene foto o el enlace está roto. */
const Miniatura: React.FC<{ url: string | null; alt: string; className?: string }> = ({ url, alt, className }) => {
    const [falló, setFalló] = useState(false);
    if (!url || falló) {
        return (
            <div className={cn('flex items-center justify-center bg-surface-3 text-fg-subtle', className)}>
                <ImageOff size={18} aria-hidden="true" />
            </div>
        );
    }
    return <img src={url} alt={alt} loading="lazy" onError={() => setFalló(true)} className={cn('object-cover bg-surface-3', className)} />;
};

export const CatalogSendModal: React.FC<Props> = ({ isOpen, onClose, conversationId, clienteLabel, onEnviar }) => {
    const [termino, setTermino] = useState('');
    const [resultados, setResultados] = useState<ProductoCatalogo[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
    const [buscado, setBuscado] = useState(false);
    const [armados, setArmados] = useState<Armado[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

    /**
     * La foto del repuesto en grande.
     *
     * Acá la tarjeta entera es el botón que elige el producto, así que la
     * lupa va aparte, en una esquina: si la foto abriera el visor, elegir un
     * repuesto se volvería un juego de puntería.
     */
    const [foto, setFoto] = useState<MediaItem[]>([]);

    const verFoto = useCallback((p: ProductoCatalogo) => {
        if (!p.image_url) return;
        const título = `${p.sku} - ${p.name}`;
        setFoto([
            { type: 'image', url: p.image_url, title: título },
            ...(p.gallery ?? [])
                .filter((m) => m?.url && m.url !== p.image_url)
                .map((m) => ({ type: m.type, url: m.url, title: título })),
        ]);
    }, []);

    const inputRef = useRef<HTMLInputElement>(null);
    const enviandoRef = useRef(false);

    useBackDismiss(isOpen, onClose);

    // Al abrir: foco en el buscador y hoja en blanco. Sin esto, reabrir el
    // modal mostraba la búsqueda del cliente ANTERIOR, con el riesgo de
    // mandarle a este cliente el repuesto del otro.
    useEffect(() => {
        if (!isOpen) return;
        setTermino('');
        setResultados([]);
        setArmados([]);
        setBuscado(false);
        setErrorBusqueda(null);
        setErrorEnvio(null);
        const t = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    // La búsqueda va contra la base (RPC de similitud): se espera a que la
    // persona termine de escribir en vez de consultar por cada tecla.
    useEffect(() => {
        if (!isOpen) return;
        const texto = termino.trim();
        if (texto.length < 2) {
            setResultados([]);
            setBuscado(false);
            return;
        }
        let cancelado = false;
        setBuscando(true);
        const t = setTimeout(async () => {
            try {
                const filas = await buscarEnCatalogo(texto);
                if (cancelado) return;
                setResultados(filas);
                setErrorBusqueda(null);
            } catch (err: any) {
                if (cancelado) return;
                setErrorBusqueda(err?.message ?? 'No se pudo buscar en el catálogo.');
                setResultados([]);
            } finally {
                if (!cancelado) {
                    setBuscando(false);
                    setBuscado(true);
                }
            }
        }, 300);
        return () => {
            cancelado = true;
            clearTimeout(t);
        };
    }, [termino, isOpen]);

    const yaElegido = useCallback(
        (id: number) => armados.some((a) => a.producto.product_id === id),
        [armados],
    );

    const alternarProducto = (producto: ProductoCatalogo) => {
        setArmados((prev) =>
            prev.some((a) => a.producto.product_id === producto.product_id)
                ? prev.filter((a) => a.producto.product_id !== producto.product_id)
                : [...prev, armadoInicial(producto)],
        );
    };

    const actualizar = (productId: number, cambios: Partial<Armado>) => {
        setArmados((prev) =>
            prev.map((a) => {
                if (a.producto.product_id !== productId) return a;
                const siguiente = { ...a, ...cambios };
                // Los interruptores de precio/disponibilidad re-arman el texto,
                // salvo que alguien ya lo haya escrito a su manera: pisarle lo
                // que escribió sería perder trabajo hecho.
                const tocaronInterruptores =
                    cambios.incluirPrecio !== undefined ||
                    cambios.incluirDisponibilidad !== undefined ||
                    cambios.precio !== undefined;
                if (tocaronInterruptores && !siguiente.textoEditado) {
                    siguiente.texto = textoDeProducto(siguiente.producto, {
                        incluirPrecio: siguiente.incluirPrecio,
                        incluirDisponibilidad: siguiente.incluirDisponibilidad,
                        precio: siguiente.precio,
                    });
                }
                return siguiente;
            }),
        );
    };

    const alternarFoto = (productId: number, url: string) => {
        setArmados((prev) =>
            prev.map((a) => {
                if (a.producto.product_id !== productId) return a;
                const fotos = a.fotos.includes(url) ? a.fotos.filter((f) => f !== url) : [...a.fotos, url];
                return { ...a, fotos };
            }),
        );
    };

    /**
     * Traduce lo elegido a mensajes de WhatsApp.
     *
     * Con varias fotos del mismo repuesto, el texto va SOLO en la primera:
     * repetir el precio debajo de cada foto es exactamente lo que hace que
     * un chat se vea automatizado.
     */
    const mensajes: NuevoMensaje[] = useMemo(
        () =>
            armados.flatMap<NuevoMensaje>((a) => {
                const texto = a.texto.trim();
                if (a.fotos.length === 0) {
                    return texto
                        ? [{ conversationId, body: texto, kind: 'text' as const, productId: a.producto.product_id }]
                        : [];
                }
                return a.fotos.map((url, i) => {
                    const mime = mimeDeUrl(url);
                    return {
                        conversationId,
                        body: i === 0 ? texto : null,
                        kind: 'image' as const,
                        mediaUrl: url,
                        mediaMime: mime,
                        mediaFilename: `${a.producto.sku}.${mime.split('/')[1]}`,
                        productId: a.producto.product_id,
                    };
                });
            }),
        [armados, conversationId],
    );

    const enviar = async () => {
        if (mensajes.length === 0 || enviandoRef.current) return;
        enviandoRef.current = true;
        setEnviando(true);
        setErrorEnvio(null);
        try {
            await onEnviar(mensajes);
            onClose();
        } catch (err: any) {
            setErrorEnvio(err?.message ?? 'No se pudo encolar el envío.');
        } finally {
            enviandoRef.current = false;
            setEnviando(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={cn(modal.overlay, 'lg:pointer-events-none lg:justify-end lg:bg-transparent lg:p-0 lg:backdrop-blur-none')} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={cn(modal.panel, modal.width.full, 'lg:pointer-events-auto lg:h-full lg:max-h-full lg:w-[520px] lg:max-w-[520px] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-2xl')} role="dialog" aria-modal="true" aria-label="Enviar del catálogo">
                <div className={modal.header}>
                    <div>
                        <h2 className={modal.title}>Enviar del catálogo</h2>
                        <p className={modal.subtitle}>
                            Buscá el repuesto y mandáselo a {clienteLabel} con foto y precio.
                        </p>
                    </div>
                    <button onClick={onClose} className={modal.close} aria-label="Cerrar">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="grid grid-cols-1 flex-1 min-h-0 divide-y divide-subtle overflow-y-auto">
                    {/* Buscador + resultados */}
                    <div className="flex flex-col min-h-0">
                        <div className="px-5 py-3 border-b border-subtle">
                            <div className="relative">
                                <Search size={16} className={input.leadingIcon} aria-hidden="true" />
                                <input
                                    ref={inputRef}
                                    value={termino}
                                    onChange={(e) => setTermino(e.target.value)}
                                    placeholder="Buscar repuesto… (ej. aro delantero, cdi, espejo)"
                                    aria-label="Buscar en el catálogo"
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
                            <p className="text-2xs text-fg-subtle mt-1.5">
                                Busca igual que el agente: tolera errores de tipeo y entiende los nombres que usa el cliente.
                            </p>
                        </div>

                        <div className="overflow-y-auto p-4 flex-1 min-h-0">
                            {errorBusqueda && <p className="text-sm text-danger">{errorBusqueda}</p>}

                            {!errorBusqueda && termino.trim().length < 2 && (
                                <div className="py-14 text-center text-sm text-fg-muted flex flex-col items-center gap-2">
                                    <Package size={22} className="text-fg-subtle" aria-hidden="true" />
                                    Escribí el nombre del repuesto para buscarlo.
                                </div>
                            )}

                            {!errorBusqueda && buscado && !buscando && resultados.length === 0 && termino.trim().length >= 2 && (
                                <div className="py-14 text-center text-sm text-fg-muted">
                                    Ningún repuesto coincide con “{termino.trim()}”.
                                    <br />
                                    <span className="text-2xs text-fg-subtle">
                                        Probá con menos palabras o con el nombre de la pieza sola.
                                    </span>
                                </div>
                            )}

                            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                                {resultados.map((p) => {
                                    const elegido = yaElegido(p.product_id);
                                    const stock = stockUtil(p);
                                    return (
                                        <div
                                            key={p.product_id}
                                            role="button"
                                            tabIndex={0}
                                            aria-pressed={elegido}
                                            onClick={() => alternarProducto(p)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    alternarProducto(p);
                                                }
                                            }}
                                            className={cn(
                                                focusRing,
                                                'cursor-pointer text-left rounded-xl border overflow-hidden transition-colors',
                                                elegido
                                                    ? 'border-primary bg-primary-soft/50'
                                                    : 'border-subtle bg-surface hover:border-strong hover:bg-surface-hover',
                                            )}
                                        >
                                            <div className="relative">
                                                <Miniatura url={p.image_url} alt={p.name} className="w-full h-28" />
                                                {p.image_url && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            verFoto(p);
                                                        }}
                                                        title="Ver la foto en grande"
                                                        aria-label={`Ver la foto de ${p.name} en grande`}
                                                        className={cn(
                                                            focusRing,
                                                            'absolute top-1.5 left-1.5 rounded-full bg-black/55 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/75',
                                                        )}
                                                    >
                                                        <ZoomIn size={12} aria-hidden="true" />
                                                    </button>
                                                )}
                                                {elegido && (
                                                    <span className="absolute top-1.5 right-1.5 rounded-full bg-primary text-primary-fg p-1">
                                                        <Check size={12} aria-hidden="true" />
                                                    </span>
                                                )}
                                            </div>
                                            <div className="p-2.5">
                                                <p className="text-xs font-medium text-fg line-clamp-2 leading-snug">{p.name}</p>
                                                <div className="mt-1.5 flex items-center justify-between gap-2">
                                                    <span className="text-sm font-semibold text-fg tnum">
                                                        {p.price != null ? formatearPrecio(precioParaCliente(p.price)) : 'sin precio'}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            badge.base,
                                                            badge.size.sm,
                                                            stock.local > 0
                                                                ? badge.tone.success
                                                                : stock.hay
                                                                  ? badge.tone.warning
                                                                  : badge.tone.danger,
                                                        )}
                                                    >
                                                        {stock.local > 0
                                                            ? `${stock.local} en local`
                                                            : stock.hay
                                                              ? 'con importador'
                                                              : 'sin stock'}
                                                    </span>
                                                </div>
                                                <p className="text-2xs text-fg-subtle mt-1 truncate">{p.sku}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Lo que se va a enviar */}
                    <div className="flex flex-col min-h-0 bg-surface-2/40">
                        <div className="px-4 py-3 border-b border-subtle">
                            <p className="text-sm font-semibold text-fg">Para enviar ({armados.length})</p>
                            <p className="text-2xs text-fg-subtle mt-0.5">
                                Podés editar el texto: se manda tal cual quede acá.
                            </p>
                        </div>

                        <div className="overflow-y-auto flex-1 min-h-0 p-3 space-y-3">
                            {armados.length === 0 && (
                                <p className="text-sm text-fg-muted text-center py-10">
                                    Tocá un repuesto de la izquierda para agregarlo.
                                </p>
                            )}

                            {armados.length >= 2 && (
                                <div className="overflow-hidden rounded-xl border border-primary/20 bg-primary-soft/30">
                                    <div className="border-b border-primary/15 px-3 py-2"><p className="text-xs font-bold text-fg">Comparación rápida</p><p className="text-2xs text-fg-muted">Precio y disponibilidad de los seleccionados</p></div>
                                    <div className="overflow-x-auto"><table className="w-full text-[11px]"><thead className="text-left text-fg-muted"><tr><th className="px-3 py-1.5">Repuesto</th><th className="px-2 py-1.5 text-right">Precio</th><th className="px-3 py-1.5 text-right">Stock</th></tr></thead><tbody className="divide-y divide-primary/10">{armados.map((item) => { const stock = stockUtil(item.producto); return <tr key={`compare-${item.producto.product_id}`}><td className="max-w-40 truncate px-3 py-2 font-medium text-fg">{item.producto.name}</td><td className="px-2 py-2 text-right font-semibold tabular-nums text-fg">{formatearPrecio(item.precio)}</td><td className="px-3 py-2 text-right text-fg-muted">{stock.local > 0 ? `${stock.local} local` : stock.hay ? `${stock.importador} import.` : 'Agotado'}</td></tr>; })}</tbody></table></div>
                                </div>
                            )}

                            {armados.map((a) => {
                                const fotos = fotosDe(a.producto);
                                return (
                                    <div key={a.producto.product_id} className="rounded-xl border border-subtle bg-surface p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-xs font-semibold text-fg leading-snug">{a.producto.name}</p>
                                            <button
                                                onClick={() => alternarProducto(a.producto)}
                                                aria-label={`Quitar ${a.producto.name}`}
                                                className="shrink-0 p-1 rounded text-fg-subtle hover:text-danger hover:bg-danger-soft"
                                            >
                                                <Trash2 size={14} aria-hidden="true" />
                                            </button>
                                        </div>

                                        {fotos.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-2xs text-fg-subtle mb-1">
                                                    Fotos a enviar ({a.fotos.length} de {fotos.length})
                                                </p>
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {fotos.map((url) => {
                                                        const marcada = a.fotos.includes(url);
                                                        return (
                                                            <button
                                                                key={url}
                                                                onClick={() => alternarFoto(a.producto.product_id, url)}
                                                                aria-pressed={marcada}
                                                                aria-label={marcada ? 'Quitar esta foto' : 'Agregar esta foto'}
                                                                className={cn(
                                                                    'relative rounded-lg overflow-hidden border-2 transition-colors',
                                                                    marcada ? 'border-primary' : 'border-transparent opacity-50 hover:opacity-100',
                                                                )}
                                                            >
                                                                <Miniatura url={url} alt="" className="w-12 h-12" />
                                                                {marcada && (
                                                                    <span className="absolute inset-x-0 bottom-0 bg-primary text-primary-fg flex justify-center">
                                                                        <Check size={10} aria-hidden="true" />
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <textarea
                                            value={a.texto}
                                            onChange={(e) =>
                                                actualizar(a.producto.product_id, { texto: e.target.value, textoEditado: true })
                                            }
                                            rows={3}
                                            aria-label={`Mensaje para ${a.producto.name}`}
                                            className={cn(input.base, 'mt-2 py-2 px-2.5 text-xs resize-y')}
                                        />

                                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                                            <label className="flex items-center gap-1.5 text-2xs text-fg-muted">
                                                <input
                                                    type="checkbox"
                                                    className={input.checkbox}
                                                    checked={a.incluirPrecio}
                                                    onChange={(e) =>
                                                        actualizar(a.producto.product_id, { incluirPrecio: e.target.checked })
                                                    }
                                                />
                                                Precio
                                            </label>

                                            {/* Ajustar el precio sin tener que apagarlo y escribirlo
                                                a mano dentro del texto: así lo que se cotiza queda
                                                como número y no perdido en texto libre. */}
                                            {a.incluirPrecio && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() =>
                                                            actualizar(a.producto.product_id, {
                                                                precio: Math.max(0, a.precio - 1),
                                                            })
                                                        }
                                                        aria-label="Bajar un dólar"
                                                        className={cn(button.base, button.variant.secondary, button.icon.xs)}
                                                    >
                                                        <Minus size={11} aria-hidden="true" />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="0.5"
                                                        value={a.precio}
                                                        onChange={(e) =>
                                                            actualizar(a.producto.product_id, {
                                                                precio: Math.max(0, Number(e.target.value)),
                                                            })
                                                        }
                                                        aria-label={`Precio de ${a.producto.name}`}
                                                        className={cn(input.base, input.size.sm, input.numeric, 'w-16')}
                                                    />
                                                    <button
                                                        onClick={() =>
                                                            actualizar(a.producto.product_id, { precio: a.precio + 1 })
                                                        }
                                                        aria-label="Subir un dólar"
                                                        className={cn(button.base, button.variant.secondary, button.icon.xs)}
                                                    >
                                                        <Plus size={11} aria-hidden="true" />
                                                    </button>
                                                    {/* Si se movió del de lista se avisa: es fácil
                                                        mandar un precio ajustado sin darse cuenta. */}
                                                    {a.producto.price != null &&
                                                        a.precio !== precioParaCliente(a.producto.price) && (
                                                            <span className="text-2xs text-warning-soft-fg">
                                                                lista {formatearPrecio(precioParaCliente(a.producto.price))}
                                                            </span>
                                                        )}
                                                </div>
                                            )}

                                            <label className="flex items-center gap-1.5 text-2xs text-fg-muted">
                                                <input
                                                    type="checkbox"
                                                    className={input.checkbox}
                                                    checked={a.incluirDisponibilidad}
                                                    onChange={(e) =>
                                                        actualizar(a.producto.product_id, {
                                                            incluirDisponibilidad: e.target.checked,
                                                        })
                                                    }
                                                />
                                                Disponibilidad
                                            </label>
                                            {a.textoEditado && (
                                                <span className="text-2xs text-fg-subtle ml-auto">texto editado a mano</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className={modal.footer}>
                    {errorEnvio && <p className="text-xs text-danger mr-auto">{errorEnvio}</p>}
                    {!errorEnvio && mensajes.length > 0 && (
                        <p className="text-xs text-fg-muted mr-auto">
                            Se van a mandar {mensajes.length} mensaje{mensajes.length === 1 ? '' : 's'} al cliente.
                        </p>
                    )}
                    <button onClick={onClose} className={cn(button.base, button.variant.secondary, button.size.md)}>
                        Cancelar
                    </button>
                    <button
                        onClick={enviar}
                        disabled={mensajes.length === 0 || enviando}
                        className={cn(button.base, button.variant.primary, button.size.md)}
                    >
                        {enviando ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Send size={15} aria-hidden="true" />
                        )}
                        {enviando ? 'Enviando…' : 'Enviar al cliente'}
                    </button>
                </div>
            </div>

            <MediaLightbox isOpen={foto.length > 0} media={foto} onClose={() => setFoto([])} />
        </div>
    );
};

export default CatalogSendModal;
