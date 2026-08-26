import React from 'react';
import { STOCK_STATUS_LABELS, type ProformaStockInfo } from '../../utils/proformaStock';
import type { ChatProforma } from '../../store/useChatProformaStore';
import { subtotalDe, totalDe } from '../../store/useChatProformaStore';

/**
 * La hoja de la proforma que se le manda al cliente por WhatsApp.
 *
 * Es el MISMO diseño que la proforma del POS
 * (`components/ProformaPreviewModal.tsx`): el cliente puede recibir una
 * cotización por WhatsApp hoy y otra desde el mostrador mañana, y si no
 * se parecen entre sí no parecen del mismo negocio.
 *
 * Va aparte, y recibe los datos por props en vez de leerlos de un store,
 * porque acá se renderiza FUERA DE PANTALLA para capturarla con
 * html2canvas y subir el PNG (ver `capturarProforma`). Un componente atado
 * a un store no se puede renderizar dos veces con datos distintos, que es
 * justo lo que hace falta cuando hay varias conversaciones abiertas.
 *
 * Ancho fijo de 650px a propósito: es el tamaño con el que se captura, así
 * que la imagen que recibe el cliente no depende del tamaño de la pantalla
 * del vendedor. `on-paper` (definida en index.html) fuerza la paleta clara
 * dentro de este subárbol -- sin ella, con el tema oscuro la tinta salía
 * casi blanca sobre el papel blanco y los repuestos quedaban ilegibles.
 */

export const BUSINESS_NAME = 'LV Parts';
export const BUSINESS_URL = 'https://www.lvparts.ec/';
/** Ancho de captura, en px. Ver el comentario de arriba. */
export const PROFORMA_WIDTH = 650;

const ESTILO_STOCK: Record<string, string> = {
    in_stock: 'bg-success-soft text-success',
    backorder: 'bg-warning-soft text-warning',
    out_of_stock: 'bg-danger-soft text-danger',
};

interface Props {
    proforma: ChatProforma;
    /** Disponibilidad por producto; si falta, no se muestra la etiqueta. */
    stockInfo: Record<number, ProformaStockInfo>;
    /** Nombre del cliente, para encabezar la cotización. */
    clienteNombre: string | null;
    /** Número visible de la proforma, si se le asignó uno. */
    numero?: string | null;
}

export const ProformaDocument = React.forwardRef<HTMLDivElement, Props>(
    ({ proforma, stockInfo, clienteNombre, numero }, ref) => {
        const hoy = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
        const subtotal = subtotalDe(proforma);
        const total = totalDe(proforma);

        return (
            <div ref={ref} className="on-paper bg-white shrink-0" style={{ width: `${PROFORMA_WIDTH}px` }}>
                <div className="border border-subtle rounded-xl overflow-hidden">
                    <div className="h-2 w-full bg-success" />

                    <div className="p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-fg">{BUSINESS_NAME}</h3>
                                <span className="text-sm text-success font-semibold">{BUSINESS_URL}</span>
                            </div>
                            <div className="text-right">
                                <span className="inline-block text-[11px] font-bold tracking-widest uppercase text-white bg-slate-800 px-3 py-1 rounded-full">
                                    Proforma
                                </span>
                                {numero && <p className="text-xs font-bold text-fg mt-2">N.° {numero}</p>}
                                <p className="text-xs text-fg-muted mt-1">{hoy}</p>
                            </div>
                        </div>

                        {clienteNombre && (
                            <p className="mb-4 text-sm text-fg">
                                <span className="text-fg-muted">Para: </span>
                                <span className="font-semibold">{clienteNombre}</span>
                            </p>
                        )}

                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-800">
                                    <th className="text-left py-2 font-bold text-fg text-xs uppercase tracking-wide">SKU</th>
                                    <th className="text-left py-2 font-bold text-fg text-xs uppercase tracking-wide">Descripción</th>
                                    <th className="text-center py-2 font-bold text-fg text-xs uppercase tracking-wide">Cant</th>
                                    <th className="text-right py-2 font-bold text-fg text-xs uppercase tracking-wide">P. Unit</th>
                                    <th className="text-right py-2 font-bold text-fg text-xs uppercase tracking-wide">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {proforma.items.map((item) => {
                                    const estado = stockInfo[item.productId]?.status;
                                    return (
                                        <tr key={item.id} className="border-b border-slate-100">
                                            <td className="py-2.5 font-mono text-[11px] font-bold text-fg-muted">{item.sku}</td>
                                            <td className="py-2.5 text-fg font-medium">
                                                {item.name}
                                                {estado && (
                                                    <span
                                                        className={`ml-2 inline-block text-[12px] font-bold px-1.5 py-0.5 rounded-full align-middle ${ESTILO_STOCK[estado]}`}
                                                    >
                                                        {STOCK_STATUS_LABELS[estado]}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 text-center text-fg">{item.quantity}</td>
                                            <td className="py-2.5 text-right text-fg">${item.unitPrice.toFixed(2)}</td>
                                            <td className="py-2.5 text-right font-bold text-fg">
                                                ${(item.quantity * item.unitPrice).toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="mt-4 flex justify-end">
                            <div className="w-64">
                                <div className="flex justify-between py-1 text-sm text-fg-muted">
                                    <span>Subtotal</span>
                                    <span className="font-semibold">${subtotal.toFixed(2)}</span>
                                </div>
                                {proforma.shippingEnabled && (
                                    <div className="flex justify-between py-1 text-sm text-fg-muted">
                                        <span>Envío</span>
                                        <span className="font-semibold">${proforma.shippingCost.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between py-2 mt-1 border-t-2 border-slate-800 text-base">
                                    <span className="font-bold text-fg">Total</span>
                                    <span className="font-bold text-success">${total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {proforma.nota.trim() && (
                            <p className="mt-5 text-xs text-fg-muted whitespace-pre-wrap border-t border-slate-100 pt-3">
                                {proforma.nota.trim()}
                            </p>
                        )}

                        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                            <span className="text-xs font-bold text-success">{BUSINESS_URL}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    },
);

ProformaDocument.displayName = 'ProformaDocument';
