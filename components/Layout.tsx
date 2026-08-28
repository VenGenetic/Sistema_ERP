import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Command,
  FileText,
  Home,
  Menu,
  MessageCircle,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShoppingCart,
  Star,
  Tags,
  Truck,
  UserRoundCog,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import HeaderAccount from './HeaderAccount';
import ThemeToggle from './ui/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

type BadgeKey = 'whatsapp' | 'demands' | 'orders' | 'shipments';
type PermissionKey = 'customers' | 'products' | 'inventory' | 'orders' | 'commissions' | 'finance' | 'team';

type NavigationItem = {
  id: string;
  label: string;
  title: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionKey;
  badge?: BadgeKey;
  aliases?: string[];
  adminOnly?: boolean;
};

type NavigationGroup = {
  id: string;
  label: string;
  items: NavigationItem[];
};

const STORAGE_GROUPS = 'erp_sidebar_groups';
const STORAGE_COLLAPSED = 'erp_sidebar_collapsed';
const STORAGE_FAVORITES = 'erp_sidebar_favorites';

const DASHBOARD: NavigationItem = {
  id: 'dashboard', label: 'Inicio', title: 'Panel principal', to: '/', icon: Home, aliases: ['dashboard', 'panel'],
};

const GROUPS: NavigationGroup[] = [
  {
    id: 'operations', label: 'Operaciones', items: [
      { id: 'customers', label: 'Clientes', title: 'Gestión de clientes', to: '/customers', icon: Users, permission: 'customers', aliases: ['buscar cliente', 'nuevo cliente'] },
      { id: 'whatsapp', label: 'WhatsApp', title: 'Bandeja de WhatsApp', to: '/whatsapp-inbox', icon: MessageCircle, badge: 'whatsapp', aliases: ['chat', 'mensajes', 'cliente'] },
      { id: 'products', label: 'Catálogo', title: 'Catálogo de productos', to: '/products', icon: Boxes, permission: 'products', aliases: ['producto', 'productos'] },
      { id: 'orders', label: 'Órdenes', title: 'Gestión de órdenes', to: '/orders', icon: ShoppingCart, permission: 'orders', badge: 'orders', aliases: ['pedido', 'pedidos'] },
      { id: 'shipments', label: 'Envíos', title: 'Órdenes y envíos', to: '/orders/envios', icon: Truck, permission: 'orders', badge: 'shipments', aliases: ['despacho', 'entrega'] },
    ],
  },
  {
    id: 'inventory', label: 'Inventario', items: [
      { id: 'warehouses', label: 'Almacenes', title: 'Almacenes e inventario', to: '/inventory', icon: Archive, permission: 'inventory', aliases: ['stock', 'bodega'] },
      { id: 'demands', label: 'Demanda de Stock', title: 'Demanda de Stock', to: '/product-demands', icon: BarChart3, permission: 'inventory', badge: 'demands', aliases: ['demanda', 'faltantes', 'stock'] },
      { id: 'sourcing', label: 'Sourcing', title: 'Investigación (Sourcing)', to: '/sourcing', icon: PackageSearch, permission: 'products', aliases: ['investigación', 'proveedor'] },
      { id: 'inventory-mode', label: 'Inventario', title: 'Modo Inventario', to: '/inventory-mode', icon: ClipboardCheck, permission: 'inventory', aliases: ['conteo', 'modo inventario'] },
      { id: 'replenishment', label: 'Abastecimiento', title: 'Abastecimiento de inventario', to: '/replenishment', icon: PackageSearch, permission: 'inventory', aliases: ['reposición', 'compras'] },
    ],
  },
  {
    id: 'finance', label: 'Finanzas', items: [
      { id: 'finance', label: 'Finanzas', title: 'Panel financiero', to: '/finance', icon: CircleDollarSign, permission: 'finance', aliases: ['contabilidad'] },
      { id: 'daily', label: 'Cierre Diario', title: 'Registro y cierre diario', to: '/daily-registry', icon: FileText, permission: 'finance', aliases: ['cierre', 'caja'] },
      { id: 'expenses', label: 'Gastos', title: 'Registro de Gastos', to: '/expenses', icon: WalletCards, permission: 'finance', aliases: ['registrar gasto', 'registro de gastos'] },
      { id: 'commissions', label: 'Comisiones', title: 'Gestión de comisiones', to: '/commissions', icon: BarChart3, permission: 'commissions', aliases: ['comisión'] },
    ],
  },
  {
    id: 'settings', label: 'Configuración', items: [
      { id: 'team', label: 'Equipo', title: 'Gestión del equipo', to: '/team', icon: UserRoundCog, permission: 'team', aliases: ['usuarios', 'personal'] },
      { id: 'invoice-labels', label: 'Etiquetas', title: 'Etiquetas de facturación', to: '/invoice-labels', icon: Tags, permission: 'products', aliases: ['factura'] },
      { id: 'product-tags', label: 'Etiquetas de productos', title: 'Etiquetas de productos', to: '/tags', icon: Tags, permission: 'products' },
      { id: 'poe', label: 'Estándares (SOPs)', title: 'Estándares y procedimientos', to: '/poe', icon: FileText, aliases: ['poe', 'procedimientos'] },
      { id: 'settings-page', label: 'Ajustes', title: 'Configuración del sistema', to: '/settings', icon: Settings, adminOnly: true },
    ],
  },
];

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
};

const storeJson = (key: string, value: unknown) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be disabled */ }
};

const routeMatches = (pathname: string, to: string) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);

const Badge = ({ value, compact = false }: { value?: number; compact?: boolean }) => {
  if (!value) return null;
  if (compact) return <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950" />;
  return <span className="ml-auto min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">{value > 99 ? '99+' : value}</span>;
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, session, permissions, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readJson(STORAGE_COLLAPSED, false));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => readJson(STORAGE_GROUPS, {
    operations: true, inventory: true, finance: false, settings: false,
  }));
  const [favorites, setFavorites] = useState<string[]>(() => readJson(STORAGE_FAVORITES, ['whatsapp', 'orders', 'products']));
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({ whatsapp: 0, demands: 0, orders: 0, shipments: 0 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedCommand, setSelectedCommand] = useState(0);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const canRead = (key?: PermissionKey) => !key || isAdmin || Boolean((permissions as any)?.[key]?.read);
  const visibleGroups = useMemo(() => GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => (!item.adminOnly || isAdmin) && canRead(item.permission)),
  })).filter(group => group.items.length), [isAdmin, permissions]);
  const allItems = useMemo(() => [DASHBOARD, ...visibleGroups.flatMap(group => group.items)], [visibleGroups]);
  const activeItem = useMemo(() => [...allItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find(item => routeMatches(location.pathname, item.to)), [allItems, location.pathname]);
  const favoriteItems = favorites.map(id => allItems.find(item => item.id === id)).filter(Boolean) as NavigationItem[];

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLocaleLowerCase('es');
    if (!query) return allItems;
    return allItems.filter(item => [item.label, item.title, ...(item.aliases || [])]
      .join(' ').toLocaleLowerCase('es').includes(query));
  }, [allItems, commandQuery]);

  useEffect(() => storeJson(STORAGE_GROUPS, openGroups), [openGroups]);
  useEffect(() => storeJson(STORAGE_COLLAPSED, collapsed), [collapsed]);
  useEffect(() => storeJson(STORAGE_FAVORITES, favorites), [favorites]);
  useEffect(() => { setMobileOpen(false); setPaletteOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!paletteOpen) return;
    setCommandQuery('');
    setSelectedCommand(0);
    requestAnimationFrame(() => commandInputRef.current?.focus());
  }, [paletteOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(open => !open);
      }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let mounted = true;
    const refreshBadges = async () => {
      const [whatsapp, demands, orders, shipments] = await Promise.all([
        supabase.from('agent_conversations').select('*', { count: 'exact', head: true }).gt('unread_count', 0),
        supabase.from('product_demands').select('*', { count: 'exact', head: true }).in('status', ['pending_stock', 'stock_available']),
        supabase.from('orders').select('*', { count: 'exact', head: true }).not('status', 'in', '(Borrador,Entregado,Cancelado,Reembolsado)'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['Listo_Cumplimiento', 'En_Transito']),
      ]);
      if (mounted) setBadges({
        whatsapp: whatsapp.error ? 0 : whatsapp.count || 0,
        demands: demands.error ? 0 : demands.count || 0,
        orders: orders.error ? 0 : orders.count || 0,
        shipments: shipments.error ? 0 : shipments.count || 0,
      });
    };
    void refreshBadges();
    const interval = window.setInterval(refreshBadges, 60_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void refreshBadges(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { mounted = false; window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  const toggleFavorite = (id: string) => setFavorites(current => current.includes(id)
    ? current.filter(item => item !== id)
    : current.length < 5 ? [...current, id] : [...current.slice(1), id]);

  const runCommand = (item: NavigationItem) => {
    navigate(item.to);
    setPaletteOpen(false);
  };

  const NavigationLink = ({ item, compact = false, favoriteControl = true }: { item: NavigationItem; compact?: boolean; favoriteControl?: boolean }) => {
    const Icon = item.icon;
    const active = activeItem?.id === item.id;
    const isFavorite = favorites.includes(item.id);
    return (
      <div className="group relative">
        <Link
          to={item.to}
          title={compact ? item.title : undefined}
          aria-current={active ? 'page' : undefined}
          className={`relative flex min-h-10 items-center rounded-xl text-sm font-medium transition-colors ${compact ? 'mx-2 justify-center px-2' : 'mx-2 gap-3 px-3 pr-9'} ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          {!compact && <span className="truncate">{item.label}</span>}
          <Badge value={item.badge ? badges[item.badge] : 0} compact={compact} />
        </Link>
        {!compact && favoriteControl && item.id !== 'dashboard' && (
          <button
            type="button"
            onClick={() => toggleFavorite(item.id)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity hover:bg-black/10 ${isFavorite ? 'text-amber-400 opacity-100' : 'text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
            title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            aria-label={isFavorite ? `Quitar ${item.label} de favoritos` : `Añadir ${item.label} a favoritos`}
          >
            <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>
    );
  };

  const SidebarContent = ({ compact = false }: { compact?: boolean }) => (
    <>
      <div className={`flex h-16 items-center border-b border-slate-200 dark:border-slate-800 ${compact ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!compact && <div><div className="font-bold tracking-tight text-slate-950 dark:text-white">ERP</div><div className="text-[10px] uppercase tracking-widest text-slate-400">Operaciones</div></div>}
        <button type="button" onClick={() => setCollapsed(value => !value)} className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:block" title={compact ? 'Expandir menú' : 'Contraer menú'}>
          {compact ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
        {!compact && <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"><X className="h-5 w-5" /></button>}
      </div>
      <nav className="flex-1 space-y-2 overflow-y-auto py-3">
        <NavigationLink item={DASHBOARD} compact={compact} favoriteControl={false} />
        {favoriteItems.length > 0 && (
          <section className="border-y border-slate-100 py-2 dark:border-slate-800/70">
            {!compact && <div className="px-5 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">★ Favoritos</div>}
            <div className="space-y-1">{favoriteItems.map(item => <NavigationLink key={`favorite-${item.id}`} item={item} compact={compact} favoriteControl={false} />)}</div>
          </section>
        )}
        {visibleGroups.map(group => {
          const opened = compact || openGroups[group.id];
          return (
            <section key={group.id}>
              <button
                type="button"
                onClick={() => !compact && setOpenGroups(current => ({ ...current, [group.id]: !current[group.id] }))}
                className={`flex w-full items-center py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ${compact ? 'justify-center px-2' : 'justify-between px-5'}`}
                title={compact ? group.label : undefined}
                aria-expanded={opened}
              >
                {compact ? <span className="h-px w-5 bg-slate-300 dark:bg-slate-700" /> : <><span>{group.label}</span>{opened ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</>}
              </button>
              {opened && <div className="space-y-1">{group.items.map(item => <NavigationLink key={item.id} item={item} compact={compact} />)}</div>}
            </section>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <a href="#/pos" target="_blank" rel="noreferrer" title={compact ? 'Abrir POS' : undefined} className={`flex items-center rounded-xl py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${compact ? 'justify-center px-2' : 'gap-3 px-3'}`}>
          <ShoppingCart className="h-[18px] w-[18px]" />{!compact && <span>Abrir POS</span>}
        </a>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-950 lg:flex ${collapsed ? 'w-16' : 'w-64'}`}>
        <SidebarContent compact={collapsed} />
      </aside>

      {mobileOpen && <button type="button" aria-label="Cerrar menú" className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl transition-transform dark:bg-slate-950 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" aria-label="Abrir menú"><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{activeItem?.title || 'Sistema ERP'}</div>
            <div className="hidden truncate text-xs text-slate-400 sm:block">{userProfile?.full_name || session?.user?.email || 'Panel de trabajo'}</div>
          </div>
          <button type="button" onClick={() => setPaletteOpen(true)} className="hidden min-w-52 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 sm:flex">
            <Search className="h-4 w-4" /><span className="flex-1 text-left">Buscar módulo o acción</span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-950">Ctrl K</kbd>
          </button>
          <button type="button" onClick={() => setPaletteOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 sm:hidden" aria-label="Buscar módulos"><Search className="h-5 w-5" /></button>
          <ThemeToggle />
          <HeaderAccount />
        </header>
        <main className="min-w-0"><Outlet /></main>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/55 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Buscar módulos y comandos" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
              <Command className="h-5 w-5 text-blue-500" />
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={event => { setCommandQuery(event.target.value); setSelectedCommand(0); }}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedCommand(value => Math.min(value + 1, commandResults.length - 1)); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedCommand(value => Math.max(value - 1, 0)); }
                  if (event.key === 'Enter' && commandResults[selectedCommand]) runCommand(commandResults[selectedCommand]);
                }}
                placeholder="Escribe: gasto, cliente, WhatsApp…"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
              />
              <kbd className="rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-400 dark:border-slate-700">ESC</kbd>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {commandResults.length ? commandResults.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" onMouseEnter={() => setSelectedCommand(index)} onClick={() => runCommand(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${selectedCommand === index ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <Icon className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.label}</span><span className={`block truncate text-xs ${selectedCommand === index ? 'text-blue-100' : 'text-slate-400'}`}>{item.title}</span></span><ChevronRight className="h-4 w-4 opacity-60" />
                  </button>
                );
              }) : <div className="px-4 py-10 text-center text-sm text-slate-400">No se encontraron módulos o acciones.</div>}
            </div>
            <div className="flex gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800"><span>↑↓ navegar</span><span>↵ abrir</span><span>Esc cerrar</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
