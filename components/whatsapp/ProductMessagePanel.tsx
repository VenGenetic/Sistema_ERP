import React, { useEffect, useState } from 'react';
import { Box, ImageOff, Loader2, PackagePlus, RefreshCw, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { badge, button, cn } from '../ui/styles';
import { formatearPrecio, precioParaCliente, stockUtil, type ProductoCatalogo } from '../../utils/whatsappOutbox';

interface Props {
    productId: number;
    onClose: () => void;
    onCotizar: (producto: ProductoCatalogo) => void;
}

const ProductMessagePanel: React.FC<Props> = ({ productId, onClose, onCotizar }) => {
    const [producto, setProducto] = useState<ProductoCatalogo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let vigente = true;
        setLoading(true);
        setError(null);
        supabase
            .from('products')
            .select('id, name, sku, price, image_url, local_stock, importer_stock, importer_unavailable_override, gallery')
            .eq('id', productId)
            .maybeSingle()
            .then(({ data, error: queryError }) => {
                if (!vigente) return;
                if (queryError) setError(queryError.message);
                else if (!data) setError('Este repuesto ya no existe en el catálogo.');
                else setProducto({
                    product_id: data.id,
                    name: data.name,
                    sku: data.sku,
                    price: data.price,
                    image_url: data.image_url,
                    local_stock: data.local_stock,
                    importer_stock: data.importer_stock,
                    importer_unavailable_override: data.importer_unavailable_override,
                    gallery: Array.isArray(data.gallery) ? data.gallery : [],
                });
                setLoading(false);
            });
        return () => { vigente = false; };
    }, [productId, reload]);

    const stock = producto ? stockUtil(producto) : null;

    return (
        <aside aria-label="Detalle del repuesto" className="flex h-full flex-col bg-surface">
            <header className="flex items-center gap-3 border-b border-subtle px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary"><Box size={18} /></div>
                <div className="min-w-0 flex-1"><p className="text-2xs font-bold uppercase tracking-wider text-primary">Repuesto del mensaje</p><h2 className="truncate text-sm font-bold text-fg">Detalle interno</h2></div>
                <button type="button" onClick={onClose} aria-label="Cerrar detalle del repuesto" className="flex h-9 w-9 items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg"><X size={18} /></button>
            </header>

            {loading ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-fg-muted"><Loader2 size={18} className="animate-spin" /> Cargando repuesto…</div>
            ) : error || !producto ? (
                <div className="m-4 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
                    <p>{error || 'No se pudo cargar el repuesto.'}</p>
                    <button type="button" onClick={() => setReload((value) => value + 1)} className="mt-3 inline-flex items-center gap-2 font-semibold hover:underline"><RefreshCw size={14} /> Reintentar</button>
                </div>
            ) : (
                <>
                    <div className="min-h-0 flex-1 overflow-y-auto wa-scroll p-4">
                        {producto.image_url ? <img src={producto.image_url} alt={producto.name} className="aspect-square w-full rounded-xl border border-subtle bg-surface-2 object-contain" /> : <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-subtle bg-surface-2 text-fg-subtle"><ImageOff size={32} /></div>}
                        <h3 className="mt-4 text-base font-bold leading-snug text-fg">{producto.name}</h3>
                        <p className="mt-1 font-mono text-xs text-fg-muted">SKU {producto.sku}</p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-subtle bg-surface-2 p-3"><p className="text-2xs uppercase text-fg-muted">Precio cliente</p><p className="mt-1 text-lg font-bold text-fg">{producto.price != null ? formatearPrecio(precioParaCliente(producto.price)) : 'Sin precio'}</p></div>
                            <div className="rounded-xl border border-subtle bg-surface-2 p-3"><p className="text-2xs uppercase text-fg-muted">Disponibilidad</p><span className={cn(badge.base, badge.size.sm, 'mt-1', stock?.local ? badge.tone.success : stock?.hay ? badge.tone.warning : badge.tone.danger)}>{stock?.local ? `${stock.local} en local` : stock?.hay ? `${stock.importador} importador` : 'Sin stock'}</span></div>
                        </div>
                        <p className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-xs text-primary">Esta ficha solo es visible para el equipo. El cliente no recibe este enlace ni estos datos internos.</p>
                    </div>
                    <footer className="border-t border-subtle p-3">
                        <button type="button" onClick={() => onCotizar(producto)} className={cn(button.base, button.variant.primary, button.size.md, 'w-full')}><PackagePlus size={17} /> Agregar a proforma</button>
                    </footer>
                </>
            )}
        </aside>
    );
};

export default ProductMessagePanel;
