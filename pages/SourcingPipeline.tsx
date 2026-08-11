import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { SourcingQuickEditModal } from '../components/SourcingQuickEditModal';
import { getStockAvailableDemandCount, warnRevertedDemands } from '../utils/importerOverride';
import {
  ArrowRight,
  Ban,
  Check,
  Image as ImageIcon,
  Inbox,
  Package,
  PackageX,
  Pencil,
  RefreshCw,
  Search,
  Telescope,
  X,
} from 'lucide-react';

interface SourcingItem {
    id: number;
    sku: string;
    name: string;
    investigation_status: 'pending' | 'en_consulta' | 'no_encontrado' | 'encontrado' | null;
    auto_order_disabled: boolean;
    importer_stock: number;
    importer_unavailable_override: boolean;
    image_url: string | null;
}

const SourcingPipeline: React.FC = () => {
    const [items, setItems] = useState<SourcingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state
    const [selectedItem, setSelectedItem] = useState<SourcingItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchPipeline = async () => {
        setLoading(true);
        try {
            // We fetch items that are either being investigated OR are out of stock in importer
            const { data, error } = await supabase
                .from('products')
                .select('id, sku, name, investigation_status, auto_order_disabled, importer_stock, importer_unavailable_override, image_url')
                .or('importer_stock.eq.0,investigation_status.in.(en_consulta,no_encontrado)')
                .eq('is_active', true)
                .order('id', { ascending: false });

            if (error) throw error;
            setItems(data || []);
        } catch (err: any) {
            console.error('Error fetching sourcing pipeline:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPipeline();
    }, []);

    const handleOpenModal = (item: SourcingItem) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const handleQuickMove = async (item: SourcingItem, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('products')
                .update({ investigation_status: newStatus })
                .eq('id', item.id);
            if (error) throw error;
            fetchPipeline();
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    // Quick toggle for "la importadora dice que hay stock pero en realidad no
    // hay" -- forces importer_stock to read as 0 everywhere (Sourcing,
    // Reposición, Demandas) until manually unmarked. Always applied as a
    // permanent override from here; use el modal de edición del producto para
    // marcarlo como temporal.
    const handleToggleImporterOverride = async (item: SourcingItem) => {
        const turningOn = !item.importer_unavailable_override;
        try {
            const pendingRevertCount = turningOn ? await getStockAvailableDemandCount(item.id) : 0;

            const { error } = await supabase
                .from('products')
                .update({
                    importer_unavailable_override: turningOn,
                    importer_unavailable_until: null,
                })
                .eq('id', item.id);
            if (error) throw error;

            warnRevertedDemands(pendingRevertCount);
            fetchPipeline();
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const filteredItems = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Grouping for Kanban columns
    const columns = [
        { id: 'pending', title: 'Pendientes (Agotados)', color: 'bg-slate-100 dark:bg-slate-800/50', headerColor: 'border-slate-300 dark:border-slate-600', textColor: 'text-slate-700 dark:text-slate-300' },
        { id: 'en_consulta', title: 'En Consulta', color: 'bg-warning-soft dark:bg-warning/10', headerColor: 'border-warning/20 dark:border-warning', textColor: 'text-warning dark:text-warning' },
        { id: 'no_encontrado', title: 'No Encontrado', color: 'bg-danger-soft dark:bg-danger/10', headerColor: 'border-danger/20 dark:border-danger', textColor: 'text-danger dark:text-danger' },
        { id: 'encontrado', title: 'Encontrado / Stock', color: 'bg-success-soft dark:bg-success/10', headerColor: 'border-success/20 dark:border-success', textColor: 'text-success dark:text-success' }
    ];

    const getItemsByStatus = (statusId: string) => {
        return filteredItems.filter(item => {
            const currentStatus = item.investigation_status || 'pending';
            if (statusId === 'encontrado' && item.importer_stock > 0 && currentStatus === 'pending') {
                // Si tiene stock pero no tiene status manual, técnicamente está "encontrado" automáticamente
                return true;
            }
            if (item.importer_stock > 0 && currentStatus !== 'encontrado') {
                return false; // Si tiene stock, debe estar en "Encontrado" a menos que explicitly lo esten buscando de nuevo
            }
            return currentStatus === statusId;
        });
    };

    return (
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6 h-full min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold dark:text-white tracking-tight flex items-center gap-3">
                        <Telescope size={32} className="text-primary" aria-hidden="true" />
                        Pipeline de Investigación
                    </h1>
                    <p className="text-fg-muted mt-1">Sourcing interno de repuestos agotados en la importadora.</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-surface border border-subtle rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={fetchPipeline}
                        className="flex items-center gap-2 px-4 py-2 bg-surface border border-subtle rounded-lg hover:bg-surface-hover transition-colors shadow-sm dark:text-white"
                        title="Actualizar"
                    >
                        <RefreshCw size={18} className="${loading ? 'animate-spin' : ''}" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex gap-6 overflow-x-auto pb-4 h-full flex-1">
                {columns.map(col => {
                    const colItems = getItemsByStatus(col.id);
                    return (
                        <div key={col.id} className={`flex flex-col w-80 min-w-[320px] rounded-xl border border-subtle overflow-hidden ${col.color}`}>
                            {/* Column Header */}
                            <div className={`p-4 border-b-2 bg-white/50 dark:bg-black/20 ${col.headerColor}`}>
                                <h3 className={`font-bold text-sm flex items-center justify-between ${col.textColor}`}>
                                    {col.title}
                                    <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full text-xs">
                                        {colItems.length}
                                    </span>
                                </h3>
                            </div>

                            {/* Cards Container */}
                            <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1 h-[calc(100vh-250px)]">
                                {colItems.map(item => (
                                    <div key={item.id} className="bg-surface p-4 rounded-lg shadow-sm border border-subtle flex flex-col gap-3 group hover:border-primary/20 transition-all">
                                        <div className="flex gap-3">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded object-cover border border-slate-100 dark:border-slate-800" />
                                            ) : (
                                                <div className="w-12 h-12 rounded bg-surface-2 border border-slate-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0">
                                                    <ImageIcon size={20} className="text-fg-subtle" aria-hidden="true" />
                                                </div>
                                            )}
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-xs font-mono text-fg-muted truncate">{item.sku}</span>
                                                <span className="text-sm font-semibold text-fg line-clamp-2 leading-tight" title={item.name}>{item.name}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex gap-1">
                                                {item.auto_order_disabled ? (
                                                    <span title="Auto-Pedido Desactivado" className="inline-flex"><Ban size={16} className="text-danger" aria-hidden="true" /></span>
                                                ) : (
                                                    <span title="Auto-Pedido Activado" className="inline-flex"><RefreshCw size={16} className="text-success" aria-hidden="true" /></span>
                                                )}
                                                {item.importer_stock > 0 && (
                                                    <span title={`Stock en Importadora: ${item.importer_stock}`} className="inline-flex">
                                                        <Package size={16} className="text-primary" aria-hidden="true" />
                                                    </span>
                                                )}
                                                {item.importer_unavailable_override && (
                                                    <span title="Marcado manualmente como agotado en importadora (falso positivo del scraper)" className="inline-flex"><PackageX size={16} className="text-warning" aria-hidden="true" /></span>
                                                )}
                                            </div>

                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleToggleImporterOverride(item)}
                                                    className={`p-1 hover:bg-surface-hover rounded ${item.importer_unavailable_override ? 'text-warning' : 'text-slate-500 hover:text-warning'}`}
                                                    title={item.importer_unavailable_override
                                                        ? 'Quitar marca de "agotado en importadora"'
                                                        : 'La importadora dice que hay stock pero en realidad no hay: marcar como agotado'}
                                                >
                                                    <PackageX size={16} aria-hidden="true" />
                                                </button>
                                                {col.id === 'pending' && (
                                                    <button onClick={() => handleQuickMove(item, 'en_consulta')} className="p-1 hover:bg-surface-hover rounded text-fg-muted hover:text-warning" title="Mover a En Consulta">
                                                        <ArrowRight size={16} aria-hidden="true" />
                                                    </button>
                                                )}
                                                {col.id === 'en_consulta' && (
                                                    <>
                                                        <button onClick={() => handleQuickMove(item, 'no_encontrado')} className="p-1 hover:bg-surface-hover rounded text-fg-muted hover:text-danger" title="Marcar No Encontrado">
                                                            <X size={16} aria-hidden="true" />
                                                        </button>
                                                        <button onClick={() => handleQuickMove(item, 'encontrado')} className="p-1 hover:bg-surface-hover rounded text-fg-muted hover:text-success" title="Marcar Encontrado">
                                                            <Check size={16} aria-hidden="true" />
                                                        </button>
                                                    </>
                                                )}
                                                <button onClick={() => handleOpenModal(item)} className="p-1 hover:bg-surface-hover rounded text-fg-muted hover:text-primary" title="Editar Sourcing">
                                                    <Pencil size={16} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {colItems.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-32 text-fg-subtle gap-2">
                                        <Inbox size={24} aria-hidden="true" />
                                        <span className="text-xs font-medium uppercase tracking-wider">Vacío</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <SourcingQuickEditModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedItem(null); }}
                product={selectedItem}
                onSuccess={fetchPipeline}
            />
        </div>
    );
};

export default SourcingPipeline;
