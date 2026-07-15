import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { getThumbnailUrl } from '../../utils/image';

const MobileCatalog: React.FC = () => {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observer = useRef<IntersectionObserver | null>(null);

    const pageSize = 15;

    const fetchProducts = useCallback(async (pageNum: number, search: string, append: boolean) => {
        setLoading(true);
        try {
            let query = supabase
                .from('products')
                .select(`
                    *,
                    brands (name),
                    inventory_levels (current_stock)
                `)
                .eq('is_active', true);

            if (search) {
                query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
            }

            // Order by most recently added or by name
            query = query.order('name', { ascending: true });

            const from = (pageNum - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                if (data.length < pageSize) setHasMore(false);
                else setHasMore(true);

                if (append) {
                    setProducts(prev => [...prev, ...data]);
                } else {
                    setProducts(data);
                }
            }
        } catch (error) {
            console.error('Error fetching catalog:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load and search changes
    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            setPage(1);
            setHasMore(true);
            fetchProducts(1, searchTerm, false);
        }, 400);

        return () => clearTimeout(delayDebounce);
    }, [searchTerm, fetchProducts]);

    // Pagination (Load more)
    useEffect(() => {
        if (page > 1) {
            fetchProducts(page, searchTerm, true);
        }
    }, [page, fetchProducts, searchTerm]);

    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 animate-fade-in">
            {/* Header Sticky */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-4 pt-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Catálogo</h1>
                
                {/* Search Bar */}
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        search
                    </span>
                    <input
                        type="text"
                        placeholder="Buscar por SKU o nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400 shadow-inner"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Product List */}
            <div className="flex-1 p-4 flex flex-col gap-4">
                {products.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <span className="material-symbols-outlined text-6xl mb-4 opacity-50">inventory_2</span>
                        <p>No se encontraron productos</p>
                    </div>
                )}

                {products.map((prod, index) => {
                    const globalStock = prod.inventory_levels?.reduce((acc: number, level: any) => acc + (level.current_stock || 0), 0) || 0;
                    const imageUrl = prod.image_url ? getThumbnailUrl(prod.image_url, 300) : null;
                    const priceWithVat = prod.cost_without_vat && prod.vat_percentage 
                        ? (prod.cost_without_vat * (1 + prod.vat_percentage/100)).toFixed(2)
                        : prod.price?.toFixed(2);

                    return (
                        <div 
                            key={`${prod.id}-${index}`}
                            ref={index === products.length - 1 ? lastElementRef : null}
                            className="bg-white dark:bg-slate-800 rounded-3xl p-3 flex gap-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-700/50"
                        >
                            {/* Image Container */}
                            <div className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex-shrink-0 overflow-hidden relative flex items-center justify-center">
                                {imageUrl ? (
                                    <img src={imageUrl} alt={prod.name} className="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal" loading="lazy" />
                                ) : (
                                    <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-500">image</span>
                                )}
                                {globalStock <= 0 && (
                                    <div className="absolute inset-0 bg-red-500/10 backdrop-blur-[1px] flex items-center justify-center">
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Agotado</span>
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                                            {prod.sku}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-tight line-clamp-2">
                                        {prod.name}
                                    </h3>
                                    {prod.brands?.name && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {prod.brands.name}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="flex items-center justify-between mt-2">
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                                        ${priceWithVat || '0.00'}
                                    </div>
                                    <div className={`text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 ${
                                        globalStock > 0 
                                            ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20' 
                                            : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
                                    }`}>
                                        <span className="material-symbols-outlined text-[14px]">
                                            {globalStock > 0 ? 'check_circle' : 'error'}
                                        </span>
                                        Stock: {globalStock}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {loading && (
                    <div className="flex justify-center py-4">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default MobileCatalog;
