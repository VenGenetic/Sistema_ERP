import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Download, MessageCircle, PackageSearch, RefreshCw, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { button, cn, focusRing, input } from '../components/ui/styles';
import { money } from '../utils/moneda';

interface Kpis { requests: number; customers: number; identified: number; quoted: number; sold: number; revenue: number; conversionRate: number; }
interface ProductRow { product_id: number | null; name: string; sku: string | null; requests: number; units: number; sold: number; }
interface ModelRow { make: string; model: string; year: number | null; requests: number; }
interface CustomerRow { name: string; phone: string | null; requests: number; purchases: number; value: number; }
interface DailyRow { day: string; requests: number; sold: number; }
interface FunnelRow { stage: string; value: number; }
interface Analytics { kpis: Kpis; topProducts: ProductRow[]; topModels: ModelRow[]; topCustomers: CustomerRow[]; daily: DailyRow[]; funnel: FunnelRow[]; generatedAt: string; }

const EMPTY: Analytics = { kpis: { requests: 0, customers: 0, identified: 0, quoted: 0, sold: 0, revenue: 0, conversionRate: 0 }, topProducts: [], topModels: [], topCustomers: [], daily: [], funnel: [], generatedAt: '' };

const MiniBar: React.FC<{ value: number; max: number; tone?: string }> = ({ value, max, tone = 'bg-primary' }) => (
    <div className="h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden="true"><div className={cn('h-full rounded-full transition-[width] duration-300', tone)} style={{ width: `${max ? Math.max(3, value / max * 100) : 0}%` }} /></div>
);

const WhatsAppAnalytics: React.FC = () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const [from, setFrom] = useState(monthAgo);
    const [to, setTo] = useState(today);
    const [data, setData] = useState<Analytics>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        const { data: result, error: rpcError } = await supabase.rpc('get_whatsapp_sales_analytics', {
            p_from: new Date(`${from}T00:00:00`).toISOString(), p_to: new Date(`${to}T23:59:59`).toISOString(),
        });
        if (rpcError) {
            setError(rpcError.code === 'PGRST202' ? 'Falta aplicar la migración de analítica comercial de WhatsApp.' : rpcError.message);
            setData(EMPTY);
        } else setData((result as Analytics) ?? EMPTY);
        setLoading(false);
    }, [from, to]);

    useEffect(() => { void load(); }, [load]);

    const maxProduct = Math.max(0, ...data.topProducts.map((row) => row.requests));
    const maxModel = Math.max(0, ...data.topModels.map((row) => row.requests));
    const linePoints = useMemo(() => {
        if (data.daily.length < 2) return '';
        const max = Math.max(1, ...data.daily.map((row) => row.requests));
        return data.daily.map((row, index) => `${(index / (data.daily.length - 1)) * 100},${48 - (row.requests / max) * 42}`).join(' ');
    }, [data.daily]);

    const exportCsv = () => {
        const rows = [['Producto', 'SKU', 'Solicitudes', 'Unidades', 'Vendidas'], ...data.topProducts.map((row) => [row.name, row.sku ?? '', row.requests, row.units, row.sold])];
        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `analitica-whatsapp-${from}-${to}.csv`; anchor.click(); URL.revokeObjectURL(url);
    };

    return (
        <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
            <header className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-5 shadow-sm lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-fg"><BarChart3 size={22} /></span><div><p className="text-2xs font-bold uppercase tracking-[.16em] text-primary">Inteligencia comercial</p><h1 className="text-xl font-bold tracking-tight text-fg">Analítica de solicitudes por WhatsApp</h1><p className="text-xs text-fg-muted">Demanda, modelos, clientes, cotizaciones y conversión en un solo lugar.</p></div></div>
                <div className="flex flex-wrap items-end gap-2">
                    <label className="text-2xs font-semibold uppercase text-fg-muted">Desde<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className={cn(input.base, 'mt-1 h-9 w-36 text-xs')} /></label>
                    <label className="text-2xs font-semibold uppercase text-fg-muted">Hasta<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} className={cn(input.base, 'mt-1 h-9 w-36 text-xs')} /></label>
                    <button type="button" onClick={() => load()} disabled={loading} className={cn(button.base, button.variant.secondary, button.size.sm)}><RefreshCw size={15} className={cn(loading && 'animate-spin')} />Actualizar</button>
                    <button type="button" onClick={exportCsv} disabled={!data.topProducts.length} className={cn(button.base, button.variant.primary, button.size.sm)}><Download size={15} />CSV</button>
                </div>
            </header>

            {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">{error}</div>}

            <section aria-label="Indicadores principales" className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
                {[
                    { label: 'Solicitudes', value: data.kpis.requests, icon: MessageCircle }, { label: 'Clientes', value: data.kpis.customers, icon: Users },
                    { label: 'Identificadas', value: data.kpis.identified, icon: PackageSearch }, { label: 'Cotizadas', value: data.kpis.quoted, icon: CalendarDays },
                    { label: 'Vendidas', value: data.kpis.sold, icon: ShoppingCart }, { label: 'Conversión', value: `${data.kpis.conversionRate}%`, icon: TrendingUp },
                    { label: 'Valor vendido', value: money(data.kpis.revenue), icon: BarChart3 },
                ].map((item) => { const Icon = item.icon; return <article key={item.label} className="rounded-xl border border-subtle bg-surface p-3 shadow-sm"><div className="flex items-center justify-between"><p className="text-2xs font-bold uppercase tracking-wide text-fg-muted">{item.label}</p><Icon size={15} className="text-primary" /></div><p className="mt-2 truncate text-xl font-bold tabular-nums text-fg">{loading ? '…' : item.value}</p></article>; })}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
                <article className="rounded-2xl border border-subtle bg-surface p-4 shadow-sm"><div className="mb-4"><h2 className="font-bold text-fg">Solicitudes en el tiempo</h2><p className="text-xs text-fg-muted">Tendencia diaria del periodo seleccionado</p></div><div className="h-52 rounded-xl border border-subtle bg-surface-2 p-3">{linePoints ? <svg viewBox="0 0 100 52" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Gráfico de solicitudes diarias"><line x1="0" y1="48" x2="100" y2="48" stroke="currentColor" className="text-border" strokeWidth=".4" /><polyline points={linePoints} fill="none" stroke="currentColor" className="text-primary" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /><polyline points={`0,48 ${linePoints} 100,48`} fill="currentColor" className="text-primary opacity-10" /></svg> : <div className="flex h-full items-center justify-center text-sm text-fg-muted">Aún no hay suficientes días con solicitudes.</div>}</div></article>
                <article className="rounded-2xl border border-subtle bg-surface p-4 shadow-sm"><h2 className="font-bold text-fg">Embudo comercial</h2><p className="mb-4 text-xs text-fg-muted">De consulta a venta</p><div className="space-y-3">{data.funnel.map((row, index) => { const base = data.funnel[0]?.value || 1; return <div key={row.stage}><div className="mb-1 flex justify-between text-xs"><span className="font-medium text-fg">{row.stage}</span><span className="tabular-nums text-fg-muted">{row.value} · {Math.round(row.value / base * 100)}%</span></div><MiniBar value={row.value} max={base} tone={index === data.funnel.length - 1 ? 'bg-success' : 'bg-primary'} /></div>; })}</div></article>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
                <article className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm"><div className="border-b border-subtle p-4"><h2 className="font-bold text-fg">Repuestos más solicitados</h2><p className="text-xs text-fg-muted">Demanda real capturada desde catálogo y proformas</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2 text-left text-2xs uppercase text-fg-muted"><tr><th className="px-4 py-2">Repuesto</th><th className="px-3 py-2 text-right">Solicitudes</th><th className="px-3 py-2 text-right">Vendidas</th></tr></thead><tbody className="divide-y divide-subtle">{data.topProducts.map((row) => <tr key={`${row.product_id}-${row.name}`} className="hover:bg-surface-hover"><td className="px-4 py-3"><p className="max-w-md truncate font-medium text-fg">{row.name}</p><p className="text-2xs text-fg-muted">{row.sku || 'Sin SKU'}</p><MiniBar value={row.requests} max={maxProduct} /></td><td className="px-3 py-3 text-right font-bold tabular-nums text-fg">{row.requests}</td><td className="px-3 py-3 text-right tabular-nums text-success">{row.sold}</td></tr>)}</tbody></table></div></article>
                <article className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm"><div className="border-b border-subtle p-4"><h2 className="font-bold text-fg">Motos y modelos más consultados</h2><p className="text-xs text-fg-muted">Información estructurada por la IA o el vendedor</p></div><div className="divide-y divide-subtle">{data.topModels.map((row) => <div key={`${row.make}-${row.model}-${row.year}`} className="px-4 py-3"><div className="mb-1 flex justify-between gap-3"><span className="truncate font-medium text-fg">{row.make} · {row.model}{row.year ? ` · ${row.year}` : ''}</span><span className="font-bold tabular-nums text-fg">{row.requests}</span></div><MiniBar value={row.requests} max={maxModel} tone="bg-warning" /></div>)}</div></article>
            </section>

            <article className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm"><div className="border-b border-subtle p-4"><h2 className="font-bold text-fg">Clientes con mayor actividad</h2><p className="text-xs text-fg-muted">Consultas, compras y valor convertido</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-2 text-left text-2xs uppercase text-fg-muted"><tr><th className="px-4 py-2">Cliente</th><th className="px-4 py-2 text-right">Solicitudes</th><th className="px-4 py-2 text-right">Compras</th><th className="px-4 py-2 text-right">Valor</th></tr></thead><tbody className="divide-y divide-subtle">{data.topCustomers.map((row) => <tr key={row.phone || row.name} className="hover:bg-surface-hover"><td className="px-4 py-3"><p className="font-medium text-fg">{row.name}</p><p className="text-2xs text-fg-muted">{row.phone || 'Sin teléfono'}</p></td><td className="px-4 py-3 text-right tabular-nums">{row.requests}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-success">{row.purchases}</td><td className="px-4 py-3 text-right font-bold tabular-nums">{money(Number(row.value))}</td></tr>)}</tbody></table></div></article>

            <p className="text-right text-2xs text-fg-subtle">{data.generatedAt ? `Actualizado ${new Date(data.generatedAt).toLocaleString('es-EC')}` : 'Sin datos generados'}</p>
        </div>
    );
};

export default WhatsAppAnalytics;
