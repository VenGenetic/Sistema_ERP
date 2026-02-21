import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface PartProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any; // The full grouped product object from Inventory
}

export const PartProfileModal: React.FC<PartProfileModalProps> = ({ isOpen, onClose, product }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'fitment'>('info');
    const [compatibilities, setCompatibilities] = useState<any[]>([]);
    const [loadingFitment, setLoadingFitment] = useState(false);

    // Fitment form state
    const [newMake, setNewMake] = useState('');
    const [newModel, setNewModel] = useState('');
    const [newYearFrom, setNewYearFrom] = useState('');
    const [newYearTo, setNewYearTo] = useState('');
    const [addingFitment, setAddingFitment] = useState(false);

    useEffect(() => {
        if (isOpen && product?.product_id) {
            fetchCompatibilities();
        } else {
            // Reset state on close
            setCompatibilities([]);
            setActiveTab('info');
        }
    }, [isOpen, product]);

    const fetchCompatibilities = async () => {
        setLoadingFitment(true);
        const { data, error } = await supabase
            .from('product_compatibilities')
            .select('*')
            .eq('product_id', product.product_id)
            .order('make')
            .order('model');

        if (!error && data) {
            setCompatibilities(data);
        }
        setLoadingFitment(false);
    };

    const handleAddFitment = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingFitment(true);
        const { error } = await supabase
            .from('product_compatibilities')
            .insert([{
                product_id: product.product_id,
                make: newMake.trim(),
                model: newModel.trim(),
                year_from: parseInt(newYearFrom) || 0,
                year_to: parseInt(newYearTo) || 0
            }]);

        if (!error) {
            setNewMake('');
            setNewModel('');
            setNewYearFrom('');
            setNewYearTo('');
            fetchCompatibilities();
        } else {
            alert('Error agregando compatibilidad: ' + error.message);
        }
        setAddingFitment(false);
    };

    const handleDeleteFitment = async (id: number) => {
        if (window.confirm('¿Seguro que deseas eliminar esta compatibilidad?')) {
            const { error } = await supabase
                .from('product_compatibilities')
                .delete()
                .eq('id', id);

            if (!error) {
                fetchCompatibilities();
            }
        }
    };

    if (!isOpen || !product) return null;

    const prodData = product.product;
    const stockDetails = product.details;
    const globalStock = product.global_stock;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-800/80">
                    <div className="flex gap-4">
                        <div className="w-16 h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined text-[32px]">construction</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold uppercase">{prodData?.brands?.name || 'Sin Marca'}</span>
                                <span className="text-slate-500 font-mono text-sm">{prodData?.sku}</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{prodData?.name}</h2>
                            <p className="text-slate-500 text-sm mt-1">{prodData?.category || 'Sin categoría'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Información y Stock
                    </button>
                    <button
                        onClick={() => setActiveTab('fitment')}
                        className={`py-3 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'fitment' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Compatibilidad (Fitment)
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                    {activeTab === 'info' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Stock Box */}
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Disponibilidad</h3>
                                <div className="flex items-end gap-3 mb-6">
                                    <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">{globalStock}</span>
                                    <span className="text-slate-500 pb-1">uds globales</span>
                                </div>

                                <div className="space-y-3">
                                    {stockDetails.map((detail: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700/50 rounded-lg">
                                            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400">warehouse</span>
                                                {detail.warehouses?.name}
                                            </div>
                                            <span className="font-bold text-slate-900 dark:text-white">{detail.current_stock}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Costing Box */}
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Costos y Precios</h3>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
                                        <span className="text-sm text-slate-500">Costo Base (S/I)</span>
                                        <span className="font-mono font-medium text-slate-900 dark:text-white">${parseFloat(prodData?.cost_without_vat || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
                                        <span className="text-sm text-slate-500">IVA</span>
                                        <span className="font-mono text-slate-900 dark:text-white">{prodData?.vat_percentage || 12}%</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
                                        <span className="text-sm text-slate-500">Margen de Ganancia</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{(parseFloat(prodData?.profit_margin || 0.3) * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">Precio Venta (PVP)</span>
                                        <span className="font-mono text-xl font-black text-primary">
                                            ${parseFloat(prodData?.price || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fitment' && (
                        <div className="flex flex-col gap-6">
                            {/* Add Fitment Form */}
                            <form onSubmit={handleAddFitment} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Agregar Vehículo Compatible</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                    <input required placeholder="Marca (ej. Yamaha)" className="col-span-2 lg:col-span-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-slate-50 dark:bg-slate-900 dark:text-white" value={newMake} onChange={e => setNewMake(e.target.value)} />
                                    <input required placeholder="Modelo (ej. MT-07)" className="col-span-2 lg:col-span-2 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-slate-50 dark:bg-slate-900 dark:text-white" value={newModel} onChange={e => setNewModel(e.target.value)} />
                                    <input required type="number" placeholder="Año Desde" className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-slate-50 dark:bg-slate-900 dark:text-white" value={newYearFrom} onChange={e => setNewYearFrom(e.target.value)} />
                                    <input required type="number" placeholder="Año Hasta" className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-slate-50 dark:bg-slate-900 dark:text-white" value={newYearTo} onChange={e => setNewYearTo(e.target.value)} />
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button type="submit" disabled={addingFitment} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px]">add</span>
                                        {addingFitment ? 'Agregando...' : 'Agregar Fitment'}
                                    </button>
                                </div>
                            </form>

                            {/* Fitment List */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                {loadingFitment ? (
                                    <div className="p-8 text-center text-slate-500">Cargando compatibilidades...</div>
                                ) : compatibilities.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                                        <span className="material-symbols-outlined text-4xl text-slate-300">two_wheeler</span>
                                        <p>No hay vehículos registrados para este repuesto.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="px-5 py-3">Marca</th>
                                                <th className="px-5 py-3">Modelo</th>
                                                <th className="px-5 py-3 text-center">Años</th>
                                                <th className="px-5 py-3 text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {compatibilities.map(c => (
                                                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{c.make}</td>
                                                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{c.model}</td>
                                                    <td className="px-5 py-3 text-center font-mono text-slate-500">
                                                        {c.year_from} - {c.year_to}
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <button
                                                            onClick={() => handleDeleteFitment(c.id)}
                                                            className="text-red-400 hover:text-red-600 transition p-1"
                                                            title="Eliminar"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
