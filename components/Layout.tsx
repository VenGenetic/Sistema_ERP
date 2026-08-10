import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import HeaderAccount from './HeaderAccount';
import { useAuth } from '../contexts/AuthContext';
import { setPreferredViewMode } from '../utils/deviceDetection';
import { ThemeToggle } from './ui/ThemeToggle';
import { cn, kbd, nav } from './ui/styles';
import {
  BellRing,
  Calculator,
  ChevronRight,
  Contact,
  HandCoins,
  LayoutDashboard,
  Menu,
  Package,
  PackageCheck,
  Receipt,
  ReceiptText,
  ScanBarcode,
  Search,
  ShoppingCart,
  Smartphone,
  Store,
  Tag,
  Telescope,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Workflow,
  X,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  NavItem                                                                    */
/* -------------------------------------------------------------------------- */

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  /** Sub-ruta: se indenta y cuelga de una guía vertical. */
  nested?: boolean;
  /** Acento de color para acciones que salen del flujo normal (POS, móvil). */
  tone?: 'default' | 'accent';
  target?: string;
}

/**
 * Ítem de navegación.
 *
 * El estado activo se señala con tres pistas simultáneas —fondo tenue, color
 * de texto e icono, y una barra vertical a la izquierda— para que se lea de un
 * vistazo y no dependa solo del color.
 */
const NavItem: React.FC<NavItemProps> = ({
  to,
  icon: Icon,
  label,
  active,
  nested = false,
  tone = 'default',
  target,
}) => (
  <Link
    to={to}
    target={target}
    aria-current={active ? 'page' : undefined}
    className={cn(
      nav.item,
      nested && nav.itemNested,
      active
        ? nav.itemActive
        : tone === 'accent'
          ? 'text-primary hover:bg-primary-soft'
          : nav.itemIdle,
    )}
  >
    {active && <span className={nav.itemActiveBar} aria-hidden="true" />}
    <Icon size={17} className={nav.icon} aria-hidden="true" />
    <span className="truncate">{label}</span>
  </Link>
);

const NavSection: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className={nav.sectionLabel}>{children}</p>
);

/* -------------------------------------------------------------------------- */
/*  Layout                                                                     */
/* -------------------------------------------------------------------------- */

const Layout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAdmin, permissions } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState('');

  const handleSwitchToMobile = () => {
    setPreferredViewMode('mobile');
    navigate('/mobile', { replace: true });
  };

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Sync searchVal with URL search param if we are on /products
  useEffect(() => {
    if (location.pathname === '/products') {
      let searchStr = '';
      if (window.location.hash && window.location.hash.includes('?')) {
        searchStr = window.location.hash.split('?')[1];
      } else if (window.location.search) {
        searchStr = window.location.search;
      }
      const params = new URLSearchParams(searchStr);
      setSearchVal(params.get('search') || '');
    } else {
      setSearchVal('');
    }
  }, [location.pathname, location.search, location.hash]);

  // Handle Ctrl+K shortcut to focus search input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('header-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchVal(value);
    navigate(`/products?search=${encodeURIComponent(value)}`, { replace: true });
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.includes(path)) return true;
    return false;
  };

  const canProducts = isAdmin || permissions?.products?.read;
  const canInventory = isAdmin || permissions?.inventory?.read;

  const NavigationContent = () => (
    <>
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-subtle">
        <span className="font-semibold text-fg">Menú</span>
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Cerrar menú"
          className="rounded-md p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg transition-colors"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <NavSection>General</NavSection>
        <NavItem to="/" icon={LayoutDashboard} label="Centro de Comando" active={isActive('/')} />
        {(isAdmin || permissions?.team?.read) && (
          <NavItem to="/team" icon={Users} label="Equipo" active={isActive('team')} />
        )}

        <NavSection>Operaciones</NavSection>
        {(isAdmin || permissions?.customers?.read) && (
          <NavItem to="/customers" icon={Contact} label="Clientes" active={isActive('customers')} />
        )}
        {canProducts && (
          <>
            <NavItem to="/products" icon={Package} label="Catálogo" active={isActive('products')} />
            <NavItem
              to="/invoice-labels"
              icon={ReceiptText}
              label="Etiquetas de Factura"
              active={isActive('invoice-labels')}
              nested
            />
            <NavItem
              to="/product-demands"
              icon={BellRing}
              label="Demanda de Stock"
              active={isActive('product-demands')}
            />
            <NavItem
              to="/sourcing"
              icon={Telescope}
              label="Investigación (Sourcing)"
              active={isActive('sourcing')}
            />
            <NavItem to="/tags" icon={Tag} label="Etiquetas" active={isActive('tags')} />
          </>
        )}

        {canInventory && (
          <>
            <NavItem to="/inventory" icon={Warehouse} label="Almacenes" active={isActive('inventory')} />
            <NavItem
              to="/inventory-mode"
              icon={ScanBarcode}
              label="Modo Inventario"
              active={isActive('inventory-mode')}
              nested
            />
            <NavItem
              to="/replenishment"
              icon={ShoppingCart}
              label="Abastecimiento"
              active={isActive('replenishment')}
            />
          </>
        )}

        {(isAdmin || permissions?.orders?.read) && (
          <>
            <NavItem to="/orders" icon={Truck} label="Órdenes" active={isActive('orders')} />
            <NavItem
              to="/orders/envios"
              icon={PackageCheck}
              label="Envíos"
              active={isActive('orders/envios')}
              nested
            />
          </>
        )}

        {(isAdmin || permissions?.commissions?.read) && (
          <NavItem to="/commissions" icon={HandCoins} label="Comisiones" active={isActive('commissions')} />
        )}

        {(isAdmin || permissions?.finance?.read) && (
          <>
            <NavItem to="/finance" icon={Wallet} label="Finanzas" active={isActive('finance')} />
            <NavItem
              to="/daily-registry"
              icon={Calculator}
              label="Cierre Diario"
              active={isActive('daily-registry')}
              nested
            />
            <NavItem
              to="/expenses"
              icon={Receipt}
              label="Registro de Gastos"
              active={isActive('expenses')}
              nested
            />
          </>
        )}

        <NavSection>Estándares &amp; POE</NavSection>
        <NavItem to="/poe" icon={Workflow} label="Estándares (SOPs)" active={isActive('poe')} />

        <NavSection>Accesos</NavSection>
        <button
          onClick={handleSwitchToMobile}
          className={cn(nav.item, 'w-full text-left text-primary hover:bg-primary-soft')}
        >
          <Smartphone size={17} className={nav.icon} aria-hidden="true" />
          <span className="truncate">Modo Móvil (App)</span>
        </button>
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans bg-bg text-fg">
      {/* Barra superior */}
      <header className={nav.header}>
        <div className="flex items-center gap-3 md:gap-5 min-w-0">
          <button
            className="md:hidden rounded-md p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="size-7 rounded-lg bg-primary text-primary-fg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
              <Store size={16} aria-hidden="true" />
            </div>
            <span className="font-semibold tracking-tight hidden md:block text-fg">
              DropshipERP
            </span>
          </Link>

          {/* Migas de pan / contexto */}
          <div className="hidden lg:flex items-center gap-1.5 text-fg-subtle min-w-0">
            <ChevronRight size={14} aria-hidden="true" />
            <span className="text-2xs font-semibold uppercase tracking-wider truncate">
              {location.pathname === '/'
                ? 'Centro de comando'
                : location.pathname.includes('partners')
                  ? 'Socios'
                  : location.pathname.includes('finance')
                    ? 'Finanzas'
                    : location.pathname.includes('expenses')
                      ? 'Gastos'
                      : location.pathname.includes('poe')
                        ? 'Estándares POE'
                        : location.pathname.includes('settings')
                          ? 'Configuración'
                          : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-1 justify-end items-center gap-2 md:gap-3">
          {/* Buscador global */}
          <div className="relative hidden md:block w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="header-search-input"
              type="search"
              value={searchVal}
              onChange={handleSearchChange}
              aria-label="Buscar productos"
              className="w-full h-9 rounded-lg bg-surface-2 border border-transparent pl-9 pr-12 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:bg-surface-3 focus:bg-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              placeholder="Buscar productos…"
            />
            <span className={cn(kbd, 'absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex')}>
              ⌘K
            </span>
          </div>

          {isAdmin && (
            <a
              href={`${window.location.pathname}#/pos`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-success text-success-fg text-sm font-semibold shadow-sm transition-colors hover:brightness-110"
            >
              <Store size={16} aria-hidden="true" />
              Abrir Caja
            </a>
          )}

          <button
            onClick={handleSwitchToMobile}
            title="Ir a Modo Móvil"
            aria-label="Ir a Modo Móvil"
            className="md:hidden rounded-md p-1.5 text-primary hover:bg-primary-soft transition-colors"
          >
            <Smartphone size={18} aria-hidden="true" />
          </button>

          <ThemeToggle />

          <div className="flex items-center border-l border-subtle pl-2 md:pl-3">
            <HeaderAccount />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative print:overflow-visible print:block">
        {/* Sidebar de escritorio */}
        <aside className={cn(nav.sidebar, 'hidden md:flex')}>
          <NavigationContent />
        </aside>

        {/* Sidebar móvil */}
        {isMobileMenuOpen && (
          <div className="print:hidden fixed inset-0 z-50 flex md:hidden">
            <div className="w-64 bg-surface border-r border-subtle flex flex-col h-full shadow-2xl animate-scale-in">
              <NavigationContent />
            </div>
            <div
              className="flex-1 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto bg-bg print:overflow-visible print:block print:h-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
