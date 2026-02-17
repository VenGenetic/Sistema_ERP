import React, { useState } from 'react';

interface PartnerModalProps {
    isOpen: boolean;
    onClose: () => void;
    partner?: any; // Replace with proper type
}

const PartnerModal: React.FC<PartnerModalProps> = ({ isOpen, onClose, partner }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'warehouses' | 'api'>('details');
    const [apiKey, setApiKey] = useState('sk_live_51Mz...');
    const [showKey, setShowKey] = useState(false);

    if (!isOpen) return null;

    const generateNewKey = () => {
        // Mock key generation
        const newKey = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        setApiKey(newKey);
        setShowKey(true);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#1e293b] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-[#0f172a]">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {partner ? `Editar Partner: ${partner.name}` : 'Nuevo Partner'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 gap-6">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Detalles Generales
                    </button>
                    <button
                        onClick={() => setActiveTab('warehouses')}
                        className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'warehouses' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Almacenes Digitales
                    </button>
                    <button
                        onClick={() => setActiveTab('api')}
                        className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'api' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        API & Webhooks
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-[#1e293b]">
                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre Comercial</label>
                                    <input type="text" className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white px-3 py-2 disabled:opacity-50" defaultValue={partner?.name} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Socio</label>
                                    <select className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white px-3 py-2">
                                        <option>Proveedor</option>
                                        <option>Revendedor</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email de Contacto</label>
                                <input type="email" className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white px-3 py-2" placeholder="contacto@empresa.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
                                <input type="text" className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white px-3 py-2" defaultValue={partner?.img} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'warehouses' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Vincula este socio a uno o más almacenes digitales para la sincronización de inventario.
                            </p>

                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0f172a]">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-gray-500 text-sm">home_work</span>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">Almacén Central {i}</div>
                                                <div className="text-xs text-gray-500">ID: WH-{100 + i} • Miami, FL</div>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary dark:peer-focus:ring-primary rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <button className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">add</span>
                                Crear nuevo almacén virtual
                            </button>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div className="space-y-6">
                            <div className="bg-gray-50 dark:bg-[#0f172a] p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API Key del Socio</label>
                                <div className="flex gap-2">
                                    <input
                                        type={showKey ? "text" : "password"}
                                        value={apiKey}
                                        readOnly
                                        className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1e293b] text-gray-900 dark:text-white px-3 py-2 font-mono text-sm"
                                    />
                                    <button
                                        onClick={() => setShowKey(!showKey)}
                                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg"
                                    >
                                        <span className="material-symbols-outlined">{showKey ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                    <button
                                        onClick={generateNewKey}
                                        className="p-2 text-primary hover:bg-primary/10 border border-primary/30 rounded-lg transition-colors"
                                        title="Rotar Key"
                                    >
                                        <span className="material-symbols-outlined">refresh</span>
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px] text-amber-500">warning</span>
                                    Rotar la clave invalidará inmediatamente la anterior. Asegúrate de actualizar tus sistemas.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Webhook URL (Order Events)</label>
                                <input type="url" className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white px-3 py-2" placeholder="https://api.partner.com/webhooks/orders" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-[#0f172a] px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-lg shadow-primary/20 transition-all">
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PartnerModal;
