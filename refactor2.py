import re

file_path = r'c:\Users\maxav\Documents\Sistema_ERP-main\pages\Customers.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 6. Change Drawer state to use UnifiedCustomer
content = content.replace('const [selectedCustomerForDrawer, setSelectedCustomerForDrawer] = useState<Customer | null>(null);', 'const [selectedCustomerForDrawer, setSelectedCustomerForDrawer] = useState<UnifiedCustomer | null>(null);')

# 7. Modify `handleSaveDrawerPhone` to use unified customer
handle_save_repl = '''    const handleSaveDrawerPhone = async () => {
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
'''
# Using regex to replace the old handleSaveDrawerPhone completely
pattern = re.compile(r'    const handleSaveDrawerPhone = async \(\) => \{.*?\};', re.DOTALL)
content = pattern.sub(handle_save_repl.strip(), content)

# 8. Modify the Table render logic (Tabs and mapping)
tabs_ui = '''
            {/* TABS */}
            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-4 max-w-fit">
                <button
                    onClick={() => setActiveTab('waitlist')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'waitlist' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    CRM Lista de Espera (Teléfonos)
                </button>
                <button
                    onClick={() => setActiveTab('pos')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'pos' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Clientes Facturación POS
                </button>
            </div>
'''
content = content.replace('<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">', tabs_ui + '\n            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">')

# 9. Modify filteredCustomers logic
filter_repl = '''
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
'''
# Find `const filteredCustomers = customers.filter(c => {` and replace up to `return matchesRequests;\n    });`
content = re.sub(r'    const filteredCustomers = customers\.filter\(c => \{.*?return matchesRequests;\n    \}\);', filter_repl.strip(), content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Phase 2 completed')
