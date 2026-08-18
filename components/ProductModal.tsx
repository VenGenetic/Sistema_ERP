import React, { useState, useEffect } from 'react';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { supabase } from '../supabaseClient';
import { compressImageForUpload } from '../utils/imageCompression';
import { BrandSelect } from './BrandSelect';
import { WarehouseSelect } from './WarehouseSelect';
import { TagManager, Tag } from './TagManager';
import {
  Banknote,
  Boxes,
  CircleMinus,
  CirclePlay,
  CirclePlus,
  ClipboardPaste,
  Download,
  History,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Link2Off,
  Link as LinkIcon,
  Loader2,
  Package,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
    ImporterUnavailableDuration,
    computeImporterUnavailableUntil,
    durationFromUntil,
    getStockAvailableDemandCount,
    warnRevertedDemands,
} from '../utils/importerOverride';

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
        gallery?: any[] | null;
        group_id?: string | null;
        last_edited_at?: string | null;
        is_discontinued?: boolean;
        discontinued_until?: string | null;
        importer_unavailable_override?: boolean;
        importer_unavailable_until?: string | null;
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
    const [isDraggingMain, setIsDraggingMain] = useState(false);
    const [isDraggingGallery, setIsDraggingGallery] = useState(false);
    const [entryByPrice, setEntryByPrice] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'general' | 'related'>('general');
    
    // Repuestos relacionados state
    const [linkedProducts, setLinkedProducts] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchProducts, setSearchProducts] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [productToLink, setProductToLink] = useState<any>(null);
    const [productsToMerge, setProductsToMerge] = useState<any[]>([]);
    const [pendingUnlinks, setPendingUnlinks] = useState<Set<number>>(new Set());

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
        isDiscontinued: false,
        discontinuedDuration: 'permanente', // 'permanente', '3', '6', '12'
        importerUnavailable: false,
        importerUnavailableDuration: 'permanente' as ImporterUnavailableDuration
    });
    const [imageRemoved, setImageRemoved] = useState(false);
    const [gallery, setGallery] = useState<{url: string, type: 'image' | 'video'}[]>([]);

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
                    isDiscontinued: !!productToEdit.is_discontinued,
                    discontinuedDuration: productToEdit.discontinued_until
                        ? (function() {
                            const diffMonths = Math.round((new Date(productToEdit.discontinued_until).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30));
                            if (diffMonths <= 4) return '3';
                            if (diffMonths <= 7) return '6';
                            return '12';
                        })()
                        : 'permanente',
                    importerUnavailable: !!productToEdit.importer_unavailable_override,
                    importerUnavailableDuration: durationFromUntil(productToEdit.importer_unavailable_until)
                });
                setGallery(productToEdit.gallery || []);
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
                    isDiscontinued: false,
                    discontinuedDuration: 'permanente',
                    importerUnavailable: false,
                    importerUnavailableDuration: 'permanente'
                });
                setGallery([]);
            }
            setImageRemoved(false);
            setActiveTab('general');
            setSearchQuery('');
            setSearchProducts([]);
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
                supabase.from('products').select('id, sku, name, image_url, group_id, local_stock, importer_stock')
                    .eq('group_id', productToEdit.group_id)
                    .neq('id', productToEdit.id)
                    .then(({ data }) => {
                        if (data) setLinkedProducts(data);
                    });
            } else {
                setLinkedProducts([]);
            }
            setPendingUnlinks(new Set());
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

    // Fetch Products for the search table (filter on type)
    useEffect(() => {
        if (activeTab !== 'related' || !isOpen) return;

        const fetchProducts = async () => {
            setIsSearching(true);
            try {
                let query = supabase
                    .from('products')
                    .select('id, sku, name, image_url, group_id, local_stock, importer_stock')
                    .neq('id', productToEdit?.id || 0)
                    .eq('is_active', true)
                    .limit(10);
                
                if (searchQuery.trim() !== '') {
                    query = query.or(`sku.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
                }
                
                const { data } = await query;
                if (data) {
                    setSearchProducts(data);
                }
            } catch (error) {
                console.error('Error fetching search products:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, activeTab, productToEdit?.id, isOpen]);

    const initiateLink = async (prod: any) => {
        setLoading(true);
        try {
            if (prod.group_id) {
                // Fetch all products in the target group
                const { data } = await supabase
                    .from('products')
                    .select('id, sku, name, image_url, group_id, local_stock, importer_stock')
                    .eq('group_id', prod.group_id);
                
                if (data && data.length > 0) {
                    setProductsToMerge(data);
                } else {
                    setProductsToMerge([prod]);
                }
            } else {
                setProductsToMerge([prod]);
            }
            setProductToLink(prod);
            setShowConfirmModal(true);
        } catch (error) {
            console.error('Error fetching group members:', error);
        } finally {
            setLoading(false);
        }
    };

    const confirmLink = () => {
        if (!productToLink) return;
        
        // Add all products to merge to linkedProducts
        setLinkedProducts(prev => {
            const next = [...prev];
            productsToMerge.forEach(pm => {
                if (!next.some(p => p.id === pm.id)) {
                    next.push(pm);
                }
            });
            return next;
        });

        // Remove from pending unlinks if they were there
        setPendingUnlinks(prev => {
            const next = new Set(prev);
            productsToMerge.forEach(pm => next.delete(pm.id));
            return next;
        });

        setShowConfirmModal(false);
        setProductToLink(null);
        setProductsToMerge([]);
    };

    const handleUnlink = (prodId: number) => {
        if (!window.confirm('¿Estás seguro que deseas desenlazar este repuesto específico?')) return;
        setLinkedProducts(prev => prev.filter(p => p.id !== prodId));
        setPendingUnlinks(prev => {
            const next = new Set(prev);
            next.add(prodId);
            return next;
        });
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
    const precioSinIva = formData.price / (1 + (formData.vatPercentage / 100));
    const gananciaAbsoluta = r(precioSinIva - formData.costWithoutVat);

    const uploadMainImageFile = async (file: File) => {
        setIsUploading(true);
        try {
            const upload = await compressImageForUpload(file);
            const fileExt = upload.name ? (upload.name.split('.').pop() || 'png') : 'png';
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product_images')
                .upload(filePath, upload, {
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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        uploadMainImageFile(e.target.files[0]);
    };

    const handleRemoveImage = () => {
        if (window.confirm('¿Estás seguro de que deseas eliminar permanentemente la foto central de este repuesto?')) {
            setFormData(prev => ({ ...prev, imageUrl: '' }));
            setImageRemoved(true);
        }
    };

    const uploadGalleryFile = async (file: File) => {
        const isVideo = file.type.startsWith('video/');
        setIsVideoUploading(true);
        try {
            // compressImageForUpload deja pasar los videos sin tocarlos.
            const upload = await compressImageForUpload(file);
            const fileExt = upload.name ? (upload.name.split('.').pop() || (isVideo ? 'mp4' : 'png')) : (isVideo ? 'mp4' : 'png');
            const fileName = `${formData.sku || 'NUEVO'}_gallery_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const bucket = isVideo ? 'product_videos' : 'product_images';
            const filePath = isVideo ? fileName : `products/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, upload, {
                    cacheControl: '31536000',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
            
            setGallery(prev => {
                if (prev.length >= 15) return prev;
                return [...prev, { url: data.publicUrl, type: isVideo ? 'video' : 'image' }];
            });
        } catch (error: any) {
            console.error('Error uploading to gallery:', error);
            alert('Error al subir a galería: ' + error.message);
        } finally {
            setIsVideoUploading(false);
        }
    };

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        const files = Array.from(e.target.files);
        const cantidad_anterior = gallery.length;
        const cantidad_añadida = files.length;
        const limite = 15;

        if (cantidad_anterior + cantidad_añadida > limite) {
            const permitidas = limite - cantidad_anterior;
            alert(`Error: solo puedes añadir ${permitidas} imágenes, elimina imágenes para añadir las que quieres. Cada producto tiene un max de 15 imágenes.`);
            e.target.value = '';
            return;
        }

        for (const file of files) {
            await uploadGalleryFile(file);
        }
        
        e.target.value = '';
    };

    // ─── Global Paste Handler ───
    useEffect(() => {
        const handleGlobalPaste = async (e: ClipboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        e.preventDefault();
                        if (!formData.imageUrl) {
                            await uploadMainImageFile(file);
                        } else if (gallery.length < 15) {
                            await uploadGalleryFile(file);
                        } else {
                            alert('La galería está llena y la imagen principal ya está asignada.');
                        }
                        return;
                    }
                }
            }
        };

        if (isOpen) {
            window.addEventListener('paste', handleGlobalPaste);
        }
        return () => {
            window.removeEventListener('paste', handleGlobalPaste);
        };
    }, [isOpen, formData.imageUrl, gallery.length]);

    const handlePasteClick = async (target: 'main' | 'gallery') => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                const imageType = item.types.find(t => t.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], `pasted_${Date.now()}.png`, { type: imageType });
                    if (target === 'main') {
                        await uploadMainImageFile(file);
                    } else {
                        await uploadGalleryFile(file);
                    }
                    return;
                }
            }
            alert("No se detectaron imágenes válidas en tu portapapeles.");
        } catch (error) {
            console.error('Clipboard API error:', error);
            alert("Error accediendo al portapapeles. Asegúrate de conceder permisos al navegador o presiona Ctrl+V manualmente.");
        }
    };

    const handleRemoveGalleryItem = (index: number) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este elemento de la galería?')) {
            setGallery(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleSetAsMainImage = (index: number) => {
        const item = gallery[index];
        if (item.type === 'video') {
            alert('Un video no puede ser asignado como miniatura principal.');
            return;
        }
        
        // Swap
        const currentMain = formData.imageUrl;
        setFormData(prev => ({ ...prev, imageUrl: item.url }));
        setImageRemoved(false);
        
        setGallery(prev => {
            const newGallery = [...prev];
            newGallery.splice(index, 1);
            if (currentMain && !currentMain.includes('_cut.webp')) {
                // If it wasn't the default implied image, push it back to the gallery
                newGallery.push({ url: currentMain, type: 'image' });
            }
            return newGallery;
        });
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

            let discontinued_until: string | null = null;
            if (formData.isDiscontinued && formData.discontinuedDuration !== 'permanente') {
                const months = parseInt(formData.discontinuedDuration);
                const d = new Date();
                d.setMonth(d.getMonth() + months);
                discontinued_until = d.toISOString();
            }

            const importer_unavailable_until = formData.importerUnavailable
                ? computeImporterUnavailableUntil(formData.importerUnavailableDuration)
                : null;

            // Snapshot before saving: the DB trigger reverts any 'stock_available'
            // demand back to 'pending_stock' the moment the override is turned on,
            // so we must count them beforehand to warn staff afterward.
            const isTurningOverrideOn = !productToEdit?.importer_unavailable_override && formData.importerUnavailable;
            const pendingRevertCount = (isTurningOverrideOn && productToEdit?.id)
                ? await getStockAvailableDemandCount(productToEdit.id)
                : 0;

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
                gallery: gallery,
                is_discontinued: formData.isDiscontinued,
                discontinued_until: formData.isDiscontinued ? discontinued_until : null,
                importer_unavailable_override: formData.importerUnavailable,
                importer_unavailable_until: importer_unavailable_until
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

            // Sync Product Grouping
            if (productId) {
                let targetGroupId = productToEdit?.group_id || null;

                if (linkedProducts.length > 0) {
                    if (!targetGroupId) {
                        const firstWithGroupId = linkedProducts.find(p => p.group_id);
                        targetGroupId = firstWithGroupId ? firstWithGroupId.group_id : crypto.randomUUID();
                    }
                    
                    // Update targetGroupId on current product
                    const { error: groupUpdateError } = await supabase
                        .from('products')
                        .update({ group_id: targetGroupId })
                        .eq('id', productId);
                    if (groupUpdateError) throw groupUpdateError;

                    // Set group_id for all currently linked products
                    const linkedIds = linkedProducts.map(p => p.id);
                    const { error: linksUpdateError } = await supabase
                        .from('products')
                        .update({ group_id: targetGroupId })
                        .in('id', linkedIds);
                    if (linksUpdateError) throw linksUpdateError;
                } else {
                    if (productToEdit?.group_id) {
                        const { error: clearGroupError } = await supabase
                            .from('products')
                            .update({ group_id: null })
                            .eq('id', productId);
                        if (clearGroupError) throw clearGroupError;
                    }
                }

                // Process unlinked products
                if (pendingUnlinks.size > 0) {
                    const unlinkedIds = Array.from(pendingUnlinks);
                    const { error: unlinkError } = await supabase
                        .from('products')
                        .update({ group_id: null })
                        .in('id', unlinkedIds);
                    if (unlinkError) throw unlinkError;
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

            if (!productToEdit?.is_discontinued && formData.isDiscontinued && productId) {
                // Update active product_demands
                const { data: updatedDemands } = await supabase
                    .from('product_demands')
                    .update({ status: 'discontinued' })
                    .eq('product_id', productId)
                    .in('status', ['pending_stock', 'stock_available'])
                    .select('id');
                
                // Update active customer_requests (reservations)
                const { data: updatedRequests } = await supabase
                    .from('customer_requests')
                    .update({ status: 'discontinued' })
                    .eq('product_id', productId)
                    .eq('status', 'pending')
                    .select('id');
                
                const totalUpdated = (updatedDemands?.length || 0) + (updatedRequests?.length || 0);
                if (totalUpdated > 0) {
                    alert(`Se han actualizado ${totalUpdated} solicitudes al estado 'Descontinuado'. Recuerda notificar a los clientes correspondientes.`);
                }
            }

            warnRevertedDemands(pendingRevertCount);

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

    // El «atrás» del teléfono cierra este modal en vez de dejar la pantalla.
    useBackDismiss(isOpen, onClose);

    if (!isOpen) return null;

    const inputClass = "w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

    /*
        Anclado abajo en el teléfono (MASTER.md: las ventanas entran por
        abajo, al alcance del pulgar) y centrado a partir de `sm`, que es
        el escritorio. La versión grande no cambia.
    */
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
            <div className="bg-surface rounded-t-2xl sm:rounded-xl shadow-lg w-full max-w-2xl overflow-hidden border border-subtle mt-auto sm:my-8 max-h-[92dvh] sm:max-h-none overflow-y-auto">
                {/* Header */}
                <div className="p-5 border-b border-subtle flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-soft text-primary-soft-fg rounded-lg">
                            <Package size={24} aria-hidden="true" />
                        </div>
                        <h2 className="text-xl font-bold text-fg">
                            {productToEdit ? 'Editar Producto' : 'Nuevo Producto'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                {productToEdit && (
                    <div className="flex border-b border-subtle px-6">
                        <button
                            type="button"
                            onClick={() => setActiveTab('general')}
                            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            General
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('related')}
                            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'related' ? 'border-primary text-primary' : 'border-transparent text-fg-muted hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Repuestos Relacionados
                            {linkedProducts.length > 0 && (
                                <span className="bg-primary/10 text-primary text-2xs px-1.5 py-0.5 rounded-full font-bold">
                                    {linkedProducts.length}
                                </span>
                            )}
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6">
                    <div className={activeTab === 'general' ? 'flex flex-col gap-5' : 'hidden'}>
                        {/* ═══ Image Upload ═══ */}
                    <div 
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingMain(true); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingMain(false); }}
                        onDrop={async (e) => {
                            e.preventDefault(); e.stopPropagation(); setIsDraggingMain(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                const file = e.dataTransfer.files[0];
                                if (file.type.startsWith('image/')) {
                                    await uploadMainImageFile(file);
                                } else {
                                    alert('Solo se admiten archivos de imagen para la foto central.');
                                }
                            }
                        }}
                        onPaste={async (e) => {
                            const items = e.clipboardData.items;
                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf('image') !== -1) {
                                    const file = items[i].getAsFile();
                                    if (file) {
                                        e.preventDefault(); e.stopPropagation();
                                        await uploadMainImageFile(file);
                                        return;
                                    }
                                }
                            }
                        }}
                        tabIndex={0}
                        className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl transition-all duration-200 relative group focus:outline-none focus:ring-2 focus:ring-primary/50 ${ isDraggingMain ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-slate-200 dark:border-slate-700 bg-surface-2 hover:bg-surface-hover dark:hover:bg-slate-800' }`}
                    >
                        {formData.imageUrl ? (
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-subtle shadow-sm pointer-events-none">
                                <img src={formData.imageUrl} alt="Product" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger backdrop-blur-sm pointer-events-auto"
                                >
                                    <X size={16} className="leading-none" aria-hidden="true" />
                                </button>
                                {isDraggingMain && (
                                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                                        <span className="text-white font-bold drop-shadow-md text-sm text-center">Reemplazar Imagen</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full h-full min-h-[128px]">
                                <div className="flex flex-col items-center justify-center pt-2 pb-4 text-center">
                                    {isUploading ? (
                                        <Loader2 size={32} className="text-primary animate-spin" aria-hidden="true" />
                                    ) : (
                                        <>
                                            {isDraggingMain ? <Download size={32} className="text-fg-subtle mb-2 group-hover:text-primary transition-colors" aria-hidden="true" /> : <ImagePlus size={32} className="text-fg-subtle mb-2 group-hover:text-primary transition-colors" aria-hidden="true" />}
                                            <p className="mb-3 text-sm text-fg-muted font-medium">
                                                {isDraggingMain ? 'Suelta la imagen aquí' : 'Selecciona una opción para subir'}
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePasteClick('main'); }}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-fg bg-white border border-strong rounded hover:bg-surface-hover dark:bg-slate-800 shadow-sm transition-colors z-10 relative"
                                                >
                                                    <ClipboardPaste size={14} aria-hidden="true" /> Pegar
                                                </button>
                                                
                                                <label className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded hover:bg-primary/90 shadow-sm transition-colors cursor-pointer z-10 relative">
                                                    <Search size={14} aria-hidden="true" /> Examinar
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                                                </label>
                                            </div>
                                            <p className="text-xs text-fg-subtle mt-3">O arrastra el archivo aquí</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ═══ Gallery Section ═══ */}
                    <div 
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingGallery(true); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingGallery(false); }}
                        onDrop={async (e) => {
                            e.preventDefault(); e.stopPropagation(); setIsDraggingGallery(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                const files = Array.from(e.dataTransfer.files);
                                const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
                                
                                const cantidad_anterior = gallery.length;
                                const cantidad_añadida = validFiles.length;
                                const limite = 15;

                                if (cantidad_anterior + cantidad_añadida > limite) {
                                    const permitidas = limite - cantidad_anterior;
                                    alert(`Error: solo puedes añadir ${permitidas} imágenes, elimina imágenes para añadir las que quieres. Cada producto tiene un max de 15 imágenes.`);
                                    return;
                                }

                                for (const file of validFiles) {
                                    await uploadGalleryFile(file);
                                }
                                
                                if (validFiles.length < files.length) {
                                    alert(`Algunos archivos no eran imágenes o videos y fueron ignorados.`);
                                }
                            }
                        }}
                        onPaste={async (e) => {
                            const items = e.clipboardData.items;
                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('video') !== -1) {
                                    const file = items[i].getAsFile();
                                    if (file) {
                                        e.preventDefault(); e.stopPropagation();
                                        await uploadGalleryFile(file);
                                    }
                                }
                            }
                        }}
                        tabIndex={0}
                        className={`flex flex-col gap-2 p-3 -m-3 rounded-xl border-2 transition-all duration-200 relative focus:outline-none focus:ring-2 focus:ring-primary/50 ${ isDraggingGallery ? 'border-primary bg-primary/5 dark:bg-primary/10 border-dashed' : 'border-transparent' }`}
                    >
                        <label className={labelClass}>Galería (Max 15) - {gallery.length}/15</label>
                        <div className="flex flex-wrap gap-3 relative z-10">
                            {gallery.map((item, index) => (
                                <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border border-subtle shadow-sm group bg-black flex items-center justify-center">
                                    {item.type === 'video' ? (
                                        <>
                                            <CirclePlay size={32} className="text-success absolute z-0" aria-hidden="true" />
                                            <div className="absolute inset-0 bg-black/40"></div>
                                        </>
                                    ) : (
                                        <img src={item.url} alt="Gallery item" className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-sm z-10">
                                        {item.type !== 'video' && (
                                            <button type="button" onClick={() => handleSetAsMainImage(index)} title="Hacer principal" className="text-white hover:text-primary transition-colors">
                                                <Star size={18} aria-hidden="true" />
                                            </button>
                                        )}
                                        <button type="button" onClick={() => handleRemoveGalleryItem(index)} title="Eliminar" className="text-white hover:text-danger transition-colors">
                                            <Trash2 size={18} aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {gallery.length < 15 && (
                                <div className="flex flex-col gap-2">
                                    <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-strong rounded-lg cursor-pointer hover:bg-surface-hover transition-colors">
                                        {isVideoUploading ? (
                                            <Loader2 size={24} className="text-primary animate-spin" aria-hidden="true" />
                                        ) : (
                                            <Plus size={24} className="text-fg-subtle" aria-hidden="true" />
                                        )}
                                        <input type="file" className="hidden" accept="image/*,video/*" onChange={handleGalleryUpload} disabled={isVideoUploading} multiple />
                                    </label>
                                    {!isVideoUploading && (
                                        <button 
                                            type="button" 
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePasteClick('gallery'); }}
                                            className="text-2xs text-fg-muted hover:text-primary flex items-center justify-center gap-1 w-full bg-surface-3 rounded py-1"
                                        >
                                            <ClipboardPaste size={12} aria-hidden="true" /> Pegar
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
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
                                    <Settings size={14} aria-hidden="true" /> Gestionar Etiquetas
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 p-2 border border-strong rounded-lg min-h-[42px] bg-surface-2">
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
                                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${isSelected ? 'shadow-sm' : 'opacity-50 hover:opacity-80 grayscale hover:grayscale-0'}`}
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
                                {availableTags.length === 0 && <span className="text-xs text-fg-subtle my-auto ml-1">No hay etiquetas creadas. Usa "Gestionar Etiquetas" para crear una.</span>}
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
                    <div className="border-t border-subtle pt-4">
                        <h3 className="text-sm font-semibold text-fg-muted flex items-center gap-2 mb-4">
                            <Banknote size={18} aria-hidden="true" />
                            Precios y Costos
                            <span className="text-xs font-normal normal-case text-fg-subtle ml-1">— los campos se auto-calculan</span>
                            <div className="ml-auto flex items-center gap-2">
                                <span className={`text-2xs font-bold uppercase tracking-tight ${!entryByPrice ? 'text-primary' : 'text-slate-400'}`}>Por Costo</span>
                                <label className="flex items-center cursor-pointer relative group">
                                    <input type="checkbox" className="sr-only peer"
                                        checked={entryByPrice}
                                        onChange={(e) => setEntryByPrice(e.target.checked)}
                                    />
                                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                                <span className={`text-2xs font-bold uppercase tracking-tight ${entryByPrice ? 'text-primary' : 'text-slate-400'}`}>Por Precio</span>
                            </div>
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Costo sin IVA ($)</label>
                                <input type="number" step="0.0001" min="0" className={`${inputClass} ${entryByPrice ? 'bg-warning-soft/50 border-warning/20/50' : ''}`}
                                    value={formData.costWithoutVat}
                                    onChange={e => handleCostChange(parseFloat(e.target.value) || 0)}
                                    readOnly={entryByPrice}
                                />
                                {entryByPrice && <p className="text-2xs text-warning mt-1 italic">Calculado desde el PVP</p>}
                            </div>

                            <div>
                                <label className={labelClass}>Costo con IVA ($)</label>
                                <input type="number" step="0.0001" min="0" className={`${inputClass} ${entryByPrice ? 'bg-warning-soft/50 border-warning/20/50' : ''}`}
                                    value={costoConIva === 0 ? 0 : Math.round(costoConIva * 10000) / 10000}
                                    onChange={e => handleCostWithVatChange(parseFloat(e.target.value) || 0)}
                                    readOnly={entryByPrice}
                                />
                                {entryByPrice && <p className="text-2xs text-warning mt-1 italic">Calculado desde el PVP</p>}
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
                                <p className="text-xs text-fg-subtle mt-1">
                                    Ej: 0.65 = 65%. {entryByPrice ? 'Actualiza el costo automáticamente.' : 'Actualiza el PVP automáticamente.'}
                                </p>
                            </div>

                            <div>
                                <label className={labelClass}>PVP — Precio de Venta ($)</label>
                                <input type="number" step="0.01" min="0" className={`${inputClass} font-semibold ${!entryByPrice ? 'bg-success-soft/30 border-success/20/50' : 'ring-2 ring-primary border-primary'}`}
                                    value={formData.price}
                                    onChange={e => handlePriceChange(parseFloat(e.target.value) || 0)} />
                                <p className="text-xs text-fg-subtle mt-1">
                                    {entryByPrice ? 'Ingresa el precio final; el costo se ajustará.' : 'Al cambiar, el margen se recalcula automáticamente.'}
                                </p>
                            </div>
                        </div>

                        {/* Live summary card */}
                        {formData.costWithoutVat > 0 && (
                            <div className="mt-4 p-3 bg-surface-2 rounded-lg grid grid-cols-3 gap-4 text-center text-sm">
                                <div>
                                    <div className="text-fg-subtle text-xs mb-0.5">Costo c/ IVA</div>
                                    <div className="font-bold text-fg">${costoConIva.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-fg-subtle text-xs mb-0.5">Margen</div>
                                    <div className={`font-bold ${formData.profitMargin >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {(formData.profitMargin * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-fg-subtle text-xs mb-0.5">Ganancia</div>
                                    <div className={`font-bold ${gananciaAbsoluta >= 0 ? 'text-success' : 'text-danger'}`}>
                                        ${gananciaAbsoluta.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ DESCONTINUADOS ═══ */}
                        <div className="mt-6 pt-4 border-t border-subtle">
                            <h3 className="text-sm font-semibold text-fg-muted flex items-center gap-2 mb-4">
                                <TriangleAlert size={18} aria-hidden="true" />
                                Estado de Continuidad
                            </h3>
                            <div className="flex flex-col gap-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only" 
                                            checked={formData.isDiscontinued} 
                                            onChange={(e) => setFormData({ ...formData, isDiscontinued: e.target.checked })} 
                                        />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${formData.isDiscontinued ? 'bg-danger' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.isDiscontinued ? 'transform translate-x-6' : ''}`}></div>
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-fg block">Marcar como Descontinuado</span>
                                        <span className="text-xs text-fg-muted">Evita que el producto siga apareciendo como disponible para nuevas listas de espera.</span>
                                    </div>
                                </label>

                                {formData.isDiscontinued && (
                                    <div className="pl-14">
                                        <label className={labelClass}>Duración de la descontinuación</label>
                                        <select
                                            className={inputClass}
                                            value={formData.discontinuedDuration}
                                            onChange={(e) => setFormData({ ...formData, discontinuedDuration: e.target.value })}
                                        >
                                            <option value="permanente">Permanente (Nunca volverá)</option>
                                            <option value="3">Temporal: 3 Meses</option>
                                            <option value="6">Temporal: 6 Meses</option>
                                            <option value="12">Temporal: 1 Año</option>
                                        </select>
                                    </div>
                                )}

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only"
                                            checked={formData.importerUnavailable}
                                            onChange={(e) => setFormData({ ...formData, importerUnavailable: e.target.checked })}
                                        />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${formData.importerUnavailable ? 'bg-warning' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.importerUnavailable ? 'transform translate-x-6' : ''}`}></div>
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-fg block">Marcar como Agotado en Importadora</span>
                                        <span className="text-xs text-fg-muted">Úsalo cuando el sitio de la importadora diga que hay stock pero en realidad no lo tienen. El sistema tratará el stock de importadora como 0 mientras esté activo.</span>
                                    </div>
                                </label>

                                {formData.importerUnavailable && (
                                    <div className="pl-14">
                                        <label className={labelClass}>Duración del marcado</label>
                                        <select
                                            className={inputClass}
                                            value={formData.importerUnavailableDuration}
                                            onChange={(e) => setFormData({ ...formData, importerUnavailableDuration: e.target.value as ImporterUnavailableDuration })}
                                        >
                                            <option value="permanente">Permanente (hasta que lo desmarques)</option>
                                            <option value="3">Temporal: 3 Meses</option>
                                            <option value="6">Temporal: 6 Meses</option>
                                            <option value="12">Temporal: 1 Año</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ═══ AJUSTE DE STOCK RÁPIDO ═══ */}
                        <div className="mt-6 pt-4 border-t border-subtle">
                            <h3 className="text-sm font-semibold text-fg-muted flex items-center gap-2 mb-4">
                                <Boxes size={18} aria-hidden="true" />
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
                                    <div className="mt-2 text-xs text-fg-muted">
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
                                        if (diff === 0) return <div className="mt-2 text-xs text-fg-muted">El stock no cambiará.</div>;
                                        if (diff > 0) {
                                            return (
                                                <div className="mt-3 space-y-3">
                                                    <div className="flex items-center gap-2 p-2 bg-success-soft border border-success/20 rounded-lg text-xs font-semibold text-success-soft-fg">
                                                        <CirclePlus size={16} aria-hidden="true" />
                                                        Se añadirán <strong>{diff}</strong> unidades al inventario.
                                                    </div>
                                                    <label className="flex items-center cursor-pointer relative group">
                                                        <input type="checkbox" className="sr-only peer"
                                                            checked={stockAdjustment.isPurchase}
                                                            onChange={(e) => setStockAdjustment(prev => ({ ...prev, isPurchase: e.target.checked }))}
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-warning"></div>
                                                        <span className="ml-2 text-sm text-fg-muted font-medium group-hover:text-slate-900 transition-colors">Registrar como compra financiera</span>
                                                    </label>
                                                    {stockAdjustment.isPurchase && (
                                                        <div className="bg-warning-soft border border-warning/20 rounded-lg p-3">
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
                                                                <div className="mt-2 text-xs font-semibold text-warning flex items-center gap-1">
                                                                    <Info size={14} aria-hidden="true" />
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
                                                    <div className="flex items-center gap-2 p-2 bg-danger-soft border border-danger/20 rounded-lg text-xs font-semibold text-danger-soft-fg">
                                                        <CircleMinus size={16} aria-hidden="true" />
                                                        Se restarán <strong>{Math.abs(diff)}</strong> unidades del inventario.
                                                    </div>
                                                    <label className="flex items-center cursor-pointer relative group">
                                                        <input type="checkbox" className="sr-only peer"
                                                            checked={stockAdjustment.isMerma}
                                                            onChange={(e) => setStockAdjustment(prev => ({ ...prev, isMerma: e.target.checked }))}
                                                        />
                                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-danger"></div>
                                                        <span className="ml-2 text-sm text-fg-muted font-medium group-hover:text-slate-900 transition-colors">Registrar como merma (pérdida contable)</span>
                                                    </label>
                                                    {stockAdjustment.isMerma && (
                                                        <div className="bg-danger-soft border border-danger/20 rounded-lg p-3">
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
                                                                <div className="mt-2 text-xs font-semibold text-danger flex items-center gap-1">
                                                                    <Info size={14} aria-hidden="true" />
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
                            <div className="bg-primary-soft text-primary-soft-fg p-3 rounded-lg text-sm flex items-start gap-2 border border-primary/20">
                                <Info size={18} className="mt-0.5" aria-hidden="true" />
                                <div>
                                    Enlaza repuestos que son exactamente el mismo pero en otra marca. Los cambios que realices aquí (enlazar o desenlazar) se guardarán únicamente cuando hagas clic en <strong>Guardar Producto</strong>.
                                </div>
                            </div>

                            {/* Search and Table */}
                            <div className="flex flex-col gap-3">
                                <label className={labelClass}>Buscar repuesto para enlazar (Código o Nombre)</label>
                                <div className="relative">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                                    <input 
                                        type="text" 
                                        className={`${inputClass} pl-10`} 
                                        placeholder="Escribe el código o nombre para buscar..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                    {isSearching && <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle animate-spin" aria-hidden="true" />}
                                </div>

                                <div className="border border-subtle rounded-lg overflow-hidden bg-surface shadow-sm max-h-72 overflow-y-auto mt-1">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="bg-surface-2 text-fg-muted font-semibold uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-2.5">Foto</th>
                                                <th className="px-4 py-2.5">SKU</th>
                                                <th className="px-4 py-2.5">Nombre</th>
                                                <th className="px-4 py-2.5 text-center">Stock</th>
                                                <th className="px-4 py-2.5 text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-fg">
                                            {searchProducts.map(prod => {
                                                const isLinked = linkedProducts.some(lp => lp.id === prod.id);
                                                const totalStock = (prod.local_stock || 0) + (prod.importer_stock || 0);
                                                return (
                                                    <tr key={prod.id} className="hover:bg-surface-hover transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="w-8 h-8 rounded border border-subtle overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                                                                {prod.image_url ? (
                                                                    <img src={prod.image_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <ImageIcon size={16} className="text-fg-subtle" aria-hidden="true" />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 font-mono font-bold text-xs">{prod.sku}</td>
                                                        <td className="px-4 py-3 max-w-[150px] truncate" title={prod.name}>{prod.name}</td>
                                                        <td className="px-4 py-3 text-center font-semibold">{totalStock} u.</td>
                                                        <td className="px-4 py-3 text-right">
                                                            {isLinked ? (
                                                                <span className="text-2xs font-semibold text-success-soft-fg bg-success-soft px-2 py-0.5 rounded-full border border-success/20">
                                                                    Enlazado
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => initiateLink(prod)}
                                                                    className="px-2.5 py-1 bg-primary hover:bg-primary/95 text-white text-[11px] font-semibold rounded shadow-sm transition-colors inline-flex items-center gap-0.5"
                                                                >
                                                                    <LinkIcon size={12} aria-hidden="true" />
                                                                    Enlazar
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {searchProducts.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="text-center py-6 text-fg-subtle">
                                                        No hay repuestos para mostrar.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Linked parts */}
                            <div className="mt-2">
                                <h4 className="text-sm font-semibold text-fg mb-3 flex items-center gap-2">
                                    <LinkIcon size={18} aria-hidden="true" />
                                    Repuestos Enlazados ({linkedProducts.length})
                                </h4>
                                {linkedProducts.length === 0 ? (
                                    <div className="text-center p-6 border border-dashed border-subtle rounded-xl text-fg-subtle text-sm flex flex-col items-center bg-slate-50/50 dark:bg-slate-900/10">
                                        <Link2Off size={32} className="text-fg-subtle mb-2" aria-hidden="true" />
                                        No hay repuestos relacionados en este grupo temporal.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                                        {linkedProducts.map(lp => {
                                            const totalStock = (lp.local_stock || 0) + (lp.importer_stock || 0);
                                            return (
                                                <div key={lp.id} className="flex items-center justify-between p-2 bg-surface-2 border border-subtle rounded-lg group hover:border-slate-300 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded border border-subtle overflow-hidden shrink-0 bg-white flex items-center justify-center shadow-sm">
                                                            {lp.image_url ? (
                                                                <img src={lp.image_url} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <ImageIcon size={18} className="text-fg-subtle" aria-hidden="true" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-bold text-fg flex items-center gap-1.5">
                                                                {lp.sku}
                                                                <span className="bg-surface-3 text-2xs px-1.5 py-0.2 rounded text-fg-muted font-medium">
                                                                    Stock: {totalStock} u.
                                                                </span>
                                                            </div>
                                                            <div className="text-2xs text-fg-muted truncate max-w-[250px]">{lp.name}</div>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => handleUnlink(lp.id)} title="Desenlazar este repuesto" className="w-7 h-7 flex items-center justify-center rounded bg-surface border border-subtle hover:bg-danger-soft hover:border-danger/20 hover:text-danger text-fg-subtle transition-all opacity-70 group-hover:opacity-100">
                                                        <Link2Off size={14} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ Actions ═══ */}
                    <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center w-full">
                            {productToEdit?.last_edited_at ? (
                                <div className="text-xs text-fg-muted flex items-center gap-1.5 bg-surface-2 px-3 py-1.5 rounded-lg border border-subtle">
                                    <History size={14} aria-hidden="true" />
                                    <span>
                                        Última modificación por <strong>{productToEdit.profiles?.full_name || 'Desconocido'}</strong> el {new Date(productToEdit.last_edited_at).toLocaleDateString()} a las {new Date(productToEdit.last_edited_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            ) : (
                                <div></div>
                            )}
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={onClose}
                                    className="px-4 py-2 text-fg hover:bg-surface-hover rounded-lg transition-colors font-medium">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={loading}
                                    className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm shadow-primary/30 transition-all font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-surface rounded-xl shadow-lg w-full max-w-md overflow-hidden border border-subtle animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-subtle flex items-center gap-3 bg-primary-soft/50">
                            <Info size={20} className="text-primary" aria-hidden="true" />
                            <h3 className="text-base font-bold text-fg">Confirmar Enlace</h3>
                        </div>
                        <div className="p-5">
                            <p className="text-fg mb-3 text-xs font-semibold">
                                ¿Estás seguro que quieres enlazar estos productos?
                            </p>
                            <div className="bg-warning-soft border border-warning/20 text-warning-soft-fg p-2.5 rounded-lg text-[11px] mb-4">
                                <strong>Nota importante:</strong> Esto hará que todos estos productos (y todos los que ya estén vinculados a ellos) se enlacen de forma bidireccional formando un único grupo.
                            </div>
                            
                            <div className="max-h-40 overflow-y-auto space-y-2 mb-5 pr-1">
                                {productsToMerge.map(pm => {
                                    const totalStock = (pm.local_stock || 0) + (pm.importer_stock || 0);
                                    return (
                                        <div key={pm.id} className="flex items-center gap-2.5 p-2 bg-surface-2 border border-subtle rounded-lg shadow-xs">
                                            <div className="w-8 h-8 rounded border border-subtle bg-white overflow-hidden shrink-0">
                                                {pm.image_url ? (
                                                    <img src={pm.image_url} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                                        <ImageIcon size={14} className="text-fg-subtle" aria-hidden="true" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold text-fg flex items-center gap-1.5">
                                                    {pm.sku}
                                                    <span className="text-2xs text-fg-muted font-normal">(Stock: {totalStock} u.)</span>
                                                </div>
                                                <div className="text-[12px] text-fg-muted truncate max-w-[220px]">{pm.name}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className="flex justify-end gap-2.5">
                                <button type="button" onClick={() => { setShowConfirmModal(false); setProductToLink(null); setProductsToMerge([]); }} className="px-3.5 py-1.5 text-xs font-semibold text-fg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button type="button" onClick={confirmLink} className="px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow transition-colors flex items-center gap-1.5">
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
