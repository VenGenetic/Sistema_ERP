import re

file_path = r'c:\Users\maxav\Documents\Sistema_ERP-main\pages\Customers.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 15. Add Orders state to the component
state_add = '''
    const [drawerOrders, setDrawerOrders] = useState<any[]>([]);
    const [isLoadingDrawerOrders, setIsLoadingDrawerOrders] = useState(false);
'''
content = content.replace('    const [isLoadingDrawerRequests, setIsLoadingDrawerRequests] = useState(false);', '    const [isLoadingDrawerRequests, setIsLoadingDrawerRequests] = useState(false);\n' + state_add)

# 16. Fetch Orders when Drawer opens
orders_fetch = '''
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
'''
content = content.replace('            setIsLoadingDrawerRequests(false);\n        } else {', '            setIsLoadingDrawerRequests(false);\n' + orders_fetch + '\n        } else {')


# 17. Add Purchase History UI into Drawer body
# Find the start of the drawer body scrollable area, which is after the header.
# Wait, drawer body usually has a <div className="p-6 overflow-y-auto"> or similar.
# Actually, the user wants to see "sus compras y registros en demanda". Let's insert it above the Waitlist section or as a Tab inside the Drawer.
# Let's add a simple History section below the Notes form or above it.
history_ui = '''
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Historial de Compras (POS)</h3>
                            {isLoadingDrawerOrders ? (
                                <p className="text-xs text-slate-500">Cargando compras...</p>
                            ) : drawerOrders.length === 0 ? (
                                <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                    No hay compras registradas en el POS para este cliente.
                                </p>
                            ) : (
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                    {drawerOrders.map(order => (
                                        <div key={order.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                                    Orden #{order.id}
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    {new Date(order.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {order.order_items?.map((item: any) => (
                                                    <div key={item.id} className="flex justify-between text-xs">
                                                        <span className="text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                                                            {item.quantity}x {item.product?.name || 'Producto Desconocido'}
                                                        </span>
                                                        <span className="text-slate-900 dark:text-slate-300 font-medium">
                                                            ${(item.unit_price * item.quantity).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total:</span>
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">${order.total?.toFixed(2) || '0.00'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
'''

# Find the form and insert history_ui above it
# We can find `<div className="flex-1 overflow-y-auto">` and prepend it
content = content.replace('<div className="flex-1 overflow-y-auto">', '<div className="flex-1 overflow-y-auto">\n' + history_ui)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Phase 4 completed')
