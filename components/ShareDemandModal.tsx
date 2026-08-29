import React, { useLayoutEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Copy,
  Loader2,
  Package,
  Phone,
  Share2,
  User,
  X,
} from 'lucide-react';
import { precioParaCliente } from '../utils/precioCliente';

interface ProductDemand {
    id: number;
    phone_number: string;
    customer_name: string | null;
    status: string;
    created_at: string;
    product?: {
        name: string;
        sku: string;
        price?: number;
        image_url?: string | null;
        importer_stock?: number;
        inventory_levels?: { current_stock: number }[];
    } | null;
}

interface ShareDemandModalProps {
    isOpen: boolean;
    onClose: () => void;
    demand: ProductDemand | null;
}

/** Lado del ticket que se captura. La imagen que se manda al cliente es cuadrada. */
const TICKET_SIZE = 500;

export const ShareDemandModal: React.FC<ShareDemandModalProps> = ({
    isOpen,
    onClose,
    demand
}) => {
    const printRef = useRef<HTMLDivElement>(null);
    const holderRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);

    /*
        Cuánto hay que encoger el ticket para que quepa en pantalla.

        El ticket mide 500×500 fijos porque ése es el tamaño de la imagen que se
        envía al cliente. Pero colgaba suelto de un contenedor flex, y un hijo de
        flex se encoge: en un teléfono de 360px el ancho bajaba a unos 280
        mientras el alto seguía clavado en 500. El cuadrado se volvía un
        rectángulo alto y todo lo de dentro —la foto del repuesto, los textos,
        los márgenes— salía estirado.

        Ahora se escala de verdad, con `transform`. El elemento que captura
        html2canvas conserva su caja de 500×500, así que la imagen generada no
        cambia ni pierde resolución; lo único que se encoge es cómo se ve.
    */
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        if (!isOpen) return;
        const measure = () => {
            const width = holderRef.current?.clientWidth ?? TICKET_SIZE;
            setScale(Math.min(1, width / TICKET_SIZE));
        };
        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
        };
    }, [isOpen]);

    if (!isOpen || !demand) return null;

    const getStockValue = (prod: any) => {
        if (!prod) return 0;
        const local = prod.inventory_levels ? prod.inventory_levels.reduce((acc: number, lvl: any) => acc + (lvl.current_stock || 0), 0) : 0;
        return local + (prod.importer_stock || 0);
    };

    const getStatusText = (status: string) => {
        if (status === 'pending_stock') return 'Esperando Stock';
        if (status === 'stock_available') return 'Stock Disponible';
        if (status === 'notified') return 'Notificado';
        if (status === 'cancelled') return 'Cancelado';
        if (status === 'expired') return 'Vencido';
        return status;
    };

    const handleCopyImage = async () => {
        if (!printRef.current) return;
        setLoading(true);
        try {
            const canvas = await html2canvas(printRef.current, {
                useCORS: true,
                scale: 4, // Super high resolution
                backgroundColor: '#ffffff'
            });

            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error('No se pudo generar la imagen');
                
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    alert('Imagen copiada al portapapeles con éxito. Puedes pegarla donde quieras.');
                    onClose();
                } catch (clipboardError) {
                    console.error('Clipboard error:', clipboardError);
                    alert('La API del portapapeles bloqueó la copia o no es compatible. Por favor intenta usando Google Chrome o Edge.');
                }
            }, 'image/png', 1.0);
        } catch (error) {
            console.error('Error copiando imagen:', error);
            alert('Error al generar la imagen. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    // Para el ticket siempre asumimos 0 en local porque se usa para capturar demanda
    const localStock = 0;
    const importerStock = demand.product?.importer_stock || 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            {/* `w-full max-w-[550px]`: eran 550px fijos, más ancho que cualquier
                teléfono, así que el panel se salía de la pantalla y arrastraba
                consigo el aplastamiento del ticket. */}
            <div className="bg-surface rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col w-full max-w-[550px] max-h-[92dvh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <h2 className="text-lg font-bold tracking-tight text-fg flex items-center gap-2">
                        <Share2 size={20} className="text-primary" aria-hidden="true" />
                        Compartir Solicitud
                    </h2>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                {/*
                    Contenido (El div que será capturado).

                    `on-paper` fuerza la paleta clara en el ticket: se dibuja
                    siempre sobre blanco, así que sin ella los tokens de texto
                    (`text-fg`, `text-fg-muted`) resolvían a casi blanco cuando el
                    usuario tenía el tema oscuro, y la imagen enviada al cliente
                    salía ilegible. Ver la definición en index.html.
                */}
                <div ref={holderRef} className="p-4 sm:p-6 bg-surface-3 overflow-y-auto">
                    {/* Hueco ya escalado: si no, el panel seguiría reservando los
                        500px de alto aunque el ticket se vea más pequeño. */}
                    <div
                        className="relative mx-auto"
                        style={{ width: TICKET_SIZE * scale, height: TICKET_SIZE * scale }}
                    >
                    {/* Contenedor Cuadrado con Margen */}
                    <div
                        ref={printRef}
                        className="on-paper bg-white flex items-center justify-center absolute top-0 left-0"
                        style={{
                            width: `${TICKET_SIZE}px`,
                            height: `${TICKET_SIZE}px`,
                            padding: '24px',
                            boxSizing: 'border-box',
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                        }}
                    >
                        {/* Tarjeta del Ticket interna */}
                        <div className="bg-white rounded-xl shadow-sm border border-subtle flex flex-col overflow-hidden w-full h-full relative">
                            {/* Decorative Top Border */}
                            <div className="h-2 w-full bg-primary"></div>
                            
                            <div className="flex-1 flex flex-col p-6">
                            
                            {/* Ticket Title */}
                            <div className="text-center mb-3">
                                <span className={`text-[14px] font-bold tracking-widest uppercase ${importerStock > 0 ? 'text-primary' : 'text-warning'}`}>
                                    {importerStock > 0 ? 'TICKET DE PEDIDO' : 'YA ESTAS EN LA LISTA DE ESPERA'}
                                </span>
                            </div>

                            {/* Product Info Section */}
                            <div className="flex gap-4 items-center mb-4">
                                {demand.product?.image_url ? (
                                    <div className="w-20 h-20 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0 flex items-center justify-center">
                                        <img 
                                            src={demand.product.image_url} 
                                            alt={demand.product.sku} 
                                            className="w-full h-full object-contain"
                                            crossOrigin="anonymous" 
                                        />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 border border-subtle text-fg-subtle">
                                        <Package size={32} aria-hidden="true" />
                                    </div>
                                )}
                                
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[11px] font-bold text-primary tracking-wider uppercase">{demand.product?.sku}</span>
                                        <span className="text-2xs font-mono bg-primary-soft text-primary-soft-fg px-2 py-0.5 rounded-full font-bold">Ticket #{demand.id}</span>
                                    </div>
                                    <h3 className="text-[14px] font-semibold text-fg leading-tight">{demand.product?.name || 'Producto Desconocido'}</h3>
                                    {demand.product?.price != null && (
                                        <div className="mt-1 flex items-baseline gap-1">
                                            <span className="text-[15px] font-bold text-success">${precioParaCliente(demand.product.price)}</span>
                                            {importerStock <= 0 && <span className="text-[11px] font-medium text-fg-muted">(precio estimado)</span>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <hr className="border-slate-100 my-1" />

                            {/* Client Info Section */}
                            <div className="py-2 flex-1 flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <User size={14} className="text-fg-subtle" aria-hidden="true" />
                                    {demand.customer_name && demand.customer_name.trim() !== '' ? (
                                        <span className="text-fg font-medium text-sm">{demand.customer_name}</span>
                                    ) : (
                                        <span className="text-fg-subtle italic text-sm">No registrado</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-fg-subtle" aria-hidden="true" />
                                    <span className="text-fg font-bold font-mono text-sm">{demand.phone_number}</span>
                                </div>
                            </div>

                            <hr className="border-slate-100 my-1" />

                            {/* Footer Info Section */}
                            <div className="pt-2 grid grid-cols-2 gap-x-2 gap-y-3">
                                <div className="flex flex-col">
                                    <span className="text-[12px] uppercase tracking-wider text-fg-subtle font-bold mb-0.5">Estado</span>
                                    <span className="text-[14px] font-semibold text-fg">{getStatusText(demand.status)}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] uppercase tracking-wider text-fg-subtle font-bold mb-0.5">Fecha Solicitud</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[14px] text-fg-muted">{new Date(demand.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        <span className="text-[11px] font-bold text-danger bg-danger-soft px-1.5 py-0.5 rounded" title="Fecha de Vencimiento">
                                            Vence: {new Date(new Date(demand.created_at).getTime() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] uppercase tracking-wider text-fg-subtle font-bold mb-0.5">Stock Local</span>
                                    <span className={`text-[14px] font-bold ${localStock > 0 ? 'text-success' : 'text-danger'}`}>
                                        {localStock > 0 ? `${localStock} un.` : 'Agotado'}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] uppercase tracking-wider text-fg-subtle font-bold mb-0.5">Stock Importadora</span>
                                    <span className={`text-[14px] font-bold ${importerStock > 0 ? 'text-primary' : 'text-danger'}`}>
                                        {importerStock > 0 ? `${importerStock} un.` : 'Agotado'}
                                    </span>
                                </div>
                            </div>

                            {/* Disclaimer & Website */}
                            <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col items-center text-center">
                                <span className="text-[12px] text-fg font-semibold leading-snug max-w-[95%] mb-2">
                                    {importerStock > 0 
                                        ? "Este es tu ticket de pedido. Los pedidos se suelen demorar DE 6 A 15 DIAS LABORABLES. Gracias por confiar en nosotros."
                                        : "Estas en la lista de espera. Nosotros le daremos seguimiento a tu repuesto y solicitud. Apenas el repuesto vuelva a estar disponible, NOSOTROS NOS COMUNICAREMOS CONTIGO."}
                                </span>
                                <span className="text-[14px] font-bold text-primary">https://www.lvparts.ec/</span>
                            </div>
                            
                        </div>
                        </div>
                    </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-subtle flex justify-end gap-3 bg-surface">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-fg-muted bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyImage}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Copy size={18} aria-hidden="true" />
                                Copiar como Imagen
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
