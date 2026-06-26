import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BrandSelect } from './BrandSelect';
import { WarehouseSelect } from './WarehouseSelect';
import { TagManager, Tag } from './TagManager';

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    productToEdit?: {
        id: number;
        sku: string;
        name: string;
        category: string;
        brand_id: number | null;
        min_stock_threshold: number;
        profit_margin: number;
        cost_without_vat: number;
        vat_percentage: number;
        price: number;
        image_url?: string | null;
        video_url?: string | null;
        group_id?: string | null;
        last_edited_at?: string | null;
        profiles?: any;
    } | null;
}

// ─── Helper: round to 4 decimals to avoid floating-point noise ───
const r = (n: number) => Math.round(n * 10000) / 10000;

// ─── Derived cost WITH VAT ───
const costWithVat = (costWithoutVat: number, vatPercentage: number) =>
    r(costWithoutVat * (1 + vatPercentage / 100));

// ─── PVP from cost + margin ───
const calcPrice = (costWithoutVat: number, vatPercentage: number, profitMargin: number) =>
    r(costWithVat(costWithoutVat, vatPercentage) * (1 + profitMargin));

// ─── Margin from PVP + cost ───
const calcMargin = (costWithoutVat: number, vatPercentage: number, price: number) => {
    const c = costWithVat(costWithoutVat, vatPercentage);
    return c > 0 ? r(price / c - 1) : 0;
};

export const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSuccess, productToEdit }) => {
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isVideoUploading, setIsVideoUploading] = useState(false);
    const [entryByPrice, setEntryByPrice] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'general' | 'related'>('general');
    
    // Repuestos relacionados state
    const [linkedProducts, setLinkedProducts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [productToLink, setProductToLink] = useState<any>(null);

    // Tags state
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

    const [formData, setFormData] = useState({
        sku: '',
        name: '',
        brandId: null as number | null,
        minStock: 10,
        profitMargin: 0.65,
        costWithoutVat: 0,
        vatPercentage: 15.0,
        price: 0,
        imageUrl: '',
        videoUrl: ''
    });
    const [imageRemoved, setImageRemoved] = useState(false);
    const [videoRemoved, setVideoRemoved] = useState(false);

    // Stock Adjustment State
    const [stockAdjustment, setStockAdjustment] = useState({
        warehouse_id: null as number | null,
        quantity: '',
        isPurchase: false,
        account_id: null as number | null,
        isMerma: false,
        merma_account_id: null as number | null
    });
    const [accounts, setAccounts] = useState<any[]>([]);
    const [currentStock, setCurrentStock] = useState<number | null>(null);

    useEffect(() => {
        const fetchStock = async () => {
            if (stockAdjustment.warehouse_id) {
                if (productToEdit?.id) {
                    const { data } = await supabase
                        .from('inventory_levels')
                        .select('current_stock')
                        .eq('warehouse_id', stockAdjustment.warehouse_id)
                        .eq('product_id', productToEdit.id)
                        .single();
                    if (data) {
                        setCurrentStock(data.current_stock);
                        setStockAdjustment(prev => ({ ...prev, quantity: prev.quantity === '' ? data.current_stock.toString() : prev.quantity }));
                    } else {
                        setCurrentStock(0);
                        setStockAdjustment(prev => ({ ...prev, quantity: prev.quantity === '' ? '0' : prev.quantity }));
                    }
                } else {
                    setCurrentStock(0);
                    setStockAdjustment(prev => ({ ...prev, quantity: prev.quantity === '' ? '0' : prev.quantity }));
                }
            } else {
                setCurrentStock(null);
            }
        };
        fetchStock();
    }, [stockAdjustment.warehouse_id, productToEdit?.id]);

    useEffect(() => {
        if (isOpen) {
            fetchAccounts();
            if (productToEdit) {
                const cwv = productToEdit.cost_without_vat || 0;
                const vat = productToEdit.vat_percentage || 15.0;
                const margin = productToEdit.profit_margin || 0.65;
                // Derive PVP from cost data if stored price is 0 or missing
                const storedPrice = productToEdit.price || 0;
                const derivedPrice = storedPrice > 0 ? storedPrice : calcPrice(cwv, vat, margin);

                setFormData({
                    sku: productToEdit.sku || '',
                    name: productToEdit.name || '',
                    brandId: productToEdit.brand_id,
                    minStock: productToEdit.min_stock_threshold || 10,
                    profitMargin: Math.round(margin * 100) / 100,
                    costWithoutVat: cwv,
                    vatPercentage: vat,
                    price: Math.round(derivedPrice * 100) / 100,
                    imageUrl: productToEdit.image_url || '',
                    videoUrl: productToEdit.video_url || ''
                });
            } else {
                setFormData({
                    sku: '',
                    name: '',
                    brandId: null,
                    minStock: 10,
                    profitMargin: 0.65,
                    costWithoutVat: 0,
                    vatPercentage: 15.0,
                    price: 0,
                    imageUrl: '',
                    videoUrl: ''
                });
            }
            setImageRemoved(false);
            setVideoRemoved(false);
            setActiveTab('general');
            setSearchQuery('');
            setSearchResults([]);
            const defaultWh = localStorage.getItem('erp_default_warehouse_id');
            const defaultWarehouseId = defaultWh ? parseInt(defaultWh) : null;
            // Reset stock adjustment
            setStockAdjustment({ warehouse_id: defaultWarehouseId, quantity: '', isPurchase: false, account_id: null, isMerma: false, merma_account_id: null });

            // Fetch Tags
            supabase.from('tags').select('*').order('order_index').then(({ data }) => {
                if (data) setAvailableTags(data);
            });

            // Fetch Product Tags
            if (productToEdit && productToEdit.id) {
                supabase.from('product_tags').select('tag_id').eq('product_id', productToEdit.id)
                    .then(({ data }) => {
                        if (data) setSelectedTags(data.map(d => d.tag_id));
                    });
            } else {
                setSelectedTags([]);
            }

            // Fetch Linked Products
            if (productToEdit && productToEdit.group_id) {
                supabase.from('products').select('id, sku, name, image_url, group_id')
                    .eq('group_id', productToEdit.group_id)
                    .neq('id', productToEdit.id)
                    .then(({ data }) => {
                        if (data) setLinkedProducts(data);
                    });
            } else {
                setLinkedProducts([]);
            }
        }
    }, [isOpen, productToEdit]);

    const fetchAccounts = async () => {
        try {
            const { data } = await supabase.from('accounts').select('*').order('name');
            if (data) setAccounts(data);
        } catch (error) {
            console.error('Error fetching accounts', error);
        }
    };

    // ─── Relationship Logic ───
    useEffect(() => {
        if (!searchQuery) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            const { data } = await supabase
                .from('products')
                .select('id, sku, name, image_url, group_id')
                .or(`sku.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
                .neq('id', productToEdit?.id || 0)
                .limit(5);
            if (data) setSearchResults(data);
            setIsSearching(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, productToEdit?.id]);

    const initiateLink = (prod: any) => {
        setProductToLink(prod);
        setShowConfirmModal(true);
    };

    const confirmLink = async () => {
        if (!productToLink || !productToEdit?.id) return;
        setLoading(true);
        try {
            let targetGroupId = productToEdit.group_id;
            if (!targetGroupId) {
                targetGroupId = productToLink.group_id || crypto.randomUUID();
                await supabase.from('products').update({ group_id: targetGroupId }).eq('id', productToEdit.id);
            }

            if (productToLink.group_id && productToLink.group_id !== targetGroupId) {
                await supabase.from('products').update({ group_id: targetGroupId }).eq('group_id', productToLink.group_id);
            } else if (!productToLink.group_id) {
                await supabase.from('products').update({ group_id: targetGroupId }).eq('id', productToLink.id);
            }

            const { data } = await supabase.from('products').select('id, sku, name, image_url, group_id')
                .eq('group_id', targetGroupId)
                .neq('id', productToEdit.id);
            if (data) setLinkedProducts(data);
            
            productToEdit.group_id = targetGroupId;
            
            setSearchQuery('');
            setShowConfirmModal(false);
            setProductToLink(null);
            onSuccess();
        } catch (error: any) {
            alert('Error al enlazar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUnlink = async (prodId: number) => {
        if (!window.confirm('¿Estás seguro que deseas desenlazar este repuesto específico?')) return;
        setLoading(true);
        try {
            await supabase.from('products').update({ group_id: null }).eq('id', prodId);
            setLinkedProducts(prev => prev.filter(p => p.id !== prodId));
            onSuccess();
        } catch (error: any) {
            alert('Error al desenlazar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Change handlers that keep everything in sync ───

    const handleCostChange = (newCost: number) => {
        if (entryByPrice) {
            // Cost changed while in Price Mode? Probably want to update Price
            const price = calcPrice(newCost, formData.vatPercentage, formData.profitMargin);
            setFormData(prev => ({ ...prev, costWithoutVat: newCost, price: Math.round(price * 100) / 100 }));
        } else {
            const price = calcPrice(newCost, formData.vatPercentage, formData.profitMargin);
            setFormData(prev => ({ ...prev, costWithoutVat: newCost, price: Math.round(price * 100) / 100 }));
        }
    };

    const handleCostWithVatChange = (newCostWithVat: number) => {
        const costWithoutVatValue = newCostWithVat / (1 + (formData.vatPercentage / 100));
        const price = calcPrice(costWithoutVatValue, formData.vatPercentage, formData.profitMargin);
        setFormData(prev => ({
            ...prev,
            costWithoutVat: r(costWithoutVatValue),
            price: Math.round(price * 100) / 100
        }));
    };

    const handleVatChange = (newVat: number) => {
        if (entryByPrice) {
            // Price is fixed, update Cost
            const costWithVatValue = formData.price / (1 + formData.profitMargin);
            const costWithoutVatValue = costWithVatValue / (1 + (newVat / 100));
            setFormData(prev => ({ ...prev, vatPercentage: newVat, costWithoutVat: r(costWithoutVatValue) }));
        } else {
            const price = calcPrice(formData.costWithoutVat, newVat, formData.profitMargin);
            setFormData(prev => ({ ...prev, vatPercentage: newVat, price: Math.round(price * 100) / 100 }));
        }
    };

    const handleMarginChange = (newMargin: number) => {
        if (entryByPrice) {
            // Price is fixed, update Cost
            const costWithVatValue = formData.price / (1 + newMargin);
            const costWithoutVatValue = costWithVatValue / (1 + (formData.vatPercentage / 100));
            setFormData(prev => ({ ...prev, profitMargin: newMargin, costWithoutVat: r(costWithoutVatValue) }));
        } else {
            const price = calcPrice(formData.costWithoutVat, formData.vatPercentage, newMargin);
            setFormData(prev => ({ ...prev, profitMargin: newMargin, price: Math.round(price * 100) / 100 }));
        }
    };

    const handlePriceChange = (newPrice: number) => {
        if (entryByPrice) {
            // Margin is fixed, update Cost
            const costWithVatValue = newPrice / (1 + formData.profitMargin);
            const costWithoutVatValue = costWithVatValue / (1 + (formData.vatPercentage / 100));
            setFormData(prev => ({ ...prev, price: newPrice, costWithoutVat: r(costWithoutVatValue) }));
        } else {
            // Cost is fixed, update Margin
            const margin = calcMargin(formData.costWithoutVat, formData.vatPercentage, newPrice);
            setFormData(prev => ({ ...prev, price: newPrice, profitMargin: Math.round(margin * 100) / 100 }));
        }
    };

    // ─── Computed display values ───
    const costoConIva = costWithVat(formData.costWithoutVat, formData.vatPercentage);
    const gananciaAbsoluta = r(formData.price - costoConIva);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product_images')
                .upload(filePath, file, {
                    cacheControl: '31536000',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('product_images').getPublicUrl(filePath);
            setFormData(prev => ({ ...prev, imageUrl: data.publicUrl }));
            setImageRemoved(false);
        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert('Error al subir imagen: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = () => {
        if (window.confirm('¿Estás seguro de que deseas eliminar permanentemente la foto central de este repuesto?')) {
            setFormData(prev => ({ ...prev, imageUrl: '' }));
            setImageRemoved(true);
        }
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        setIsVideoUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product_videos')
                .upload(filePath, file, {
                    cacheControl: '31536000',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('product_videos').getPublicUrl(filePath);
            setFormData(prev => ({ ...prev, videoUrl: data.publicUrl }));
            setVideoRemoved(false);
        } catch (error: any) {
            console.error('Error uploading video:', error);
            alert('Error al subir video: ' + error.message);
        } finally {
            setIsVideoUploading(false);
        }
    };

    const handleRemoveVideo = () => {
        if (window.confirm('¿Estás seguro de que deseas eliminar permanentemente el video demostrativo de este repuesto?')) {
            setFormData(prev => ({ ...prev, videoUrl: '' }));
            setVideoRemoved(true);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.brandId) {
            alert('Por favor seleccione una marca.');
            return;
        }

        setLoading(true);

        try {
            // Compute implied image URL based on SKU if not manually uploaded
            const defaultImageUrl = supabase.storage
                .from('product_images')
                .getPublicUrl('products/' + formData.sku + '_cut.webp').data.publicUrl;

            const payload: any = {
                sku: formData.sku,
                name: formData.name,
                brand_id: formData.brandId,
                min_stock_threshold: formData.minStock,
                profit_margin: formData.profitMargin,
                cost_without_vat: formData.costWithoutVat,
                vat_percentage: formData.vatPercentage,
                price: formData.price,
                image_url: imageRemoved ? null : (formData.imageUrl || defaultImageUrl),
                video_url: videoRemoved ? null : (formData.videoUrl || null)
            };

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                payload.last_edited_by = user.id;
                payload.last_edited_at = new Date().toISOString();
            }

            let productId = productToEdit?.id;

            if (productToEdit && productToEdit.id) {
                // Update existing
                const { error: updateError } = await supabase
                    .from('products')
                    .update(payload)
                    .eq('id', productToEdit.id);
                if (updateError) throw updateError;
            } else {
                // Insert new
                const { data: newProd, error: insertError } = await supabase
                    .from('products')
                    .insert([payload])
                    .select('id')
                    .single();
                if (insertError) throw insertError;
                productId = newProd.id;
            }

            // Sync Tags
            if (productId) {
                await supabase.from('product_tags').delete().eq('product_id', productId);
                if (selectedTags.length > 0) {
                    const tagInserts = selectedTags.map(tagId => ({ product_id: productId, tag_id: tagId }));
                    await supabase.from('product_tags').insert(tagInserts);
                }
            }

            // Handle Stock Adjustment
            const submittedQtyStr = stockAdjustment.quantity.toString().trim();
            const submittedQty = parseInt(submittedQtyStr);
            const isQtyValid = submittedQtyStr !== '' && !isNaN(submittedQty);

            if (isQtyValid && !stockAdjustment.warehouse_id) {
                throw new Error('Debe marcar obligatoriamente el Almacén/Sucursal si va a editar la cantidad de stock.');
            }

            const originalQty = currentStock !== null ? currentStock : 0;
            const qtyChange = isQtyValid ? submittedQty - originalQty : 0;

            if (qtyChange !== 0 && stockAdjustment.warehouse_id && productId) {
                if (qtyChange > 0 && stockAdjustment.isPurchase && !stockAdjustment.account_id) {
                    throw new Error('Debe seleccionar una cuenta de pago para registrar la compra.');
                }
                if (qtyChange < 0 && stockAdjustment.isMerma && !stockAdjustment.merma_account_id) {
                    throw new Error('Debe seleccionar una cuenta de gasto/pérdida para registrar la merma.');
                }

                const unit_cost_with_vat = costWithVat(formData.costWithoutVat, formData.vatPercentage);
                const { data: stockData, error: stockError } = await supabase.rpc('process_quick_stock_adjustment', {
                    p_warehouse_id: stockAdjustment.warehouse_id,
                    p_payment_account_id: (qtyChange > 0 && stockAdjustment.isPurchase) ? stockAdjustment.account_id : null,
                    p_merma_account_id: (qtyChange < 0 && stockAdjustment.isMerma) ? stockAdjustment.merma_account_id : null,
                    p_products: [{
                        product_id: productId,
                        quantity_change: qtyChange,
                        unit_cost_with_vat: unit_cost_with_vat
                    }]
                });

                if (stockError) throw stockError;
                if (!stockData.success) {
                    throw new Error('Error en ajuste de stock: ' + stockData.message);
                }
            }

            onSuccess();
            onClose();

        } catch (error: any) {
            console.error('Error saving product:', error);
            if (error.code === '23505' || (error.message && error.message.includes('duplicate key'))) {
                alert('Ocurrió un error: El código SKU "' + formData.sku + '" ya está siendo utilizado por otro producto. Por favor, asigne un SKU único.');
            } else {
                alert('Error al guardar producto: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 my-8">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                            <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {productToEdit ? 'Editar Producto' : 'Nuevo Producto'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {productToEdit && (
                    <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
                        <button
                            type="button"
                            onClick={() => setActiveTab('general')}
                            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            General
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('related')}
                            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'related' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Repuestos Relacionados
                            {linkedProducts.length > 0 && (
                                <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    {linkedProducts.length}
                                </span>
                            )}
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6">
                    <div className={activeTab === 'general' ? 'flex flex-col gap-5' : 'hidden'}>
                        {/* ═══ Image Upload ═══ */}
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative group">
                        {formData.imageUrl ? (
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                                <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={handleRemoveImage}
                                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 backdrop-blur-sm"
                                >
                                    <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-full min-h-[128px] cursor-pointer">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {isUploading ? (
                                        <span className="material-symbols-outlined text-[32px] text-primary animate-spin">progress_activity</span>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[32px] text-slate-400 mb-2 group-hover:text-primary transition-colors">add_photo_alternate</span>
                                            <p className="mb-1 text-sm text-slate-600 dark:text-slate-400 font-medium">Click para subir foto central</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">JPG, PNG o WEBP</p>
                                        </>
                                    )}
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                            </label>
                        )}
                    </div>

                    {/* ═══ Video Upload ═══ */}
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative group">
                        {formData.videoUrl ? (
                            <div className="relative w-full max-w-[200px] aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-black flex items-center justify-center">
                                <span className="material-symbols-outlined text-[32px] text-emerald-500">play_circle</span>
                                <button
                                    type="button"
                                    onClick={handleRemoveVideo}
                                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 backdrop-blur-sm z-10"
                                >
                                    <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                                </button>
                                <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-white bg-black/60 px-2 py-1 rounded backdrop-blur-sm truncate">
                                    Video Cargado Exitosamente
                                </div>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-full min-h-[128px] cursor-pointer">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {isVideoUploading ? (
                                        <span className="material-symbols-outlined text-[32px] text-emerald-500 animate-spin">progress_activity</span>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[32px] text-slate-400 mb-2 group-hover:text-emerald-500 transition-colors">movie</span>
                                            <p className="mb-1 text-sm text-slate-600 dark:text-slate-400 font-medium">Click para subir video demostrativo</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">MP4, WEBM o MOV (Max 50MB)</p>
                                        </>
                                    )}
                                </div>
                                <input type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} disabled={isVideoUploading} />
                            </label>
                        )}
                    </div>

                    {/* ═══ Core Fields ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1 md:col-span-2">
                            <label className={labelClass}>Nombre del Producto *</label>
                            <input required type="text" className={inputClass}
                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>

                        {/* Etiquetas */}
                        <div className="col-span-1 md:col-span-2">
                            <div className="flex justify-between items-end mb-1">
                                <label className={labelClass} style={{marginBottom: 0}}>Etiquetas</label>
                                <button type="button" onClick={() => setIsTagManagerOpen(true)} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                                    <span className="material-symbols-outlined text-[14px]">settings</span> Gestionar Etiquetas
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 p-2 border border-slate-300 dark:border-slate-700 rounded-lg min-h-[42px] bg-slate-50 dark:bg-slate-900">
                                {availableTags.map(tag => {
                                    const isSelected = selectedTags.includes(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onClick={() => {
                                                if (isSelected) setSelectedTags(prev => prev.filter(id => id !== tag.id));
                                                else setSelectedTags(prev => [...prev, tag.id]);
                                            }}
                                            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${isSelected ? 'shadow-sm' : 'opacity-50 hover:opacity-80 grayscale hover:grayscale-0'}`}
                                            style={{ 
                                                backgroundColor: isSelected ? tag.color + '30' : 'transparent', 
                                                color: isSelected ? tag.color : '#64748B', 
                                                border: `1px solid ${isSelected ? tag.color : '#cbd5e1'}` 
                                            }}
                                        >
                                            {tag.name}
                                        </button>
                                    );
                                })}
                                {availableTags.length === 0 && <span className="text-xs text-slate-400 my-auto ml-1">No hay etiquetas creadas. Usa "Gestionar Etiquetas" para crear una.</span>}
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>SKU *</label>
                            <input required type="text" className={`${inputClass} font-mono uppercase`}
                                value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <BrandSelect value={formData.brandId} onChange={(val) => setFormData({ ...formData, brandId: val })} required={true} />
                        </div>

                        <div>
                            <label className={labelClass}>Stock Mínimo</label>
                            <input type="number" min="0" className={inputClass}
                                value={formData.minStock} onChange={e => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>

                    {/* ═══ Financial Section — auto-linked ═══ */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-[18px]">payments</span>
                            Precios y Costos
                            <span className="text-xs font-normal normal-case text-slate-400 ml-1">— los campos se auto-calculan</span>
                            <div className="ml-auto flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase tracking-tight ${!entryByPrice ? 'text-primary' : 'text-slate-400'}`}>Por Costo</span>
                                <label className="flex items-center cursor-pointer relative group">
                                    <input type="checkbox" className="sr-only peer"
                                        checked={entryByPrice}
                                        onChange={(e) => setEntryByPrice(e.target.checked)}
                                    />
                                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                                <span className={`text-[10px] font-bold uppercase tracking-tight ${entryByPrice ? 'text-primary' : 'text-slate-400'}`}>Por Precio</span>
                            </div>
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Costo sin IVA ($)</label>
                                <input type="number" step="0.0001" min="0" className={`${inputClass} ${entryByPrice ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50' : ''}`}
                                    value={formData.costWithoutVat}
                                    onChange={e => handleCostChange(parseFloat(e.target.value) || 0)}
                                    readOnly={entryByPrice}
                                />
                                {entryByPrice && <p className="text-[10px] text-amber-600 mt-1 italic">Calculado desde el PVP</p>}
                            </div>

                            <div>
                                <label className={labelClass}>Costo con IVA ($)</label>
                                <input type="number" step="0.0001" min="0" className={`${inputClass} ${entryByPrice ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50' : ''}`}
                                    value={costoConIva === 0 ? 0 : Math.round(costoConIva * 10000) / 10000}
                                    onChange={e => handleCostWithVatChange(parseFloat(e.target.value) || 0)}
                                    readOnly={entryByPrice}
                                />
                                {entryByPrice && <p className="text-[10px] text-amber-600 mt-1 italic">Calculado desde el PVP</p>}
                            </div>

                            <div>
                                <label className={labelClass}>IVA (%)</label>
                                <input type="number" step="0.1" min="0" className={inputClass}
                                    value={formData.vatPercentage}
                                    onChange={e => handleVatChange(parseFloat(e.target.value) || 0)} />
                            </div>

                            <div>
                                <label className={labelClass}>Margen de Ganancia (decimal)</label>
                                <input type="number" step="0.01" className={inputClass}
                                    value={formData.profitMargin}
                                    onChange={e => handleMarginChange(parseFloat(e.target.value) || 0)} />
                                <p className="text-xs text-slate-400 mt-1">
                                    Ej: 0.65 = 65%. {entryByPrice ? 'Actualiza el costo automáticamente.' : 'Actualiza el PVP automáticamente.'}
                                </p>
                            </div>

                            <div>
                                <label className={labelClass}>PVP — Precio de Venta ($)</label>
                                <input type="number" step="0.01" min="0" className={`${inputClass} font-semibold ${!entryByPrice ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200/50' : 'ring-2 ring-primary border-primary'}`}
                                    value={formData.price}
                                    onChange={e => handlePriceChange(parseFloat(e.target.value) || 0)} />
                                <p className="text-xs text-slate-400 mt-1">
                                    {entryByPrice ? 'Ingresa el precio final; el costo se ajustará.' : 'Al cambiar, el margen se recalcula automáticamente.'}
                                </p>
                            </div>
                        </div>

                        {/* Live summary card */}
                        {formData.costWithoutVat > 0 && (
                            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg grid grid-cols-3 gap-4 text-center text-sm">
                                <div>
                                    <div className="text-slate-400 text-xs mb-0.5">Costo c/ IVA</div>
                                    <div className="font-bold text-slate-700 dark:text-slate-200">${costoConIva.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs mb-0.5">Margen</div>
                                    <div className={`font-bold ${formData.profitMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {(formData.profitMargin * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs mb-0.5">Ganancia</div>
                                    <div className={`font-bold ${gananciaAbsoluta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        ${gananciaAbsoluta.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ AJUSTE DE STOCK RÁPIDO ═══ */}
                        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-[18px]">inventory</span>
                                Ajuste de Stock Rápido
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <WarehouseSelect
                                        value={stockAdjustment.warehouse_id}
                                        onChange={(val) => {
                                            setStockAdjustment(prev => ({ ...prev, warehouse_id: val }));
                                            if (val) {
                                                localStorage.setItem('erp_default_warehouse_id', val.toString());
                                            } else {
                                                localStorage.removeItem('erp_default_warehouse_id');
                                            }
                                        }}
                                        label="Almacén:"
                                        required={stockAdjustment.quantity.toString().trim() !== ''}
                                    />
                                    <div className="mt-2 text-xs text-slate-500">
                                        Selecciona un almacén para modificar el stock de este producto al guardar.
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelClass}>
                                            Nuevo Stock Total:
                                        </label>
                                        <input
                                            type="number"
                                            className={inputClass}
                                            value={stockAdjustment.quantity}
                                            onChange={e => setStockAdjustment(prev => ({ ...prev, quantity: e.target.value }))}
                                            placeholder="Ej: 50"
                                        />
                                    </div>
                                    {/* Delta indicator and conditional toggles */}
                                    {stockAdjustment.warehouse_id && (() => {
                                        const qt = parseInt(stockAdjustment.quantity);
                                        if (isNaN(qt) || currentStock === null) return null;
                                        const diff = qt - currentStock;
                                        if (diff === 0) return <div className="mt-2 text-xs text-slate-500">El stock no cambiará.</div>;
                                        if (diff > 0) {
                                            return (
                                                <div className="mt-3 space-y-3">
                                                    <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                                        Se añadirán <strong>{diff}</strong> unidades al inventario.
                                                    </div>
                                                    <label className="flex items-center cursor-pointer relative group">
                                                        <input type="checkbox" className="sr-only peer"
                                                            checked={stockAdjustment.isPurchase}
                                                            onChange={(e) => setStockAdjustment(prev => ({ ...prev, isPurchase: e.target.checked }))}
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                                        <span className="ml-2 text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Registrar como compra financiera</span>
                                                    </label>
                                                    {stockAdjustment.isPurchase && (
                                                        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                                                            <label className={labelClass}>Cuenta de Pago:</label>
                                                            <select className={inputClass}
                                                                value={stockAdjustment.account_id || ''}
                                                                onChange={(e) => setStockAdjustment(prev => ({ ...prev, account_id: parseInt(e.target.value) }))}
                                                            >
                                                                <option value="">Seleccionar Cuenta...</option>
                                                                {accounts.map(acc => (
                                                                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name} ({acc.currency})</option>
                                                                ))}
                                                            </select>
                                                            {stockAdjustment.account_id && (
                                                                <div className="mt-2 text-xs font-semibold text-orange-700 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">info</span>
                                                                    Se debitarán ${(costoConIva * diff).toFixed(2)} de esta cuenta.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        } else {
                                            // diff < 0 — stock reduction
                                            return (
                                                <div className="mt-3 space-y-3">
                                                    <div className="flex items-center gap-2 p-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400">
                                                        <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                                                        Se restarán <strong>{Math.abs(diff)}</strong> unidades del inventario.
                                                    </div>
                                                    <label className="flex items-center cursor-pointer relative group">
                                                        <input type="checkbox" className="sr-only peer"
                                                            checked={stockAdjustment.isMerma}
                                                            onChange={(e) => setStockAdjustment(prev => ({ ...prev, isMerma: e.target.checked }))}
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                                                        <span className="ml-2 text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Registrar como merma (pérdida contable)</span>
                                                    </label>
                                                    {stockAdjustment.isMerma && (
                                                        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-lg p-3">
                                                            <label className={labelClass}>Cuenta de Gasto / Pérdida:</label>
                                                            <select className={inputClass}
                                                                value={stockAdjustment.merma_account_id || ''}
                                                                onChange={(e) => setStockAdjustment(prev => ({ ...prev, merma_account_id: parseInt(e.target.value) }))}
                                                            >
                                                                <option value="">Seleccionar Cuenta...</option>
                                                                {accounts.map(acc => (
                                                                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name} ({acc.currency})</option>
                                                                ))}
                                                            </select>
                                                            {stockAdjustment.merma_account_id && (
                                                                <div className="mt-2 text-xs font-semibold text-rose-700 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">info</span>
                                                                    Se registrará una pérdida de ${(costoConIva * Math.abs(diff)).toFixed(2)} en contabilidad.
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                    </div> {/* End of General Tab */}

                    {/* ═══ Related Parts Tab ═══ */}
                    {productToEdit && (
                        <div className={activeTab === 'related' ? 'flex flex-col gap-5' : 'hidden'}>
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-lg text-sm flex items-start gap-2 border border-blue-200 dark:border-blue-800/30">
                                <span className="material-symbols-outlined text-[18px] mt-0.5">info</span>
                                <div>
                                    Enlaza repuestos que son exactamente el mismo pero en otra marca. Al enlazar, se crea un grupo y todos los miembros quedan enlazados bidireccionalmente de forma automática. Se reflejará automáticamente en todas las selecciones.
                                </div>
                            </div>

                            <div className="relative">
                                <label className={labelClass}>Buscar repuesto para enlazar (Código o Nombre)</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input 
                                        type="text" 
                                        className={`${inputClass} pl-10`} 
                                        placeholder="Escribe para buscar..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                    {isSearching && <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin text-[18px]">progress_activity</span>}
                                </div>
                                {searchResults.length > 0 && searchQuery && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                                        {searchResults.map(res => (
                                            <div key={res.id} className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                                                        {res.image_url ? (
                                                            <img src={res.image_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-slate-400">image</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{res.sku}</div>
                                                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{res.name}</div>
                                                    </div>
                                                </div>
                                                {linkedProducts.some(p => p.id === res.id) || (productToEdit.group_id && res.group_id === productToEdit.group_id) ? (
                                                    <span className="text-xs font-semibold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">Ya enlazado</span>
                                                ) : (
                                                    <button type="button" onClick={() => initiateLink(res)} className="px-3 py-1 bg-primary text-white text-xs font-medium rounded hover:bg-primary/90 transition-colors">
                                                        Enlazar
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">link</span>
                                    Repuestos Enlazados ({linkedProducts.length})
                                </h4>
                                {linkedProducts.length === 0 ? (
                                    <div className="text-center p-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 text-sm flex flex-col items-center">
                                        <span className="material-symbols-outlined text-[32px] text-slate-300 mb-2">link_off</span>
                                        No hay repuestos relacionados actualmente.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {linkedProducts.map(lp => (
                                            <div key={lp.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg group hover:border-slate-300 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 bg-white flex items-center justify-center shadow-sm">
                                                        {lp.image_url ? (
                                                            <img src={lp.image_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-slate-400">image</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                            {lp.sku}
                                                            {lp.group_id && (
                                                                <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-medium border border-emerald-200/50">
                                                                    Grupo: {lp.group_id.split('-')[0]}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500 truncate max-w-[250px]">{lp.name}</div>
                                                    </div>
                                                </div>
                                                <button type="button" onClick={() => handleUnlink(lp.id)} title="Desenlazar este repuesto de su grupo" className="w-8 h-8 flex items-center justify-center rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-200 hover:text-rose-500 text-slate-400 transition-all opacity-70 group-hover:opacity-100">
                                                    <span className="material-symbols-outlined text-[16px]">link_off</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ Actions ═══ */}
                    <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center w-full">
                            {productToEdit?.last_edited_at ? (
                                <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">
                                    <span className="material-symbols-outlined text-[14px]">history</span>
                                    <span>
                                        Última modificación por <strong>{productToEdit.profiles?.full_name || 'Desconocido'}</strong> el {new Date(productToEdit.last_edited_at).toLocaleDateString()} a las {new Date(productToEdit.last_edited_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            ) : (
                                <div></div>
                            )}
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={onClose}
                                    className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={loading}
                                    className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm shadow-primary/30 transition-all font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                                    {loading ? 'Guardando...' : 'Guardar Producto'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            
            {isTagManagerOpen && (
                <TagManager onClose={() => { 
                    setIsTagManagerOpen(false); 
                    supabase.from('tags').select('*').order('order_index').then(({ data }) => {
                        if (data) setAvailableTags(data);
                    });
                }} />
            )}

            {showConfirmModal && productToLink && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 bg-blue-50/50 dark:bg-blue-900/10">
                            <span className="material-symbols-outlined text-blue-500 text-[24px]">info</span>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirmar Enlace</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-700 dark:text-slate-300 mb-3 text-sm font-medium">
                                ¿Estás seguro que quieres enlazar estos productos?
                            </p>
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs mb-4">
                                <strong>Nota:</strong> Esto hará que todos los repuestos del grupo también se enlacen de manera directa formando un único grupo relacional.
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg mb-6 shadow-sm">
                                <div className="w-12 h-12 rounded border border-slate-200 bg-white overflow-hidden shrink-0">
                                    {productToLink.image_url ? <img src={productToLink.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><span className="material-symbols-outlined text-slate-400">image</span></div>}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-900">{productToLink.sku}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[250px]">{productToLink.name}</div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowConfirmModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button type="button" onClick={confirmLink} disabled={loading} className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow transition-colors flex items-center gap-2">
                                    {loading ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> : null}
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
