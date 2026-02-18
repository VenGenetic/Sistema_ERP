import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TeamPanel from '../components/settings/TeamPanel';
import ProfilePanel from '../components/settings/ProfilePanel';
import AccountPanel from '../components/settings/AccountPanel';

// --- Local Panels for Inventory, Finance, Dev (with persistence) ---

const InventoryPanel = () => {
    // Persist alerts in localStorage
    const [lowStockThreshold, setLowStockThreshold] = useState(() => {
        return localStorage.getItem('settings_inventory_threshold') || '10';
    });
    const [notifyEmail, setNotifyEmail] = useState(() => {
        return localStorage.getItem('settings_inventory_email') || 'logistica@dropshiperp.com';
    });

    useEffect(() => {
        localStorage.setItem('settings_inventory_threshold', lowStockThreshold);
    }, [lowStockThreshold]);

    useEffect(() => {
        localStorage.setItem('settings_inventory_email', notifyEmail);
    }, [notifyEmail]);

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Alertas de Stock</h3>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Umbral Global de Stock Bajo</label>
                        <input
                            type="number"
                            value={lowStockThreshold}
                            onChange={(e) => setLowStockThreshold(e.target.value)}
                            className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm p-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <p className="text-xs text-text-secondary mt-1">Alertar cuando la cantidad de SKU caiga por debajo de este valor.</p>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Email de Notificación</label>
                        <input
                            type="email"
                            value={notifyEmail}
                            onChange={(e) => setNotifyEmail(e.target.value)}
                            className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm p-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Warehouses - Static for now but could be connected to DB later */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Bodegas</h3>
                    <button className="flex items-center gap-2 text-sm bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[16px]">add_location</span>
                        Añadir Ubicación
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { name: "Sede Principal", type: "Física", location: "New York, USA", stock: "14,202 unidades" },
                        { name: "MegaDrop Virtual", type: "Socio Digital", location: "Enlace API", stock: "Sincronizando..." },
                        { name: "Centro Costa Oeste", type: "Física", location: "California, USA", stock: "8,500 unidades" },
                    ].map((w, i) => (
                        <div key={i} className="bg-surface-dark border border-border-dark rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer group">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white">{w.name}</h4>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${w.type === 'Física' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-purple-500/10 text-purple-500 border-purple-500/20'}`}>{w.type}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-text-secondary mb-3">
                                <span className="material-symbols-outlined text-[16px]">location_on</span>
                                {w.location}
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-border-dark">
                                <span className="text-xs text-text-secondary">Stock Actual</span>
                                <span className="text-sm font-mono text-white">{w.stock}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const FinancePanel = () => {
    const [currency, setCurrency] = useState(() => localStorage.getItem('settings_finance_currency') || 'USD ($)');
    const [fiscalYear, setFiscalYear] = useState(() => localStorage.getItem('settings_finance_fiscal') || '31 de Diciembre');
    const [autoSync, setAutoSync] = useState(() => localStorage.getItem('settings_finance_autosync') === 'true');

    useEffect(() => { localStorage.setItem('settings_finance_currency', currency); }, [currency]);
    useEffect(() => { localStorage.setItem('settings_finance_fiscal', fiscalYear); }, [fiscalYear]);
    useEffect(() => { localStorage.setItem('settings_finance_autosync', String(autoSync)); }, [autoSync]);


    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Moneda y Región</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Moneda Base</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm p-2.5 outline-none focus:border-primary"
                            >
                                <option>USD ($)</option>
                                <option>EUR (€)</option>
                                <option>GBP (£)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Cierre Año Fiscal</label>
                            <select
                                value={fiscalYear}
                                onChange={(e) => setFiscalYear(e.target.value)}
                                className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm p-2.5 outline-none focus:border-primary"
                            >
                                <option>31 de Diciembre</option>
                                <option>31 de Marzo</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Automatizaciones</h3>
                    <div className="space-y-4">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <div className="flex flex-col">
                                <span className="text-white font-medium">Auto-Sincronización Stripe</span>
                                <span className="text-text-secondary text-xs">Conciliar automáticamente los pagos.</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={autoSync}
                                onChange={(e) => setAutoSync(e.target.checked)}
                                className="form-checkbox rounded text-primary border-border-dark bg-background-dark focus:ring-primary h-5 w-5"
                            />
                        </label>
                    </div>
                </div>
            </div>
            {/* Read-only Chart of Accounts preview */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Plan de Cuentas</h3>
                    <button className="flex items-center gap-2 text-sm bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Añadir Cuenta
                    </button>
                </div>
                <div className="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
                    <div className="p-4 text-center text-text-secondary text-sm">
                        Visualización de cuentas contables (Conectado a módulo Finanzas)
                    </div>
                </div>
            </div>
        </div>
    )
}

const DevPanel = () => {
    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Variables de Entorno</h3>
                <div className="space-y-3">
                    {[
                        "NEXT_PUBLIC_SUPABASE_URL",
                        "SUPABASE_SERVICE_ROLE_KEY",
                        "STRIPE_SECRET_KEY",
                        "NODE_ENV"
                    ].map((env, i) => (
                        <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 pb-3 border-b border-border-dark last:border-0 last:pb-0">
                            <span className="font-mono text-sm text-text-secondary w-64">{env}</span>
                            <div className="flex-1 bg-background-dark border border-border-dark rounded px-3 py-1.5 flex justify-between items-center">
                                <span className="text-xs text-slate-500 font-mono">••••••••••••••••••••••••</span>
                                <span className="material-symbols-outlined text-[16px] text-text-secondary cursor-pointer hover:text-white">visibility</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

const PartnersPanel = () => {
    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">Configuración de Webhooks</h3>
                <p className="text-text-secondary text-sm mb-4">Endpoints para pedidos dropshipping entrantes.</p>
                <div className="flex gap-2 items-center bg-background-dark border border-border-dark rounded-lg p-2">
                    <span className="material-symbols-outlined text-text-secondary pl-2">webhook</span>
                    <code className="text-sm font-mono text-white flex-1 overflow-x-auto">https://api.dropshiperp.com/webhooks/v1/orders/inbound</code>
                </div>
            </div>
        </div>
    )
}

// --- Main Settings Component ---

const Settings: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'general';

    const renderContent = () => {
        switch (activeTab) {
            case 'general': return <ProfilePanel />;
            case 'account': return <AccountPanel />;
            case 'team': return <TeamPanel />;
            case 'partners': return <PartnersPanel />;
            case 'inventory': return <InventoryPanel />;
            case 'finance': return <FinancePanel />;
            case 'advanced': return <DevPanel />;
            default: return <ProfilePanel />;
        }
    }

    const getTitle = () => {
        switch (activeTab) {
            case 'general': return 'Mi Perfil';
            case 'account': return 'Seguridad de Cuenta';
            case 'team': return 'Gestión de Equipos';
            case 'partners': return 'Dropshipping';
            case 'inventory': return 'Bodegas y Logística';
            case 'finance': return 'Configuración Financiera';
            case 'advanced': return 'Herramientas de Desarrollador';
            default: return 'Mi Perfil';
        }
    }

    const getDescription = () => {
        switch (activeTab) {
            case 'general': return 'Gestiona tu identidad pública, avatar y biografía.';
            case 'account': return 'Actualiza tu email, contraseña y verifica tu cuenta.';
            case 'team': return 'Miembros del equipo y sus roles.';
            case 'partners': return 'Conexiones con proveedores externos.';
            case 'inventory': return 'Alertas de stock y ubicaciones.';
            case 'finance': return 'Preferencias de moneda y año fiscal.';
            case 'advanced': return 'Variables de entorno y logs.';
            default: return '';
        }
    }

    const tabs = [
        { id: 'general', label: 'Mi Perfil', icon: 'person' },
        { id: 'account', label: 'Cuenta & Seguridad', icon: 'shield_lock' },
        { id: 'team', label: 'Equipo', icon: 'group' },
        { id: 'inventory', label: 'Logística', icon: 'warehouse' },
        { id: 'finance', label: 'Finanzas', icon: 'payments' },
        { id: 'partners', label: 'Dropshipping', icon: 'hub' },
        { id: 'advanced', label: 'Desarrollador', icon: 'code' },
    ];

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background-light dark:bg-background-dark">
            {/* Settings Sidebar */}
            <div className="w-64 border-r border-border-dark bg-surface-dark overflow-y-auto hidden md:block">
                <div className="p-4">
                    <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 px-2">Configuración</h2>
                    <nav className="space-y-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setSearchParams({ tab: tab.id })}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'text-text-secondary hover:bg-surface-hover hover:text-white'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-background-dark">
                <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
                    {/* Mobile Tab Select */}
                    <div className="md:hidden mb-6">
                        <select
                            value={activeTab}
                            onChange={(e) => setSearchParams({ tab: e.target.value })}
                            className="block w-full rounded-lg border-border-dark bg-surface-dark text-white py-2 pl-3 pr-10 focus:border-primary focus:ring-primary sm:text-sm"
                        >
                            {tabs.map((tab) => (
                                <option key={tab.id} value={tab.id}>{tab.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Header Section */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white tracking-tight">{getTitle()}</h1>
                        <p className="text-text-secondary mt-1">{getDescription()}</p>
                    </div>

                    {/* Content */}
                    <div className="bg-surface-dark rounded-xl border border-border-dark shadow-sm p-6 min-h-[400px]">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;