import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Boxes, ChevronRight, Download, FileText, Grid3X3, House, MessageCircle,
  Monitor, Printer, ScanLine, Search, Smartphone, WifiOff, X,
} from 'lucide-react';
import { setPreferredViewMode } from '../../utils/deviceDetection';
import { getPrintQueue } from '../../utils/mobilePrintQueue';
import { supabase } from '../../supabaseClient';
import { useProformaStore } from '../../store/useProformaStore';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../ui/styles';

type ModuleItem = {
  label: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  accent: string;
};

const MODULES: ModuleItem[] = [
  { label: 'WhatsApp', description: 'Clientes y conversaciones', to: '/mobile/whatsapp', icon: MessageCircle, accent: 'bg-emerald-500/15 text-emerald-300' },
  { label: 'Catálogo', description: 'Productos, precios y stock', to: '/mobile/catalog', icon: Boxes, accent: 'bg-blue-500/15 text-blue-300' },
  { label: 'Etiquetas', description: 'Cola e impresión móvil', to: '/mobile/labels', icon: Printer, accent: 'bg-amber-500/15 text-amber-300' },
  { label: 'Inventario', description: 'Escanear y ajustar existencias', to: '/mobile/inventory', icon: ScanLine, accent: 'bg-cyan-500/15 text-cyan-300' },
  { label: 'Proforma', description: 'Cotización en preparación', to: '/mobile/proforma', icon: FileText, accent: 'bg-violet-500/15 text-violet-300' },
];

const PAGE_META: Record<string, { title: string; eyebrow: string }> = {
  '/mobile': { title: 'Centro de operaciones', eyebrow: 'Inicio' },
  '/mobile/whatsapp': { title: 'WhatsApp', eyebrow: 'Atención al cliente' },
  '/mobile/catalog': { title: 'Catálogo', eyebrow: 'Productos y stock' },
  '/mobile/labels': { title: 'Etiquetas', eyebrow: 'Impresión móvil' },
  '/mobile/inventory': { title: 'Inventario', eyebrow: 'Control de almacén' },
  '/mobile/proforma': { title: 'Proforma', eyebrow: 'Cotización' },
};

const MobileLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, session } = useAuth();
  const [queueCount, setQueueCount] = useState(0);
  const [sinLeer, setSinLeer] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [moduleCenter, setModuleCenter] = useState(false);
  const [query, setQuery] = useState('');
  const proformaCount = useProformaStore((state) => state.items.length);
  const { canInstall, promptInstall } = useInstallPrompt();
  const [installSnoozed, setInstallSnoozed] = useState(() => {
    try { return Date.now() < Number(localStorage.getItem('install_prompt_snoozed_until') || 0); }
    catch { return false; }
  });

  const meta = PAGE_META[location.pathname] ?? { title: 'Xsistem ERP', eyebrow: 'Modo móvil' };
  const initials = String(userProfile?.full_name || userProfile?.nickname || session?.user?.email || 'ERP')
    .split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const visibleModules = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    return normalized ? MODULES.filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase('es').includes(normalized)) : MODULES;
  }, [query]);

  const refreshQueue = useCallback(async () => {
    const queue = await getPrintQueue();
    setQueueCount(queue.reduce((total, item) => total + item.quantity, 0));
  }, []);
  const refreshUnread = useCallback(async () => {
    const { count, error } = await supabase.from('agent_conversations').select('id', { count: 'exact', head: true }).gt('unread_count', 0);
    if (!error) setSinLeer(count ?? 0);
  }, []);

  useEffect(() => {
    refreshQueue();
    refreshUnread();
  }, [location.pathname, refreshQueue, refreshUnread]);
  useEffect(() => {
    const interval = window.setInterval(refreshUnread, 120_000);
    const onQueue = () => refreshQueue();
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('print-queue-changed', onQueue);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('print-queue-changed', onQueue);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshQueue, refreshUnread]);
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.add('dark');
    return () => { if (!wasDark) root.classList.remove('dark'); };
  }, []);
  useEffect(() => { setModuleCenter(false); setQuery(''); }, [location.pathname]);

  const switchDesktop = () => {
    setPreferredViewMode('desktop');
    navigate('/', { replace: true });
  };
  const snoozeInstall = () => {
    setInstallSnoozed(true);
    try { localStorage.setItem('install_prompt_snoozed_until', String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch { /* private mode */ }
  };

  const navClass = ({ isActive }: { isActive: boolean }) => cn(
    'relative flex min-h-[58px] min-w-[58px] touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[10px] font-semibold transition-colors active:bg-white/10',
    isActive ? 'text-blue-300' : 'text-slate-500',
  );

  return (
    <div className="flex h-dvh-screen w-full flex-col overflow-hidden bg-[#070d1a] font-sans text-white">
      <a href="#mobile-main" className="fixed left-3 top-3 z-[200] -translate-y-20 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold transition-transform focus:translate-y-0">Saltar al contenido</a>

      <header className="relative z-40 shrink-0 border-b border-white/[0.07] bg-[#0b1426]/95 px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/50">
            <Smartphone size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-blue-300">
              <span>{meta.eyebrow}</span><span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-400' : 'bg-rose-400')} />
              <span className="text-slate-500">{online ? 'En línea' : 'Sin conexión'}</span>
            </div>
            <h1 className="truncate text-base font-bold tracking-tight text-white">{meta.title}</h1>
          </div>
          <NavLink to="/mobile/proforma" aria-label={`Proforma${proformaCount ? `, ${proformaCount} ítems` : ''}`} className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 active:bg-white/10">
            <FileText size={19} />
            {proformaCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0b1426] bg-violet-500 px-1 text-[10px] font-black text-white">{proformaCount}</span>}
          </NavLink>
          <button type="button" onClick={() => setModuleCenter(true)} aria-label="Abrir todos los módulos" className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 active:bg-white/10"><Grid3X3 size={19} /></button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-xs font-black text-slate-950" title={userProfile?.full_name || session?.user?.email}>{initials || 'ER'}</div>
        </div>
      </header>

      {!online && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-200"><WifiOff size={14} /> Sin conexión. Algunas consultas esperarán a recuperar internet.</div>
      )}
      {canInstall && !installSnoozed && location.pathname === '/mobile' && (
        <div className="mx-3 mt-2 flex shrink-0 items-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-3 py-2">
          <Download size={17} className="text-blue-300" />
          <p className="min-w-0 flex-1 text-xs font-medium text-slate-200">Instala Xsistem como aplicación</p>
          <button type="button" onClick={() => promptInstall()} className="min-h-9 rounded-xl bg-blue-500 px-3 text-xs font-bold text-white">Instalar</button>
          <button type="button" onClick={snoozeInstall} aria-label="Ahora no" className="flex h-10 w-10 items-center justify-center text-slate-500"><X size={16} /></button>
        </div>
      )}

      <main id="mobile-main" data-mobile-scroll tabIndex={-1} className="hide-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-nav-safe">
        <div className="relative mx-auto h-full w-full max-w-md"><Outlet /></div>
      </main>

      <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-[45] px-2 pb-safe pt-2">
        <div className="mx-auto max-w-md rounded-[24px] border border-white/10 bg-[#0d1729]/95 p-1.5 shadow-[0_-12px_40px_rgba(0,0,0,.35)] backdrop-blur-xl">
          <ul className="grid grid-cols-5 items-end">
            <li><NavLink to="/mobile" end className={navClass}><House size={21} /><span>Inicio</span></NavLink></li>
            <li><NavLink to="/mobile/whatsapp" className={navClass}><span className="relative"><MessageCircle size={21} />{sinLeer > 0 && <span className="absolute -right-2 -top-2 h-2.5 w-2.5 rounded-full border-2 border-[#0d1729] bg-emerald-400" />}</span><span>WhatsApp</span></NavLink></li>
            <li className="relative -top-3"><NavLink to="/mobile/labels" aria-label="Imprimir etiquetas" className="relative mx-auto flex h-14 w-14 touch-manipulation items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-950/50 active:bg-blue-700"><Printer size={24} />{queueCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0d1729] bg-amber-400 px-1 text-[10px] font-black text-slate-950">{queueCount > 99 ? '99+' : queueCount}</span>}</NavLink></li>
            <li><NavLink to="/mobile/catalog" className={navClass}><Boxes size={21} /><span>Catálogo</span></NavLink></li>
            <li><NavLink to="/mobile/inventory" className={navClass}><ScanLine size={21} /><span>Inventario</span></NavLink></li>
          </ul>
        </div>
      </nav>

      {moduleCenter && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/60" onPointerDown={(event) => event.target === event.currentTarget && setModuleCenter(false)}>
          <section role="dialog" aria-modal="true" aria-label="Todos los módulos" className="flex max-h-[88dvh] w-full flex-col rounded-t-[28px] border-t border-white/10 bg-[#0d1729] pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-600" />
            <div className="flex items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[.15em] text-blue-300">Xsistem ERP</p><h2 className="text-xl font-bold">Centro de módulos</h2></div><button type="button" onClick={() => setModuleCenter(false)} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-slate-400"><X size={20} /></button></div>
            <div className="relative mx-4 mb-3"><Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Buscar módulo o función" aria-label="Buscar módulo" className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-400" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {visibleModules.map((item) => { const Icon = item.icon; return <button key={item.to} type="button" onClick={() => navigate(item.to)} className="flex min-h-[66px] w-full touch-manipulation items-center gap-3 rounded-2xl px-3 text-left active:bg-white/5"><span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', item.accent)}><Icon size={20} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{item.label}</span><span className="block truncate text-xs text-slate-500">{item.description}</span></span><ChevronRight size={18} className="text-slate-600" /></button>; })}
              <div className="my-2 border-t border-white/10" />
              <button type="button" onClick={switchDesktop} className="flex min-h-[58px] w-full items-center gap-3 rounded-2xl px-3 text-left active:bg-white/5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-700/30 text-slate-300"><Monitor size={20} /></span><span className="flex-1 text-sm font-bold">Abrir versión de escritorio</span><ChevronRight size={18} className="text-slate-600" /></button>
            </div>
          </section>
        </div>
      )}
      <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </div>
  );
};

export default MobileLayout;
