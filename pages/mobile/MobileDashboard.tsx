import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Boxes, CheckCircle2, ClipboardList, FileText, MessageCircle,
  PackageSearch, Printer, RefreshCw, ScanLine, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import { getPrintQueue, getQueueTotalLabels } from '../../utils/mobilePrintQueue';
import { getPrintHistory } from '../../utils/mobilePrintHistory';
import { useProformaStore } from '../../store/useProformaStore';
import { cn } from '../../components/ui/styles';
import { setPreferredViewMode } from '../../utils/deviceDetection';

type Counters = { unread: number; demands: number; orders: number };

const MobileDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, session } = useAuth();
  const name = String(userProfile?.nickname || userProfile?.full_name || session?.user?.email?.split('@')[0] || '')
    .trim().split(' ')[0];
  const proformaCount = useProformaStore((state) => state.items.length);
  const [queueLabels, setQueueLabels] = useState(0);
  const [lastPrinted, setLastPrinted] = useState<string | null>(null);
  const [counters, setCounters] = useState<Counters>({ unread: 0, demands: 0, orders: 0 });
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [queue, unread, demands, orders] = await Promise.all([
      getPrintQueue(),
      supabase.from('agent_conversations').select('id', { count: 'exact', head: true }).gt('unread_count', 0),
      supabase.from('product_demands').select('id', { count: 'exact', head: true }).in('status', ['pending_stock', 'stock_available']),
      supabase.from('orders').select('id', { count: 'exact', head: true }).not('status', 'in', '(Borrador,Entregado,Cancelado,Reembolsado)'),
    ]);
    setQueueLabels(getQueueTotalLabels(queue));
    setLastPrinted(getPrintHistory()[0]?.sku ?? null);
    setCounters({
      unread: unread.error ? 0 : unread.count ?? 0,
      demands: demands.error ? 0 : demands.count ?? 0,
      orders: orders.error ? 0 : orders.count ?? 0,
    });
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onQueue = () => void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('print-queue-changed', onQueue);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('print-queue-changed', onQueue);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const totalPending = counters.unread + counters.demands + counters.orders + queueLabels;
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), []);

  const Metric = ({ label, value, icon: Icon, tone, onClick }: { label: string; value: number; icon: React.ComponentType<{ size?: number; className?: string }>; tone: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="min-h-[92px] touch-manipulation rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 text-left transition-colors active:bg-white/[0.08]">
      <div className="flex items-start justify-between gap-2"><span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tone)}><Icon size={17} /></span><ArrowRight size={15} className="mt-1 text-slate-600" /></div>
      <p className="mt-2 text-2xl font-black tabular-nums text-white">{loading ? '–' : value}</p>
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
    </button>
  );

  return (
    <div className="min-h-full px-4 pb-mobile-page pt-5">
      <section className="relative overflow-hidden rounded-[28px] border border-blue-400/15 bg-gradient-to-br from-blue-600/25 via-[#101d35] to-[#0b1426] p-5 shadow-2xl shadow-black/20">
        <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold capitalize text-blue-300">{dateLabel}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{name ? `Hola, ${name}` : 'Hola'}</h2>
          <p className="mt-1 max-w-[28ch] text-sm leading-5 text-slate-400">
            {totalPending > 0 ? `Hay ${totalPending} tareas que requieren atención.` : 'Todo está al día. Puedes comenzar una nueva operación.'}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={() => navigate('/mobile/whatsapp')} className="flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-bold text-white shadow-lg shadow-blue-950/40 active:bg-blue-600"><MessageCircle size={18} /> Atender clientes</button>
            <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Actualizar indicadores" className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 disabled:opacity-50"><RefreshCw size={18} className={cn(loading && 'animate-spin')} /></button>
          </div>
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-300">Operación en vivo</p><h2 className="text-base font-bold text-white">Pendientes</h2></div>{updatedAt && <span className="text-[10px] text-slate-600">{updatedAt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</span>}</div>
      <section className="mt-3 grid grid-cols-2 gap-3">
        <Metric label="Chats sin leer" value={counters.unread} icon={MessageCircle} tone="bg-emerald-500/15 text-emerald-300" onClick={() => navigate('/mobile/whatsapp')} />
        <Metric label="Etiquetas en cola" value={queueLabels} icon={Printer} tone="bg-amber-500/15 text-amber-300" onClick={() => navigate('/mobile/labels')} />
        <Metric label="Demandas de stock" value={counters.demands} icon={PackageSearch} tone="bg-cyan-500/15 text-cyan-300" onClick={() => navigate('/mobile/inventory')} />
        <Metric label="Órdenes activas" value={counters.orders} icon={ClipboardList} tone="bg-violet-500/15 text-violet-300" onClick={() => { setPreferredViewMode('desktop'); navigate('/orders'); }} />
      </section>

      <div className="mt-6"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-300">Accesos rápidos</p><h2 className="text-base font-bold text-white">Herramientas</h2></div>
      <section className="mt-3 space-y-2">
        {[
          { label: 'Escanear inventario', detail: 'Consultar y ajustar stock', to: '/mobile/inventory', icon: ScanLine, tone: 'bg-cyan-500/15 text-cyan-300' },
          { label: 'Buscar en catálogo', detail: 'Precios, fotos y disponibilidad', to: '/mobile/catalog', icon: Boxes, tone: 'bg-blue-500/15 text-blue-300' },
          { label: 'Imprimir etiquetas', detail: queueLabels ? `${queueLabels} pendientes${lastPrinted ? ` · último ${lastPrinted}` : ''}` : 'Cola vacía, lista para trabajar', to: '/mobile/labels', icon: Printer, tone: 'bg-amber-500/15 text-amber-300' },
          { label: 'Continuar proforma', detail: proformaCount ? `${proformaCount} productos en preparación` : 'Crear una nueva cotización', to: '/mobile/proforma', icon: FileText, tone: 'bg-violet-500/15 text-violet-300' },
        ].map((action) => {
          const Icon = action.icon;
          return <button key={action.to + action.label} type="button" onClick={() => navigate(action.to)} className="flex min-h-[68px] w-full touch-manipulation items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 text-left transition-colors active:bg-white/[0.08]"><span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', action.tone)}><Icon size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{action.label}</span><span className="block truncate text-xs text-slate-500">{action.detail}</span></span><ArrowRight size={18} className="text-slate-600" /></button>;
        })}
      </section>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-400/10 bg-emerald-500/[0.06] p-3">
        <CheckCircle2 size={19} className="shrink-0 text-emerald-400" />
        <div className="min-w-0"><p className="text-xs font-bold text-emerald-200">Sistema móvil operativo</p><p className="text-[11px] text-slate-500">WhatsApp, catálogo, impresión e inventario conectados.</p></div>
        <TrendingUp size={17} className="ml-auto text-slate-600" />
      </div>
    </div>
  );
};

export default MobileDashboard;
