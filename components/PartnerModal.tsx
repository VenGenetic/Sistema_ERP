import React, { useState } from 'react';
import {
  Cloud,
  Copy,
  Info,
  RefreshCw,
  Store,
  X,
} from 'lucide-react';

interface PartnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    partner?: any; // Replace with proper type
}

const PartnerModal: React.FC<PartnerModalProps> = ({ isOpen, onClose, partner }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'warehouses' | 'api'>('details');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="p-6 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-surface shadow-sm border border-subtle flex items-center justify-center">
                            {partner?.img ? (
                                <img src={partner.img} alt="" className="h-10 w-10 object-contain" />
                            ) : (
                                <Store size={28} className="text-fg-subtle" aria-hidden="true" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-fg">{partner ? partner.name : 'Nuevo Socio'}</h3>
                            <p className="text-sm text-fg-muted">{partner?.type || 'Proveedor / Revendedor'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-fg-muted hover:text-slate-700 dark:hover:text-slate-300">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-subtle px-6">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Detalles Generales
                    </button>
                    <button
                        onClick={() => setActiveTab('warehouses')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'warehouses' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Bodegas Virtuales
                    </button>
                    <button
                        onClick={() => setActiveTab('api')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'api' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        API & Integración
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-fg mb-1">Nombre Comercial</label>
                                    <input type="text" defaultValue={partner?.name} className="w-full rounded-lg border-strong bg-surface text-fg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-fg mb-1">Tipo de Socio</label>
                                    <select defaultValue={partner?.type} className="w-full rounded-lg border-strong bg-surface text-fg">
                                        <option>Proveedor</option>
                                        <option>Revendedor</option>
                                        <option>Operador Logístico</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'warehouses' && (
                        <div className="space-y-4">
                            <div className="bg-primary-soft p-4 rounded-lg flex gap-3 text-primary-soft-fg text-sm">
                                <Info size={18} aria-hidden="true" />
                                <p>Los socios de tipo "Proveedor" pueden tener inventario gestionado externamente que se refleja como una "Bodega Virtual" en nuestro sistema.</p>
                            </div>
                            <div className="border border-subtle rounded-lg p-4 flex justify-between items-center bg-surface-2">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary-soft p-2 rounded text-primary">
                                        <Cloud size={18} aria-hidden="true" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-fg">Inventario Remoto {partner?.name}</h4>
                                        <p className="text-xs text-fg-muted">ID: WH-{partner?.id?.split('-')[1] || 'NEW'}</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-medium text-fg mb-2">Credenciales de API</h4>
                                <div className="flex gap-2">
                                    <input readOnly value="pk_live_51Mz..." className="flex-1 font-mono text-sm bg-surface-3 border-none rounded-lg text-fg-muted" />
                                    <button className="p-2 text-fg-muted hover:text-primary transition-colors border border-subtle rounded-lg">
                                        <Copy size={18} aria-hidden="true" />
                                    </button>
                                    <button className="p-2 text-fg-muted hover:text-danger transition-colors border border-subtle rounded-lg">
                                        <RefreshCw size={18} aria-hidden="true" />
                                    </button>
                                </div>
                                <p className="text-xs text-fg-muted mt-2">Esta clave permite al socio leer inventario y crear órdenes.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-subtle flex justify-end gap-3 bg-surface-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-fg hover:bg-white dark:hover:bg-slate-700 border border-strong rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/30 transition-colors">
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PartnerModal;
