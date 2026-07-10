import re

file_path = r'c:\Users\maxav\Documents\Sistema_ERP-main\pages\Customers.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 10. Update table rendering map
content = content.replace('filteredCustomers.map((customer) => (', 'filteredUnifiedCustomers.map((customer) => (')

# 11. Replace usages of customer inside the loop with unified customer fields
# It uses customer.id as key, customer.identification_number, customer.name, customer.is_final_consumer, customer.email, customer.phone
table_row_repl = '''
                                    <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200">
                                            {customer.posCustomer ? customer.posCustomer.identification_number : 'S/N (CRM)'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900 dark:text-white">{customer.name}</div>
                                            {customer.is_final_consumer && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 mt-1">
                                                    Consumidor Final Automático
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm">{customer.posCustomer?.email || '-'}</div>
                                            <div className="text-xs text-slate-500">{customer.phone || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                                <User className="w-3.5 h-3.5" />
                                                {customer.posCustomer ? 'POS' : 'Demanda'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const custRequests = customer.waitlistRequests.filter(r => r.status !== 'completed' && r.status !== 'cancelled');
                                                const hasStockReady = custRequests.some(r => r.product && getProductStockSum(r) > 0 && (r.status === 'pending' || r.status === 'arrived' || r.status === 'pending_stock'));
                                                const isUrgentCust = custRequests.some(r => r.is_urgent && (r.status === 'pending' || r.status === 'pending_stock'));

                                                return (
                                                    <button
                                                        onClick={() => setSelectedCustomerForDrawer(customer)}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all duration-300 hover:scale-105 ${
                                                            custRequests.length === 0
                                                                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                                                : hasStockReady
                                                                ? 'bg-emerald-500 text-white animate-pulse hover:bg-emerald-600'
                                                                : isUrgentCust
                                                                ? 'bg-amber-500 text-white hover:bg-amber-600'
                                                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50'
                                                        }`}
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
                                        <td className="px-6 py-4 text-right">
                                            {!customer.is_final_consumer && (
                                                <div className="flex items-center justify-end gap-2">
                                                    {customer.posCustomer && (
                                                        <button
                                                            onClick={() => handleOpenModal(customer.posCustomer)}
                                                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                                            title="Editar Cliente"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {customer.posCustomer && (
                                                        <button
                                                            onClick={() => handleDelete(customer.posCustomer.id)}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                                            title="Eliminar Cliente"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
'''
# Using regex to replace the old row
row_pattern = re.compile(r'<tr key=\{customer\.id\} className="hover:bg-slate-50.*?</tr\>', re.DOTALL)
content = row_pattern.sub(table_row_repl.strip(), content)


# 12. Update Drawer to fetch the specific requests correctly. Wait, they are already on the unified object!
# But drawer still uses `drawerRequests` fetched by `fetchDrawerRequests`.
# Actually, since it's now UnifiedCustomer, we can just use `customer.waitlistRequests`!
drawer_req_repl = '''
    // Update phone number and load requests inside the drawer
    useEffect(() => {
        if (selectedCustomerForDrawer) {
            setDrawerPhone(selectedCustomerForDrawer.phone || '');
            setDrawerRequests(selectedCustomerForDrawer.waitlistRequests);
            setIsLoadingDrawerRequests(false);
        } else {
            setDrawerRequests([]);
        }
    }, [selectedCustomerForDrawer]);
'''
drawer_req_pattern = re.compile(r'    // Update phone number and load requests inside the drawer.*?    }, \[selectedCustomerForDrawer\]\);', re.DOTALL)
content = drawer_req_pattern.sub(drawer_req_repl.strip(), content)

# 13. Replace handleAddRequest to work with UnifiedCustomer. Since `product_demands` and `customer_requests` are split, we insert to `customer_requests` ONLY IF POS customer exists, else `product_demands`.
add_req_repl = '''
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
'''
add_req_pattern = re.compile(r'    const handleAddRequest = async \(e: React\.FormEvent\) => \{.*?\n        \}\n    \};', re.DOTALL)
content = add_req_pattern.sub(add_req_repl.strip(), content)

# 14. Quick Action buttons in Drawer Header
header_repl = '''
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-blue-500" />
                                    Perfil Unificado de Cliente
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Cliente: <strong className="text-slate-900 dark:text-white">{selectedCustomerForDrawer.name}</strong>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(selectedCustomerForDrawer.phone);
                                        alert('Teléfono copiado');
                                    }}
                                    className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 text-xs font-semibold"
                                >
                                    <Copy className="w-4 h-4" /> Copiar
                                </button>
                                <a
                                    href={`https://wa.me/${selectedCustomerForDrawer.normalizedPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                                >
                                    <MessageSquare className="w-4 h-4" /> WhatsApp
                                </a>
                                <button 
                                    onClick={() => setSelectedCustomerForDrawer(null)}
                                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors ml-2"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
'''
# Using regex to replace the Header
header_pattern = re.compile(r'                        \{\/\* Header \*\/}.*?<\/button>\n                        <\/div>', re.DOTALL)
content = header_pattern.sub(header_repl.strip(), content)


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Phase 3 completed')
