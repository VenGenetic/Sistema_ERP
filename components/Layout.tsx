import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Link, useSearchParams } from 'react-router-dom';
import HeaderAccount from './HeaderAccount';

const Layout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.includes(path)) return true;
    return false;
  };

  const NavigationContent = () => (
    <>
      <div className="md:hidden p-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold text-lg dark:text-white text-slate-900">Menú</span>
        <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2 mt-2">General</p>

        <Link to="/" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('/') ? 'bg-slate-100 dark:bg-[#161b22] text-slate-900 dark:text-white border-l-2 border-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#161b22]/50 border-l-2 border-transparent'}`}>
          <span className="material-symbols-outlined text-[20px]">grid_view</span>
          Centro de Comando
        </Link>

        <Link to="/team" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('team') ? 'bg-slate-100 dark:bg-[#161b22] text-slate-900 dark:text-white border-l-2 border-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#161b22]/50 border-l-2 border-transparent'}`}>
          <span className="material-symbols-outlined text-[20px]">group</span>
          Equipo
        </Link>

        <p className="px-3 text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2 mt-4">Operaciones</p>

        <Link to="/partners" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('partners') ? 'bg-slate-100 dark:bg-[#161b22] text-slate-900 dark:text-white border-l-2 border-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#161b22]/50 border-l-2 border-transparent'}`}>
          <span className="material-symbols-outlined text-[20px]">hub</span>
          Partners
        </Link>

        <Link to="/products" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('products') ? 'bg-slate-100 dark:bg-[#161b22] text-slate-900 dark:text-white border-l-2 border-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#161b22]/50 border-l-2 border-transparent'}`}>
          <span className="material-symbols-outlined text-[20px]">category</span>
          Catálogo
        </Link>

        <Link to="/inventory" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('inventory') ? 'bg-slate-100 dark:bg-[#161b22] text-slate-900 dark:text-white border-l-2 border-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#161b22]/50 border-l-2 border-transparent'}`}>
          <span className="material-symbols-outlined text-[20px]">inventory_2</span>
          Almacenes
        </Link>

        <Link to="/orders" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('orders') ? 'bg-slate-100 dark:bg-[#161b22] text-slate-900 dark:text-white border-l-2 border-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#161b22]/50 border-l-2 border-transparent'}`}>
          <span className="material-symbols-outlined text-[20px]">local_shipping</span>
          Órdenes
        </Link>

        <Link to="/finance" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${isActive('finance') ? 'bg-slate-100 dark:bg-[#161b22] text-slate-900 dark:text-white border-l-2 border-primary' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#161b22]/50 border-l-2 border-transparent'}`}>
          <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          Finanzas
        </Link>

      </nav>

      {/* System Status Footer */}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 dark:text-slate-50 bg-background-light dark:bg-background-dark transition-colors duration-300">
      {/* Top Navigation - Minimalist */}
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1117] px-4 md:px-6 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-4 md:gap-6">
          <button
            className="md:hidden text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-md transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>

          <Link to="/" className="flex items-center gap-3 group">
            <div className="size-8 text-white bg-slate-900 dark:bg-white dark:text-black rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 shadow-md shadow-primary/20">
              <span className="material-symbols-outlined text-[20px] font-bold">deployed_code</span>
            </div>
            <span className="font-bold text-lg tracking-tight hidden md:block dark:text-white text-slate-900">DropshipERP</span>
          </Link>

          {/* Breadcrumb / Context */}
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-400 font-mono">
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="uppercase tracking-wider text-xs font-semibold">
              {location.pathname === '/' ? 'CENTRO_COMANDO' :
                location.pathname.includes('partners') ? 'SOCIOS' :
                  location.pathname.includes('finance') ? 'FINANZAS' :
                    location.pathname.includes('settings') ? 'CONFIGURACION' : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-1 justify-end gap-3 md:gap-6 items-center">
          <div className="relative hidden md:block w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">search</span>
            <input
              className="w-full bg-slate-100 dark:bg-[#161b22] border-none rounded-md py-1.5 pl-9 pr-4 text-sm focus:ring-1 focus:ring-slate-400 placeholder:text-slate-500 text-slate-900 dark:text-slate-200 font-mono transition-all"
              placeholder="CMD + K para buscar..."
            />
          </div>

          <div className="flex gap-1 items-center border-l border-slate-200 dark:border-slate-800 pl-4 md:pl-6">
            <HeaderAccount />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1117] flex-col hidden md:flex">
          <NavigationContent />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute inset-0 z-50 flex md:hidden">
            <div className="w-64 bg-white dark:bg-[#0c1117] border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-2xl">
              <NavigationContent />
            </div>
            <div
              className="flex-1 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            ></div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-background-light dark:bg-[#0d1117] transition-colors duration-300 scrollbar-hide">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;