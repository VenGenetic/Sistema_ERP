import React, { useState } from 'react';

interface PartnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    partner?: any; // Replace with proper type
}

const PartnerModal: React.FC<PartnerModalProps> = ({ isOpen, onClose, partner }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'warehouses' | 'api'>('details');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                            {partner?.img ? (
                                <img src={partner.img} alt="" className="h-10 w-10 object-contain" />
                            ) : (
                                <span className="material-symbols-outlined text-3xl text-slate-400">storefront</span>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{partner ? partner.name : 'Nuevo Socio'}</h3>
                            <p className="text-sm text-slate-500">{partner?.type || 'Proveedor / Revendedor'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Detalles Generales
                    </button>
                    <button
                        onClick={() => setActiveTab('warehouses')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'warehouses' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Bodegas Virtuales
                    </button>
                    <button
                        onClick={() => setActiveTab('api')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'api' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
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
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Comercial</label>
                                    <input type="text" defaultValue={partner?.name} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Socio</label>
                                    <select defaultValue={partner?.type} className="w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
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
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-3 text-blue-700 dark:text-blue-300 text-sm">
                                <span className="material-symbols-outlined">info</span>
                                <p>Los socios de tipo "Proveedor" pueden tener inventario gestionado externamente que se refleja como una "Bodega Virtual" en nuestro sistema.</p>
                            </div>
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded text-purple-600 dark:text-purple-400">
                                        <span className="material-symbols-outlined">cloud</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Inventario Remoto {partner?.name}</h4>
                                        <p className="text-xs text-slate-500">ID: WH-{partner?.id?.split('-')[1] || 'NEW'}</p>
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
                                <h4 className="font-medium text-slate-900 dark:text-white mb-2">Credenciales de API</h4>
                                <div className="flex gap-2">
                                    <input readOnly value="pk_live_51Mz..." className="flex-1 font-mono text-sm bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-slate-600 dark:text-slate-400" />
                                    <button className="p-2 text-slate-500 hover:text-primary transition-colors border border-slate-200 dark:border-slate-700 rounded-lg">
                                        <span className="material-symbols-outlined">content_copy</span>
                                    </button>
                                    <button className="p-2 text-slate-500 hover:text-red-500 transition-colors border border-slate-200 dark:border-slate-700 rounded-lg">
                                        <span className="material-symbols-outlined">refresh</span>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Esta clave permite al socio leer inventario y crear órdenes.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg transition-colors">
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
