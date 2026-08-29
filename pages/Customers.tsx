import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCartStore } from '../store/cartStore';
import type { Customer } from '../store/cartStore'; // Reuse the interface we already have
import { useShallow } from 'zustand/react/shallow';
import { Plus, Search, Edit2, Trash2, X, Briefcase, User, Percent, Users, MessageSquare, Bell, ClipboardList, Check, AlertCircle, Calendar, DollarSign, ShoppingBag, Sparkles, Phone, Package, Zap, Copy } from 'lucide-react';
import { isProductDiscontinued } from '../utils/discontinuedHelper';
import { normalizePhoneEC } from '../utils/phone';

export interface CustomerRequest {
    id: number;
    customer_id: number;
    product_id: number | null;
    custom_part_description: string | null;
    motorcycle_details: string;
    quantity: number;
    notes: string;
    status: 'pending' | 'arrived' | 'notified' | 'completed' | 'cancelled';
    is_urgent: boolean;
    reminder_at?: string | null;
    created_at: string;
    updated_at: string;
    product?: {
        id: number;
        sku: string;
        name: string;
        price: number;
        cost_without_vat: number;
        inventory_levels?: { current_stock: number; warehouse_id: number }[];
    } | null;
}

// Helper to parse reminder from notes prefix
export const parseRequestReminder = (notes: string | null): { cleanNotes: string, reminderAt: string | null } => {
    if (!notes) return { cleanNotes: '', reminderAt: null };
    const match = notes.match(/^\[REMINDER:\s*([^\]]+)\](.*)$/);
    if (match) {
        return {
            reminderAt: match[1].trim(),
            cleanNotes: match[2].trim()
        };
    }
    return { cleanNotes: notes, reminderAt: null };
};

// Helper to format reminder into notes prefix
export const formatRequestNotes = (cleanNotes: string, reminderAt: string | null): string => {
    if (reminderAt) {
        return `[REMINDER: ${reminderAt}] ${cleanNotes}`;
    }
    return cleanNotes;
};


export interface UnifiedCustomer {
    id: string; // phone or 'pos-' + id
    phone: string;
    normalizedPhone: string;
    name: string;
    posCustomer: Customer | null;
    waitlistRequests: any[]; // combined from product_demands and customer_requests
    is_final_consumer: boolean;
}

export default function Customers() {
    const navigate = useNavigate();
    const { setCustomer, clearCart, addToCart } = useCartStore(
        useShallow((state) => ({
            setCustomer: state.setCustomer,
            clearCart: state.clearCart,
            addToCart: state.addToCart,
        }))
    );


    const [customers, setCustomers] = useState<Customer[]>([]);
    const [productDemands, setProductDemands] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'waitlist' | 'pos'>('waitlist');
    const [unifiedCustomers, setUnifiedCustomers] = useState<UnifiedCustomer[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    // Requests Waitlist States
    const [requests, setRequests] = useState<CustomerRequest[]>([]);
    const [selectedCustomerForDrawer, setSelectedCustomerForDrawer] = useState<UnifiedCustomer | null>(null);
    const [drawerRequests, setDrawerRequests] = useState<CustomerRequest[]>([]);
    const [isLoadingDrawerRequests, setIsLoadingDrawerRequests] = useState(false);

    const [drawerOrders, setDrawerOrders] = useState<any[]>([]);
    const [isLoadingDrawerOrders, setIsLoadingDrawerOrders] = useState(false);


    // Request Form States
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [isCustomPart, setIsCustomPart] = useState(false);
    const [customDescription, setCustomDescription] = useState('');
    const [motorcycleDetails, setMotorcycleDetails] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [isSearchingProducts, setIsSearchingProducts] = useState(false);

    // Additional drawer & notification states
    const [drawerPhone, setDrawerPhone] = useState('');
    const [isSavingDrawerPhone, setIsSavingDrawerPhone] = useState(false);
    const [isAlertsBannerCollapsed, setIsAlertsBannerCollapsed] = useState(false);

    // Quick Register Modal States
    const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
    const [quickPhone, setQuickPhone] = useState('');
    const [quickItems, setQuickItems] = useState<string[]>(['']);
    const [quickReminder, setQuickReminder] = useState('');
    const [quickUrgent, setQuickUrgent] = useState(false);
    const [isSavingQuick, setIsSavingQuick] = useState(false);

    // Regular Drawer Reservation reminder date state
    const [reminderAt, setReminderAt] = useState('');

    // Form State
    const [formData, setFormData] = useState<Partial<Customer>>({
        identification_number: '',
        name: '',
        email: '',
        phone: '',
        is_final_consumer: false
    });

    const fetchRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('customer_requests')
                .select('*, product:products(id, sku, name, price, cost_without_vat, inventory_levels(current_stock, warehouse_id))')
                .in('status', ['pending', 'arrived', 'notified'])
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map virtual reminder properties from notes prefix
            const mapped = (data || []).map((req: any) => {
                const parsed = parseRequestReminder(req.notes);
                return {
                    ...req,
                    reminder_at: parsed.reminderAt,
                    notes: parsed.cleanNotes
                };
            });

            setRequests(mapped);
        } catch (error) {
            console.error('Error fetching requests:', error);
        }
    };

    const fetchDrawerRequests = async (customerId: number) => {
        setIsLoadingDrawerRequests(true);
        try {
            const { data, error } = await supabase
                .from('customer_requests')
                .select('*, product:products(id, sku, name, price, cost_without_vat, inventory_levels(current_stock, warehouse_id))')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mapped = (data || []).map((req: any) => {
                const parsed = parseRequestReminder(req.notes);
                return {
                    ...req,
                    reminder_at: parsed.reminderAt,
                    notes: parsed.cleanNotes
                };
            });

            setDrawerRequests(mapped);
        } catch (error) {
            console.error('Error fetching drawer requests:', error);
        } finally {
            setIsLoadingDrawerRequests(false);
        }
    };

    const refreshRequestsData = async () => {
        await fetchRequests();
        if (selectedCustomerForDrawer) {
            await fetchDrawerRequests(Number(selectedCustomerForDrawer.id));
        }
    };


    const fetchProductDemands = async () => {
        try {
            const { data, error } = await supabase
                .from('product_demands')
                .select('*, product:products(id, sku, name, price, cost_without_vat, inventory_levels(current_stock, warehouse_id))')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setProductDemands(data || []);
        } catch (error) {
            console.error('Error fetching product demands:', error);
        }
    };

    const fetchCustomers = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
            alert('Error al cargar clientes');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
        fetchRequests();
        fetchProductDemands();
    }, []);


    useEffect(() => {
        const unifiedMap = new Map<string, UnifiedCustomer>();

        // 1. Map POS Customers
        customers.forEach(c => {
            const np = normalizePhoneEC(c.phone);
            const key = np || `pos-${c.id}`;
            unifiedMap.set(key, {
                id: key,
                phone: c.phone || '',
                normalizedPhone: np,
                name: c.name || 'Cliente',
                posCustomer: c,
                waitlistRequests: [],
                is_final_consumer: c.is_final_consumer || false
            });
        });

        // 2. Map Product Demands (Waitlist)
        productDemands.forEach(d => {
            const np = normalizePhoneEC(d.phone_number);
            const key = np || `demand-${d.id}`;
            let uc = unifiedMap.get(key);
            if (!uc) {
                uc = {
                    id: key,
                    phone: d.phone_number,
                    normalizedPhone: np,
                    name: d.customer_name || 'Cliente (Lista de Espera)',
                    posCustomer: null,
                    waitlistRequests: [],
                    is_final_consumer: false
                };
                unifiedMap.set(key, uc);
            }
            uc.waitlistRequests.push({ ...d, _type: 'product_demand' });
        });

        // 3. Map Customer Requests (Old waitlist system linked by customer_id)
        requests.forEach(r => {
            const cust = customers.find(c => c.id === r.customer_id);
            if (cust) {
                const np = normalizePhoneEC(cust.phone);
                const key = np || `pos-${cust.id}`;
                const uc = unifiedMap.get(key);
                if (uc) {
                    uc.waitlistRequests.push({ ...r, _type: 'customer_request' });
                }
            }
        });

        setUnifiedCustomers(Array.from(unifiedMap.values()));
    }, [customers, productDemands, requests]);

    // Debounced search for products in the request form
    useEffect(() => {
        if (productSearchQuery.length < 2 || isCustomPart) {
            setSearchResults([]);
            return;
        }

        setIsSearchingProducts(true);
        const delayDebounceFn = setTimeout(async () => {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('id, sku, name, price, cost_without_vat, is_discontinued, discontinued_until, inventory_levels(current_stock, warehouse_id)')
                    .or(`sku.ilike.%${productSearchQuery}%,name.ilike.%${productSearchQuery}%`)
                    .limit(5);

                if (error) throw error;
                setSearchResults(data || []);
            } catch (error) {
                console.error('Error searching products:', error);
            } finally {
                setIsSearchingProducts(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [productSearchQuery, isCustomPart]);

// Update phone number and load requests inside the drawer
    useEffect(() => {
        if (selectedCustomerForDrawer) {
            setDrawerPhone(selectedCustomerForDrawer.phone || '');
            setDrawerRequests(selectedCustomerForDrawer.waitlistRequests);
            setIsLoadingDrawerRequests(false);

            // Fetch Orders if it is a POS customer
            if (selectedCustomerForDrawer.posCustomer) {
                setIsLoadingDrawerOrders(true);
                supabase
                    .from('orders')
                    .select('*, order_items(*, product:products(sku, name, price))')
                    .eq('customer_id', selectedCustomerForDrawer.posCustomer.id)
                    .order('created_at', { ascending: false })
                    .limit(10)
                    .then(({ data, error }) => {
                        if (!error && data) {
                            setDrawerOrders(data);
                        }
                        setIsLoadingDrawerOrders(false);
                    });
            } else {
                setDrawerOrders([]);
            }

        } else {
            setDrawerRequests([]);
        }
    }, [selectedCustomerForDrawer]);

const handleSaveDrawerPhone = async () => {
        if (!selectedCustomerForDrawer) return;
        setIsSavingDrawerPhone(true);
        try {
            if (selectedCustomerForDrawer.posCustomer) {
                const { error } = await supabase
                    .from('customers')
                    .update({ phone: drawerPhone })
                    .eq('id', selectedCustomerForDrawer.posCustomer.id);
                if (error) throw error;
                // Fetch to refresh
                await fetchCustomers();
            } else {
                // If it's only a waitlist demand, maybe create a POS customer?
                alert('El teléfono se guardará en la próxima reserva, debe ser un cliente POS para editar su perfil directamente.');
            }
            alert('Teléfono actualizado correctamente');
        } catch (error: any) {
            console.error('Error updating phone:', error);
            alert(`Error al actualizar teléfono: ${error.message}`);
        } finally {
            setIsSavingDrawerPhone(false);
        }
    };

    // Calculate total stock of cataloged products
    const getProductStockSum = (request: CustomerRequest) => {
        if (!request.product || !request.product.inventory_levels) return 0;
        return request.product.inventory_levels.reduce((acc, lvl) => acc + (lvl.current_stock || 0), 0);
    };

    // Actions for reservations Waitlist
const handleAddRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomerForDrawer) return;
        if (!isCustomPart && !selectedProduct) {
            alert('Por favor selecciona un repuesto del catálogo o marca "No catalogado"');
            return;
        }
        if (!isCustomPart && selectedProduct && isProductDiscontinued(selectedProduct)) {
            alert('El producto seleccionado se encuentra descontinuado. No es posible agregarlo a la lista de espera.');
            return;
        }
        try {
            if (selectedCustomerForDrawer.posCustomer) {
                // Legacy / POS tied request
                const requestData = {
                    customer_id: selectedCustomerForDrawer.posCustomer.id,
                    product_id: isCustomPart ? null : selectedProduct.id,
                    custom_part_description: isCustomPart ? customDescription : null,
                    motorcycle_details: motorcycleDetails,
                    quantity,
                    notes: formatRequestNotes(notes, reminderAt),
                    is_urgent: isUrgent,
                    status: 'pending'
                };
                const { error } = await supabase.from('customer_requests').insert([requestData]);
                if (error) throw error;
            } else {
                // New system request (Waitlist standalone)
                if (isCustomPart) {
                    alert('En el CRM de Demanda pura, debes seleccionar un producto de catálogo.');
                    return;
                }
                const demandData = {
                    phone_number: selectedCustomerForDrawer.phone,
                    customer_name: selectedCustomerForDrawer.name,
                    product_id: selectedProduct.id,
                    notes: formatRequestNotes(notes, reminderAt),
                    status: 'pending_stock'
                };
                const { error } = await supabase.from('product_demands').insert([demandData]);
                if (error) throw error;
            }
            // Reset request form inputs
            setProductSearchQuery('');
            setSelectedProduct(null);
            setIsCustomPart(false);
            setCustomDescription('');
            setMotorcycleDetails('');
            setQuantity(1);
            setNotes('');
            setReminderAt('');
            setIsUrgent(false);
            
            await fetchRequests();
            await fetchProductDemands();
        } catch (error: any) {
            console.error('Error adding request:', error);
            alert(`Error al guardar la reserva: ${error.message}`);
        }
    };

    // Action for ⚡ Quick Register (WhatsApp & Reminder ONLY required)
    const handleQuickSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickPhone.trim()) {
            alert('Por favor ingresa el número de teléfono');
            return;
        }

        const activeItems = quickItems
            .map(item => item.trim())
            .filter(item => item.length > 0);

        if (activeItems.length === 0) {
            alert('Por favor ingresa al menos un repuesto o código');
            return;
        }

        if (!quickReminder) {
            alert('Por favor selecciona una fecha de recordatorio');
            return;
        }

        setIsSavingQuick(true);
        try {
            // Clean phone number: remove non-digits
            const cleanedPhone = quickPhone.replace(/\D/g, '');
            if (!cleanedPhone) {
                alert('Por favor ingresa un número de teléfono válido');
                setIsSavingQuick(false);
                return;
            }

            // 1. Check if customer with this phone number already exists
            const { data: existing, error: findError } = await supabase
                .from('customers')
                .select('*')
                .eq('phone', cleanedPhone)
                .limit(1);

            if (findError) throw findError;

            let customerId: number;

            if (existing && existing.length > 0) {
                customerId = existing[0].id;
            } else {
                // Create customer automatically
                const tempDocId = `WA-${Date.now().toString().slice(-6)}`;
                const { data: newCust, error: createError } = await supabase
                    .from('customers')
                    .insert([{
                        name: `WhatsApp - ${cleanedPhone}`,
                        phone: cleanedPhone,
                        identification_number: tempDocId,
                        is_final_consumer: false
                    }])
                    .select();

                if (createError) throw createError;
                if (!newCust || newCust.length === 0) throw new Error('No se pudo registrar el cliente automático');
                customerId = newCust[0].id;
            }

            // 2. Insert into customer_requests with reminder in notes
            const requestsData = activeItems.map(item => ({
                customer_id: customerId,
                product_id: null,
                custom_part_description: item,
                motorcycle_details: '',
                quantity: 1,
                notes: formatRequestNotes('', quickReminder), // Empty clean notes, set reminder at prefix
                is_urgent: quickUrgent,
                status: 'pending'
            }));

            const { error: reqError } = await supabase
                .from('customer_requests')
                .insert(requestsData);

            if (reqError) throw reqError;

            // Reset quick register states
            setQuickPhone('');
            setQuickItems(['']);
            setQuickReminder('');
            setQuickUrgent(false);
            setIsQuickModalOpen(false);

            // Refresh lists
            await fetchCustomers();
            await refreshRequestsData();

            // Fetch the updated customer row to open in drawer
            const { data: finalCust, error: fetchCustErr } = await supabase
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();

            if (!fetchCustErr && finalCust) {
                setSelectedCustomerForDrawer(finalCust);
            }

            alert('Reserva rápida y recordatorio registrados correctamente');
        } catch (error: any) {
            console.error('Error saving quick request:', error);
            alert(`Error al guardar: ${error.message}`);
        } finally {
            setIsSavingQuick(false);
        }
    };

    const handleDeleteRequest = async (requestId: number) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar esta reserva?')) return;
        try {
            const { error } = await supabase
                .from('customer_requests')
                .delete()
                .eq('id', requestId);

            if (error) throw error;
            await refreshRequestsData();
        } catch (error: any) {
            console.error('Error deleting request:', error);
            alert(`Error al eliminar: ${error.message}`);
        }
    };

    const handleWhatsAppNotification = async (request: CustomerRequest) => {
        if (!selectedCustomerForDrawer || !selectedCustomerForDrawer.phone) {
            alert('El cliente no tiene un teléfono registrado para WhatsApp');
            return;
        }

        // Clean formatting and add Ecuador standard country code if missing
        let phoneClean = selectedCustomerForDrawer.phone.replace(/\D/g, '');
        if (phoneClean.startsWith('0')) {
            phoneClean = '593' + phoneClean.slice(1);
        } else if (!phoneClean.startsWith('593')) {
            phoneClean = '593' + phoneClean;
        }

        const partName = request.product ? request.product.name : request.custom_part_description;
        const msg = `Hola *${selectedCustomerForDrawer.name}*, te saludamos de Repuestos Daytona. El repuesto que tenías reservado: *${partName}* ${request.motorcycle_details ? `para ${request.motorcycle_details}` : ''} ya se encuentra disponible en nuestro local. ¿Deseas que te lo separemos o enviemos?`;

        const encodedMsg = encodeURIComponent(msg);
        const whatsappUrl = `https://wa.me/${phoneClean}?text=${encodedMsg}`;

        window.open(whatsappUrl, '_blank');

        // Update DB request status to 'notified'
        try {
            const { error } = await supabase
                .from('customer_requests')
                .update({ status: 'notified', updated_at: new Date().toISOString() })
                .eq('id', request.id);

            if (error) throw error;
            await refreshRequestsData();
        } catch (error: any) {
            console.error('Error updating status:', error);
        }
    };

    const handleBillRequest = async (request: CustomerRequest) => {
        if (!selectedCustomerForDrawer) return;

        try {
            // Reset the POS cart to load the client and the item context
            clearCart();
            setCustomer(selectedCustomerForDrawer as any);

            if (request.product) {
                // Preload cataloged product
                const inventoryLevels = request.product.inventory_levels || [];
                const levelWithStock = inventoryLevels.find(level => level.current_stock > 0);
                
                const warehouseId = levelWithStock ? levelWithStock.warehouse_id : (inventoryLevels[0]?.warehouse_id || 0);
                const currentStock = levelWithStock ? levelWithStock.current_stock : 0;

                addToCart({
                    product: {
                        id: request.product.id,
                        sku: request.product.sku,
                        name: request.product.name,
                        price: request.product.price,
                        cost_without_vat: request.product.cost_without_vat,
                    },
                    warehouse_id: warehouseId,
                    warehouse_name: warehouseId === 0 ? 'Sin Bodega' : `Bodega ${warehouseId}`,
                    current_stock: currentStock
                });
            } else {
                // Custom manual item mapping
                addToCart({
                    product: {
                        id: -999,
                        sku: 'PRESERV',
                        name: request.custom_part_description || 'Repuesto Especial',
                        price: 0,
                        cost_without_vat: 0,
                    },
                    warehouse_id: 0,
                    warehouse_name: 'Especial',
                    current_stock: 0
                });
            }

            // Update status to 'completed'
            const { error } = await supabase
                .from('customer_requests')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', request.id);

            if (error) throw error;
            
            navigate('/pos');
        } catch (error: any) {
            console.error('Error in handleBillRequest:', error);
            alert(`Error al facturar la reserva: ${error.message}`);
        }
    };

    const handleOpenModal = (customer?: Customer) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData(customer);
        } else {
            setEditingCustomer(null);
            setFormData({
                identification_number: '',
                name: '',
                email: '',
                phone: '',
                is_final_consumer: false
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                const { error } = await supabase
                    .from('customers')
                    .update(formData)
                    .eq('id', editingCustomer.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert([formData]);
                if (error) throw error;
            }
            handleCloseModal();
            fetchCustomers();
        } catch (error: any) {
            console.error('Error saving customer:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este cliente?')) return;
        try {
            // Prevent deleting CONSUMIDOR FINAL
            const { data: currentCust, error: getErr } = await supabase
                .from('customers')
                .select('identification_number, phone, name')
                .eq('id', id)
                .single();
            
            if (!getErr && currentCust?.identification_number === '9999999999') {
                alert('No se puede eliminar el cliente "CONSUMIDOR FINAL" porque es requerido por el sistema.');
                return;
            }

            // 1. Try to physically delete the customer
            const { error: deleteErr } = await supabase
                .from('customers')
                .delete()
                .eq('id', id);

            if (!deleteErr) {
                // Physical delete succeeded!
                fetchCustomers();
                return;
            }

            // 2. If it failed due to foreign key constraint (sales/orders associated), offer soft delete/archive
            if (deleteErr.code === '23503') {
                const confirmSoft = window.confirm(
                    `Este cliente tiene ventas o pedidos registrados en el sistema.\n\n` +
                    `Para preservar el historial financiero, ¿deseas desactivarlo y ocultarlo permanentemente del directorio? (El número de teléfono quedará liberado para futuros registros).`
                );

                if (!confirmSoft) return;

                const origIdent = currentCust?.identification_number || `ID-${id}`;
                const origPhone = currentCust?.phone || '';
                
                // We update identification_number to "DEL-..." to hide it from the UI, and we prefix the phone to liberate the number
                const { error: updateErr } = await supabase
                    .from('customers')
                    .update({
                        identification_number: `DEL-${origIdent}-${Date.now().toString().slice(-4)}`,
                        phone: origPhone ? `DEL-${origPhone}` : null,
                        name: `[Eliminado] ${currentCust?.name || ''}`
                    })
                    .eq('id', id);

                if (updateErr) throw updateErr;

                alert('Cliente desactivado y ocultado exitosamente del directorio.');
                fetchCustomers();
            } else {
                throw deleteErr;
            }
        } catch (error: any) {
            console.error('Error deleting customer:', error);
            alert(`Error al eliminar el cliente: ${error.message}`);
        }
    };

const filteredUnifiedCustomers = unifiedCustomers.filter(c => {
        // Filter by Tab
        if (activeTab === 'pos') {
            if (!c.posCustomer) return false;
            if (c.is_final_consumer) return false; // Hide Consumidor Final
        } else if (activeTab === 'waitlist') {
            if (c.waitlistRequests.length === 0) return false;
        }

        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        const matchesBasic = (c.name || '').toLowerCase().includes(query) ||
            (c.posCustomer?.identification_number || '').toLowerCase().includes(query) ||
            (c.phone || '').includes(query);

        if (matchesBasic) return true;
        
        return c.waitlistRequests.some(r => {
            const customDesc = (r.custom_part_description || '').toLowerCase();
            const motoDetails = (r.motorcycle_details || '').toLowerCase();
            const notes = (r.notes || '').toLowerCase();
            const prodName = r.product ? (r.product.name || '').toLowerCase() : '';
            const prodSku = r.product ? (r.product.sku || '').toLowerCase() : '';

            return customDesc.includes(query) ||
                motoDetails.includes(query) ||
                notes.includes(query) ||
                prodName.includes(query) ||
                prodSku.includes(query);
        });
    });

    const pendingWithStock = requests.filter(r => 
        (r.status === 'pending' || r.status === 'arrived') && 
        r.product && 
        getProductStockSum(r) > 0
    );

    const activeReminders = requests.filter(r => {
        if (!r.reminder_at || r.status === 'completed' || r.status === 'cancelled') return false;
        const remDate = new Date(r.reminder_at);
        const now = new Date();
        // Show in banner if reminder is overdue or due within the next 24 hours
        return remDate <= now || (remDate.getTime() - now.getTime()) <= 24 * 60 * 60 * 1000;
    });

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-fg flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" />
                        Directorio de Clientes
                    </h1>
                    <p className="text-fg-muted mt-1">
                        Gestiona tu cartera de clientes, talleres mecánicos y aliados comerciales.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsQuickModalOpen(true)}
                        className="bg-warning hover:bg-warning text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                    >
                        <Zap className="w-4 h-4" />
                        ⚡ Registro Rápido (WhatsApp)
                    </button>
                </div>
            </div>



            
            {/* TABS */}
            <div className="flex space-x-1 bg-surface-3 p-1 rounded-xl mb-4 max-w-fit">
                <button
                    onClick={() => setActiveTab('waitlist')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'waitlist' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    CRM Lista de Espera (Teléfonos)
                </button>
                <button
                    onClick={() => setActiveTab('pos')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'pos' ? 'bg-white dark:bg-slate-700 text-primary shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Clientes Facturación POS
                </button>
            </div>

            <div className="bg-surface rounded-xl shadow-sm border border-subtle overflow-hidden">
                <div className="p-4 border-b border-subtle">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, cédula/RUC, teléfono o repuesto..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-surface-2 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary transition-all dark:text-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-fg-muted">
                        <thead className="bg-surface-2 text-fg-muted uppercase font-semibold text-xs">
                            <tr>
                                <th className="px-4 py-2.5">Identificación</th>
                                <th className="px-4 py-2.5">Nombre / Razón Social</th>
                                <th className="px-4 py-2.5">Contacto</th>
                                <th className="px-4 py-2.5">Tipo</th>
                                <th className="px-4 py-2.5">Reservas / WhatsApp</th>
                                <th className="px-4 py-2.5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-center text-fg-muted">
                                        Cargando directorio...
                                    </td>
                                </tr>
                            ) : filteredUnifiedCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-center text-fg-muted">
                                        No se encontraron clientes.
                                    </td>
                                </tr>
                            ) : (
                                filteredUnifiedCustomers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-surface-hover transition-colors">
                                        <td className="px-4 py-3 font-medium text-fg">
                                            {customer.posCustomer ? customer.posCustomer.identification_number : 'S/N (CRM)'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-fg">{customer.name}</div>
                                            {customer.is_final_consumer && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium bg-slate-100 text-fg-muted dark:bg-slate-800 mt-1">
                                                    Consumidor Final Automático
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">{customer.posCustomer?.email || '-'}</div>
                                            <div className="text-xs text-fg-muted">{customer.phone || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success-soft text-success-soft-fg border border-success/20">
                                                <User className="w-3.5 h-3.5" />
                                                {customer.posCustomer ? 'POS' : 'Demanda'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {(() => {
                                                const custRequests = customer.waitlistRequests.filter(r => r.status !== 'completed' && r.status !== 'cancelled');
                                                const hasStockReady = custRequests.some(r => r.product && getProductStockSum(r) > 0 && (r.status === 'pending' || r.status === 'arrived' || r.status === 'pending_stock'));
                                                const isUrgentCust = custRequests.some(r => r.is_urgent && (r.status === 'pending' || r.status === 'pending_stock'));

                                                return (
                                                    <button
                                                        onClick={() => setSelectedCustomerForDrawer(customer)}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all duration-300 hover:scale-105 ${ custRequests.length === 0 ? 'bg-slate-100 text-fg-muted hover:bg-slate-200 dark:hover:bg-slate-700 dark:bg-slate-800 dark:text-slate-400' : hasStockReady ? 'bg-success text-white animate-pulse hover:bg-success' : isUrgentCust ? 'bg-warning text-white hover:bg-warning' : 'bg-primary-soft text-primary hover:bg-primary-soft border border-primary/20 dark:border-primary/50' }`}
                                                    >
                                                        <Bell className={`w-3.5 h-3.5 ${hasStockReady ? 'animate-bounce' : ''}`} />
                                                        {custRequests.length === 0 ? (
                                                            'Sin reservas'
                                                        ) : hasStockReady ? (
                                                            `📦 ¡Stock Listo! (${custRequests.length})`
                                                        ) : (
                                                            `Pendientes (${custRequests.length})`
                                                        )}
                                                    </button>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {!customer.is_final_consumer && (
                                                <div className="flex items-center justify-end gap-2">
                                                    {customer.posCustomer && (
                                                        <button
                                                            onClick={() => handleOpenModal(customer.posCustomer)}
                                                            className="p-1.5 text-fg-subtle hover:text-primary hover:bg-primary-soft rounded transition-colors"
                                                            title="Editar Cliente"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {customer.posCustomer && (
                                                        <button
                                                            onClick={() => handleDelete(customer.posCustomer.id)}
                                                            className="p-1.5 text-fg-subtle hover:text-danger hover:bg-danger-soft rounded transition-colors"
                                                            title="Eliminar Cliente"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-subtle">
                            <h2 className="text-lg font-bold text-fg">
                                {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-fg-muted hover:text-slate-700 dark:hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-fg mb-1">
                                    Cédula / RUC *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.identification_number}
                                    onChange={(e) => setFormData({ ...formData, identification_number: e.target.value })}
                                    className="w-full border border-strong rounded-lg p-2.5 text-sm bg-surface text-fg focus:ring-2 focus:ring-primary outline-none transition-shadow"
                                    placeholder="Ej: 0999999999001"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-fg mb-1">
                                    Nombre o Razón Social *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border border-strong rounded-lg p-2.5 text-sm bg-surface text-fg focus:ring-2 focus:ring-primary outline-none transition-shadow"
                                    placeholder="Ej: Taller Motors C.A"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-fg mb-1">
                                        Teléfono
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone || ''}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full border border-strong rounded-lg p-2.5 text-sm bg-surface text-fg focus:ring-2 focus:ring-primary outline-none transition-shadow"
                                        placeholder="Opcional"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-fg mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full border border-strong rounded-lg p-2.5 text-sm bg-surface text-fg focus:ring-2 focus:ring-primary outline-none transition-shadow"
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 border border-strong text-fg rounded-lg font-medium hover:bg-surface-hover transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary transition-colors shadow-sm"
                                >
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Quick Reservation (WhatsApp) Modal */}
            {isQuickModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-subtle">
                            <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                                <Zap className="w-5 h-5 text-warning animate-pulse" />
                                Registro Rápido (WhatsApp)
                            </h2>
                            <button onClick={() => setIsQuickModalOpen(false)} className="text-fg-muted hover:text-slate-700 dark:hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleQuickSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-fg mb-1">
                                    Teléfono del Cliente *
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={quickPhone}
                                    onChange={(e) => setQuickPhone(e.target.value)}
                                    className="w-full border border-strong rounded-lg p-2.5 text-sm bg-surface text-fg focus:ring-2 focus:ring-primary outline-none transition-shadow"
                                    placeholder="Ej: 0999999999"
                                />
                            </div>

                            {/* Quick items list instead of textarea */}
                            <div>
                                <label className="block text-sm font-medium text-fg mb-1.5 flex items-center justify-between">
                                    <span>Repuestos / Códigos a Registrar *</span>
                                    <span className="text-xs text-fg-subtle">({quickItems.length} {quickItems.length === 1 ? 'ítem' : 'ítems'})</span>
                                </label>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {quickItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-left duration-200">
                                            <input
                                                type="text"
                                                required
                                                value={item}
                                                onChange={(e) => {
                                                    const newItems = [...quickItems];
                                                    newItems[idx] = e.target.value;
                                                    setQuickItems(newItems);
                                                }}
                                                className="flex-1 border border-strong rounded-lg p-2.5 text-sm bg-surface text-fg focus:ring-2 focus:ring-primary outline-none transition-shadow"
                                                placeholder={`Repuesto o Código #${idx + 1}`}
                                            />
                                            {quickItems.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (item.trim() && !window.confirm('¿Estás seguro de que deseas eliminar este repuesto de la lista?')) {
                                                            return;
                                                        }
                                                        const newItems = quickItems.filter((_, i) => i !== idx);
                                                        setQuickItems(newItems);
                                                    }}
                                                    className="p-2.5 text-fg-subtle hover:text-danger hover:bg-danger-soft rounded-lg transition-colors border border-subtle shrink-0"
                                                    title="Eliminar repuesto"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setQuickItems([...quickItems, ''])}
                                    className="w-full mt-3 py-2 px-4 border border-dashed border-strong hover:border-primary rounded-lg text-xs font-semibold text-fg-muted hover:text-primary transition-colors flex items-center justify-center gap-1.5 bg-slate-50/50 dark:bg-slate-800/30"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Agregar nuevo producto
                                </button>
                            </div>

                            {/* Calendar Picker restoration */}
                            <div className="grid grid-cols-1 gap-4 my-2">
                                <div>
                                    <label className="block text-sm font-medium text-fg mb-1 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-warning" />
                                        Fecha y Hora de Recordatorio *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={quickReminder}
                                        onChange={(e) => setQuickReminder(e.target.value)}
                                        onClick={(e) => {
                                            try {
                                                e.currentTarget.showPicker();
                                            } catch (err) {
                                                console.debug('showPicker not supported', err);
                                            }
                                        }}
                                        className="w-full border border-strong rounded-lg p-2.5 text-sm bg-surface text-fg outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                                    />
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date();
                                                if (d.getHours() >= 16) {
                                                    d.setDate(d.getDate() + 1);
                                                    d.setHours(10, 0, 0, 0);
                                                } else {
                                                    d.setHours(17, 0, 0, 0);
                                                }
                                                const pad = (n: number) => n.toString().padStart(2, '0');
                                                setQuickReminder(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                            }}
                                            className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg px-2 py-1 rounded transition-colors"
                                        >
                                            Hoy tarde / Mañana
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date();
                                                d.setDate(d.getDate() + 1);
                                                d.setHours(10, 0, 0, 0);
                                                const pad = (n: number) => n.toString().padStart(2, '0');
                                                setQuickReminder(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                            }}
                                            className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg px-2 py-1 rounded transition-colors"
                                        >
                                            +1 día
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date();
                                                d.setDate(d.getDate() + 3);
                                                d.setHours(10, 0, 0, 0);
                                                const pad = (n: number) => n.toString().padStart(2, '0');
                                                setQuickReminder(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                            }}
                                            className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg px-2 py-1 rounded transition-colors"
                                        >
                                            +3 días
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const d = new Date();
                                                d.setDate(d.getDate() + 7);
                                                d.setHours(10, 0, 0, 0);
                                                const pad = (n: number) => n.toString().padStart(2, '0');
                                                setQuickReminder(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                            }}
                                            className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg px-2 py-1 rounded transition-colors"
                                        >
                                            +1 semana
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-surface-2 p-2.5 rounded-lg border border-subtle">
                                <span className="text-xs font-semibold text-fg flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-warning" />
                                    ¿Es un pedido Urgente?
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={quickUrgent}
                                        onChange={(e) => setQuickUrgent(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-warning"></div>
                                </label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsQuickModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-strong text-fg rounded-lg font-medium hover:bg-surface-hover transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingQuick}
                                    className="flex-1 px-4 py-2 bg-warning hover:bg-warning text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-1.5 font-bold"
                                >
                                    {isSavingQuick ? 'Guardando...' : 'Registrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Drawer Sidebar for Customer Requests */}
            {selectedCustomerForDrawer && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    {/* Backdrop */}
                    <div 
                        onClick={() => setSelectedCustomerForDrawer(null)}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
                    />

                    {/* Drawer Content */}
                    <div className="relative w-full max-w-lg bg-surface shadow-xl h-full flex flex-col z-10 overflow-hidden border-l border-subtle animate-in slide-in-from-right duration-300">
{/* Header */}
                        <div className="px-6 py-4 border-b border-subtle flex items-center justify-between bg-surface-2">
                            <div>
                                <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-primary" />
                                    Perfil Unificado de Cliente
                                </h2>
                                <p className="text-xs text-fg-muted mt-0.5">
                                    Cliente: <strong className="text-fg">{selectedCustomerForDrawer.name}</strong>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(selectedCustomerForDrawer.phone);
                                        alert('Teléfono copiado');
                                    }}
                                    className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-fg-muted transition-colors flex items-center gap-1 text-xs font-semibold"
                                >
                                    <Copy className="w-4 h-4" /> Copiar
                                </button>
                                <a
                                    href={`https://wa.me/${selectedCustomerForDrawer.normalizedPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-success hover:bg-success text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                                >
                                    <MessageSquare className="w-4 h-4" /> WhatsApp
                                </a>
                                <button 
                                    onClick={() => setSelectedCustomerForDrawer(null)}
                                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-fg-muted transition-colors ml-2"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Drawer body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* WhatsApp number input */}
                            <div className="bg-primary-soft border border-primary/20 rounded-xl p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                                    <Phone className="w-4 h-4 text-primary" />
                                    Número para Contacto
                                </h3>
                                <div className="flex gap-2">
                                    <input
                                        type="tel"
                                        placeholder="Ej: 0999999999 o +593..."
                                        value={drawerPhone}
                                        onChange={(e) => setDrawerPhone(e.target.value)}
                                        className="flex-1 min-w-0 border border-strong rounded-lg px-3 py-1.5 text-sm bg-surface text-fg focus:ring-2 focus:ring-primary outline-none"
                                    />
                                    <button
                                        onClick={handleSaveDrawerPhone}
                                        disabled={isSavingDrawerPhone}
                                        className="bg-primary hover:bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors shrink-0"
                                    >
                                        {isSavingDrawerPhone ? 'Guardando...' : 'Actualizar'}
                                    </button>
                                </div>
                                {!selectedCustomerForDrawer.phone && (
                                    <p className="text-[11px] text-warning flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        Agrega un teléfono para habilitar notificaciones de WhatsApp.
                                    </p>
                                )}
                            </div>

                            {/* Create Request Form */}
                            <div className="border border-subtle rounded-xl p-4 space-y-4">
                                <h3 className="text-sm font-bold text-fg flex items-center gap-1.5">
                                    <Plus className="w-4 h-4 text-primary" />
                                    Nueva Reserva / Pedido
                                </h3>

                                <form onSubmit={handleAddRequest} className="space-y-4">
                                    {/* Toggle custom vs cataloged */}
                                    <div className="flex gap-2 p-1 bg-surface-3 rounded-lg text-xs">
                                        <button
                                            type="button"
                                            onClick={() => { setIsCustomPart(false); setSelectedProduct(null); }}
                                            className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${!isCustomPart ? 'bg-white dark:bg-slate-700 shadow-sm text-fg dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                                        >
                                            Repuesto de Catálogo
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsCustomPart(true); setSelectedProduct(null); }}
                                            className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${isCustomPart ? 'bg-white dark:bg-slate-700 shadow-sm text-fg dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                                        >
                                            No Catalogado (Texto libre)
                                        </button>
                                    </div>

                                    {!isCustomPart ? (
                                        <div className="relative">
                                            <label className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
                                                Buscar Repuesto
                                            </label>
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
                                                <input
                                                    type="text"
                                                    placeholder="Escribe SKU o nombre..."
                                                    value={selectedProduct ? `${selectedProduct.sku} - ${selectedProduct.name}` : productSearchQuery}
                                                    onChange={(e) => {
                                                        if (selectedProduct) {
                                                            setSelectedProduct(null);
                                                            setProductSearchQuery('');
                                                        } else {
                                                            setProductSearchQuery(e.target.value);
                                                        }
                                                    }}
                                                    className="w-full pl-9 pr-8 py-2 bg-surface-2 border border-strong rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-fg"
                                                />
                                                {selectedProduct && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedProduct(null)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-slate-600 dark:hover:text-slate-300"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Autocomplete list */}
                                            {productSearchQuery.length >= 2 && !selectedProduct && (
                                                <div className="absolute left-0 right-0 z-20 mt-1 bg-surface border border-subtle rounded-lg shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                                    {isSearchingProducts ? (
                                                        <div className="p-3 text-center text-xs text-fg-muted">Buscando...</div>
                                                    ) : searchResults.length === 0 ? (
                                                        <div className="p-3 text-center text-xs text-fg-muted">No se encontraron repuestos</div>
                                                    ) : (
                                                        searchResults.map(prod => {
                                                            const stock = prod.inventory_levels?.reduce((sum: number, lvl: any) => sum + (lvl.current_stock || 0), 0) || 0;
                                                            return (
                                                                <button
                                                                    key={prod.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedProduct(prod);
                                                                        setProductSearchQuery('');
                                                                        setSearchResults([]);
                                                                    }}
                                                                    className="w-full text-left p-3 hover:bg-surface-hover transition-colors flex justify-between items-start"
                                                                >
                                                                    <div>
                                                                        <div className="text-sm font-semibold text-fg">{prod.name}</div>
                                                                        <div className="text-xs text-fg-muted">SKU: {prod.sku} | Precio: ${prod.price}</div>
                                                                        {isProductDiscontinued(prod) && (
                                                                            <div className="text-2xs font-bold text-danger mt-0.5">Descontinuado</div>
                                                                        )}
                                                                    </div>
                                                                    <span className={`text-2xs px-2 py-0.5 rounded font-bold ${stock > 0 ? 'bg-success-soft text-success dark:text-white' : 'bg-danger-soft text-danger dark:text-white'}`}>
                                                                        Stock: {stock}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
                                                Descripción del Repuesto Especial
                                            </label>
                                            <textarea
                                                required
                                                rows={2}
                                                placeholder="Ej: Amortiguador trasero AXXO reforzado"
                                                value={customDescription}
                                                onChange={(e) => setCustomDescription(e.target.value)}
                                                className="w-full border border-strong rounded-lg p-2.5 bg-surface-2 text-fg text-sm outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
                                                Detalle Moto (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej: Daytona Coyote 150"
                                                value={motorcycleDetails}
                                                onChange={(e) => setMotorcycleDetails(e.target.value)}
                                                className="w-full border border-strong rounded-lg p-2 text-sm bg-surface text-fg outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
                                                Cantidad
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                required
                                                value={quantity}
                                                onChange={(e) => setQuantity(Number(e.target.value))}
                                                className="w-full border border-strong rounded-lg p-2 text-sm bg-surface text-fg outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
                                                Notas Internas
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej: Pago seña 50%..."
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                className="w-full border border-strong rounded-lg p-2 text-sm bg-surface text-fg outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5 text-warning" />
                                                Recordatorio
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={reminderAt}
                                                onChange={(e) => setReminderAt(e.target.value)}
                                                onClick={(e) => {
                                                    try {
                                                        e.currentTarget.showPicker();
                                                    } catch (err) {
                                                        console.debug('showPicker not supported', err);
                                                    }
                                                }}
                                                className="w-full border border-strong rounded-lg p-2 text-sm bg-surface text-fg outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                                            />
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date();
                                                        if (d.getHours() >= 16) {
                                                            d.setDate(d.getDate() + 1);
                                                            d.setHours(10, 0, 0, 0);
                                                        } else {
                                                            d.setHours(17, 0, 0, 0);
                                                        }
                                                        const pad = (n: number) => n.toString().padStart(2, '0');
                                                        setReminderAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                                    }}
                                                    className="text-2xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg px-1.5 py-0.5 rounded transition-colors"
                                                >
                                                    Hoy/Mañana
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date();
                                                        d.setDate(d.getDate() + 1);
                                                        d.setHours(10, 0, 0, 0);
                                                        const pad = (n: number) => n.toString().padStart(2, '0');
                                                        setReminderAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                                    }}
                                                    className="text-2xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg px-1.5 py-0.5 rounded transition-colors"
                                                >
                                                    +1d
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date();
                                                        d.setDate(d.getDate() + 3);
                                                        d.setHours(10, 0, 0, 0);
                                                        const pad = (n: number) => n.toString().padStart(2, '0');
                                                        setReminderAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                                    }}
                                                    className="text-2xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg px-1.5 py-0.5 rounded transition-colors"
                                                >
                                                    +3d
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date();
                                                        d.setDate(d.getDate() + 7);
                                                        d.setHours(10, 0, 0, 0);
                                                        const pad = (n: number) => n.toString().padStart(2, '0');
                                                        setReminderAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                                    }}
                                                    className="text-2xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-fg px-1.5 py-0.5 rounded transition-colors"
                                                >
                                                    +1s
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-surface-2 p-2.5 rounded-lg border border-subtle">
                                        <span className="text-xs font-semibold text-fg flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5 text-warning" />
                                            ¿Es un pedido Urgente?
                                        </span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isUrgent}
                                                onChange={(e) => setIsUrgent(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-warning"></div>
                                        </label>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full bg-primary hover:bg-primary text-white py-2 rounded-lg font-semibold text-sm shadow transition-colors"
                                    >
                                        Registrar Reserva
                                    </button>
                                </form>
                            </div>

                            {/* Active Reservations list */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-fg flex items-center gap-1.5">
                                    <ClipboardList className="w-4 h-4 text-primary" />
                                    Reservas de {selectedCustomerForDrawer.name}
                                </h3>

                                {isLoadingDrawerRequests ? (
                                    <div className="text-center py-6 text-xs text-fg-muted bg-surface-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                        Cargando historial de reservas...
                                    </div>
                                ) : drawerRequests.length === 0 ? (
                                    <div className="text-center py-6 text-xs text-fg-muted bg-surface-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                        No hay reservas registradas.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {drawerRequests.map(req => {
                                                const stockSum = getProductStockSum(req);
                                                const hasStock = req.product && stockSum > 0;
                                                
                                                return (
                                                    <div 
                                                        key={req.id} 
                                                        className={`border rounded-xl p-4 transition-all duration-300 relative overflow-hidden ${ req.is_urgent && req.status === 'pending' ? 'border-warning/20 bg-warning-soft/20 dark:bg-warning/10' : hasStock && (req.status === 'pending' || req.status === 'arrived') ? 'border-success/20 bg-success-soft/20 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900' }`}
                                                    >
                                                        <div className="flex justify-between items-start gap-2 mb-2">
                                                            <div>
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider ${ req.status === 'completed' ? 'bg-primary-soft text-primary dark:text-white' : req.status === 'notified' ? 'bg-primary-soft text-primary dark:text-white' : hasStock ? 'bg-success text-white' : req.is_urgent ? 'bg-warning text-white' : 'bg-slate-100 text-fg dark:bg-slate-800 dark:text-slate-300' }`}>
                                                                    {req.status === 'completed' && <Check className="w-2.5 h-2.5" />}
                                                                    {req.status === 'notified' && <MessageSquare className="w-2.5 h-2.5" />}
                                                                    {hasStock && <Package className="w-2.5 h-2.5" />}
                                                                    {req.status === 'completed' 
                                                                        ? 'Facturado' 
                                                                        : req.status === 'notified'
                                                                        ? 'Notificado'
                                                                        : hasStock
                                                                        ? '¡Con Stock Listo!'
                                                                        : req.is_urgent
                                                                        ? 'Urgente / Pendiente'
                                                                        : 'Pendiente'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteRequest(req.id)}
                                                                className="p-1 hover:bg-surface-hover text-fg-subtle hover:text-danger rounded transition-colors"
                                                                title="Eliminar Reserva"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>

                                                        <div className="font-semibold text-fg text-sm">
                                                            {req.product ? req.product.name : req.custom_part_description}
                                                        </div>
                                                        
                                                        <div className="text-xs text-fg-muted mt-1 space-y-1">
                                                            {req.product && (
                                                                <div>SKU: <code className="bg-surface-3 px-1 py-0.5 rounded text-2xs font-mono">{req.product.sku}</code></div>
                                                            )}
                                                            {req.motorcycle_details && (
                                                                <div>🏍️ Moto: {req.motorcycle_details}</div>
                                                            )}
                                                            <div>Cantidad: {req.quantity} uds</div>
                                                            {req.notes && (
                                                                <div className="italic text-fg-muted bg-surface-2 px-2 py-1 rounded mt-1">
                                                                    Nota: "{req.notes}"
                                                                </div>
                                                            )}
                                                            {req.reminder_at && (
                                                                <div className="flex items-center gap-1.5 text-[11px] text-warning font-semibold mt-1.5 bg-warning/10 p-1.5 rounded border border-warning/20">
                                                                    <Calendar className="w-3.5 h-3.5" />
                                                                    Recordar: {new Date(req.reminder_at).toLocaleString('es-EC', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {req.product && (
                                                            <div className="mt-3 border-t border-slate-100 dark:border-slate-800/50 pt-2">
                                                                <div className="text-2xs font-bold uppercase tracking-wider text-fg-subtle mb-1 flex justify-between items-center">
                                                                    <span>Inventario en Bodegas</span>
                                                                    <span className={stockSum > 0 ? 'text-success font-bold' : 'text-danger font-bold'}>
                                                                        Total: {stockSum} uds
                                                                    </span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-1 text-[11px]">
                                                                    {req.product.inventory_levels && req.product.inventory_levels.length > 0 ? (
                                                                        req.product.inventory_levels.map((lvl, idx) => (
                                                                            <div key={idx} className="flex justify-between items-center p-1 bg-surface-2 rounded">
                                                                                <span className="text-fg-muted">Bodega {lvl.warehouse_id}</span>
                                                                                <span className={`font-semibold ${lvl.current_stock > 0 ? 'text-success dark:text-success' : 'text-slate-400'}`}>
                                                                                    {lvl.current_stock}
                                                                                </span>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="col-span-2 text-fg-subtle text-center py-1">Sin información de stock</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {req.status !== 'completed' && req.status !== 'cancelled' && (
                                                            <div className="mt-4 flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleWhatsAppNotification(req)}
                                                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold shadow-sm transition-all duration-300 flex items-center justify-center gap-1.5 hover:scale-[1.02] ${ hasStock ? 'bg-success hover:bg-success text-white animate-pulse' : 'bg-primary hover:bg-primary text-white' }`}
                                                                >
                                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                                    Notificar WA
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleBillRequest(req)}
                                                                    className="flex-1 bg-slate-900 hover:bg-black text-white dark:bg-slate-800 dark:hover:bg-slate-700 py-1.5 px-3 rounded-lg text-xs font-semibold shadow-sm transition-all duration-300 flex items-center justify-center gap-1.5 hover:scale-[1.02]"
                                                                >
                                                                    <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                                                                    Facturar POS
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
