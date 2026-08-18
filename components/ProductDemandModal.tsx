import React, { useState } from 'react';
import { useBackDismiss } from '../hooks/useBackDismiss';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { ShareDemandModal } from './ShareDemandModal';
import { isProductDiscontinued } from '../utils/discontinuedHelper';
import {
  BellRing,
  ClipboardPaste,
  Loader2,
  Save,
  TriangleAlert,
  X,
} from 'lucide-react';

const parseClipboardText = (text: string) => {
    const phoneRegex = /\+?[0-9\s\-\(\)\.]{7,20}/g;
    let match;
    let bestPhoneCandidate = '';
    let rawPhoneMatch = '';
    
    while ((match = phoneRegex.exec(text)) !== null) {
        const potentialPhone = match[0];
        const digitsCount = potentialPhone.replace(/\D/g, '').length;
        if (digitsCount >= 7 && digitsCount <= 15) {
            bestPhoneCandidate = potentialPhone;
            rawPhoneMatch = potentialPhone;
            break;
        }
    }
    
    let phone = '';
    let name = '';
    
    if (bestPhoneCandidate) {
        let cleanPhone = bestPhoneCandidate.replace(/[^0-9+]/g, '');
        if (!cleanPhone.startsWith('+')) {
            if (cleanPhone.startsWith('593') && cleanPhone.length === 12) {
                cleanPhone = '+' + cleanPhone;
            } else if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
                cleanPhone = '+593' + cleanPhone.substring(1);
            } else if (cleanPhone.length === 9) {
                cleanPhone = '+593' + cleanPhone;
            } else {
                cleanPhone = '+' + cleanPhone;
            }
        }
        phone = cleanPhone;
        
        const textWithoutPhone = text.replace(rawPhoneMatch, ' ');
        name = textWithoutPhone
            .replace(/^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+|[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (name.length > 50) {
            const nameIntroMatch = name.match(/(?:nombre\s+(?:es|de\s+la\s+persona)?\s*:?\s*|nombre\s*:\s*)([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,30})/i);
            if (nameIntroMatch && nameIntroMatch[1]) {
                name = nameIntroMatch[1].trim();
            } else {
                name = name.substring(0, 50).trim();
            }
        }

        if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(name)) {
            name = '';
        }
    } else {
        if (text.trim().length < 30 && /[a-zA-Z]/.test(text)) {
            name = text.trim();
        }
    }
    
    return { phone, name };
};

interface ProductDemandModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
}

export const ProductDemandModal: React.FC<ProductDemandModalProps> = ({
    isOpen,
    onClose,
    product
}) => {
    const { session } = useAuth();
    const user = session?.user;
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [isApproved, setIsApproved] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [createdDemand, setCreatedDemand] = useState<any>(null);

    const handlePastePhone = async () => {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            alert('Tu navegador o conexión no permite el acceso al portapapeles. Asegúrate de usar una conexión segura (HTTPS) o un navegador compatible.');
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                alert('El portapapeles está vacío.');
                return;
            }

            const parsed = parseClipboardText(text);
            if (parsed.phone) {
                setPhone(parsed.phone);
            } else {
                const cleanDigits = text.replace(/[^0-9+]/g, '');
                if (cleanDigits.length >= 7) {
                    let cleanPhone = cleanDigits;
                    if (!cleanPhone.startsWith('+')) {
                        if (cleanPhone.startsWith('593') && cleanPhone.length === 12) {
                            cleanPhone = '+' + cleanPhone;
                        } else if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
                            cleanPhone = '+593' + cleanPhone.substring(1);
                        } else if (cleanPhone.length === 9) {
                            cleanPhone = '+593' + cleanPhone;
                        } else {
                            cleanPhone = '+' + cleanPhone;
                        }
                    }
                    setPhone(cleanPhone);
                } else {
                    alert('No se pudo encontrar un número de teléfono válido en el texto copiado.');
                }
            }
        } catch (err) {
            console.error('Failed to read clipboard: ', err);
            alert('No se pudo acceder al portapapeles. Asegúrate de dar los permisos necesarios.');
        }
    };

    const handlePasteName = async () => {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            alert('Tu navegador o conexión no permite el acceso al portapapeles. Asegúrate de usar una conexión segura (HTTPS) o un navegador compatible.');
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                alert('El portapapeles está vacío.');
                return;
            }

            const phoneRegex = /\+?[0-9\s\-\(\)\.]{7,20}/g;
            let match = phoneRegex.exec(text);
            let cleanText = text;
            if (match) {
                const digitsCount = match[0].replace(/\D/g, '').length;
                if (digitsCount >= 7 && digitsCount <= 15) {
                    cleanText = text.replace(match[0], ' ');
                }
            }

            const cleanedName = cleanText
                .replace(/^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+|[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+$/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (cleanedName.length > 50) {
                setName(cleanedName.substring(0, 50));
            } else {
                setName(cleanedName);
            }
        } catch (err) {
            console.error('Failed to read clipboard: ', err);
            alert('No se pudo acceder al portapapeles. Asegúrate de dar los permisos necesarios.');
        }
    };

    // El «atrás» del teléfono cierra este modal en vez de dejar la pantalla.
    useBackDismiss(isOpen && !!product, onClose);

    if (!isOpen || !product) return null;

    const discontinued = isProductDiscontinued(product);

    if (showShare && createdDemand) {
        return (
            <ShareDemandModal 
                isOpen={true} 
                demand={createdDemand} 
                onClose={() => {
                    setShowShare(false);
                    setPhone('');
                    setName('');
                    setNotes('');
                    onClose();
                }} 
            />
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const cleanPhone = phone.trim();
        if (!cleanPhone) {
            alert('El número de teléfono es obligatorio');
            return;
        }

        if (!cleanPhone.startsWith('+')) {
            alert('El número de teléfono debe iniciar con el código de país (ej. +593 para Ecuador)');
            return;
        }

        const digitsOnly = cleanPhone.substring(1);
        if (!/^\d+$/.test(digitsOnly)) {
            alert('El teléfono solo debe contener números después del signo +');
            return;
        }

        if (digitsOnly.length < 7 || digitsOnly.length > 15) {
            alert('El número de teléfono no es válido (debe tener entre 7 y 15 dígitos)');
            return;
        }

        if (cleanPhone.startsWith('+593')) {
            const ecuadorDigits = cleanPhone.substring(4);
            if (ecuadorDigits.length !== 8 && ecuadorDigits.length !== 9) {
                alert('Para Ecuador, el número debe tener 9 dígitos (celular) u 8 dígitos (teléfono fijo) después de +593.');
                return;
            }
        }

        setLoading(true);
        try {
            // Check if active demand already exists
            const { data: existing, error: checkError } = await supabase
                .from('product_demands')
                .select('id')
                .eq('product_id', product.id)
                .eq('phone_number', phone)
                .in('status', ['pending_stock', 'stock_available'])
                .limit(1);

            if (checkError) throw checkError;

            if (existing && existing.length > 0) {
                alert('Este número ya tiene una solicitud activa para este producto.');
                setLoading(false);
                return;
            }

            const { data: insertedData, error: insertError } = await supabase
                .from('product_demands')
                .insert([{
                    product_id: product.id,
                    phone_number: phone,
                    customer_name: name || null,
                    notes: notes || null,
                    created_by: user?.id,
                    status: 'pending_stock',
                    is_approved: isApproved
                }])
                .select()
                .single();

            if (insertError) throw insertError;

            const newDemand = {
                ...insertedData,
                product: {
                    name: product.name,
                    sku: product.sku,
                    price: product.price,
                    image_url: product.image_url,
                    importer_stock: product.importer_stock,
                    inventory_levels: product.inventory_levels
                }
            };
            
            setCreatedDemand(newDemand);
            setShowShare(true);
        } catch (error: any) {
            console.error('Error saving demand:', error);
            alert(`Error al registrar la demanda: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    /*
        Anclado abajo en el teléfono (MASTER.md: las ventanas entran por
        abajo, al alcance del pulgar) y centrado a partir de `sm`, que es
        el escritorio. La versión grande no cambia.
    */
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-surface rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90dvh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <div className="flex items-center gap-2 text-fg">
                        <BellRing size={20} className="text-primary" aria-hidden="true" />
                        <h2 className="text-lg font-bold tracking-tight">Lista de Espera</h2>
                    </div>
                    <button onClick={onClose} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    <div className="mb-6 bg-surface-3 p-3 rounded-lg border border-subtle">
                        <span className="block text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">Producto Solicitado</span>
                        <span className="block font-medium text-fg line-clamp-2">{product.name}</span>
                        <span className="block font-mono text-xs text-fg-muted mt-1">{product.sku}</span>
                    </div>

                    {discontinued ? (
                        <div className="bg-danger-soft border border-danger/20 p-6 rounded-lg mb-4 flex flex-col items-center justify-center text-center">
                            <TriangleAlert size={32} className="text-danger mb-2" aria-hidden="true" />
                            <p className="text-sm font-bold text-danger">
                                Este producto se encuentra descontinuado.
                            </p>
                            <p className="text-xs text-danger mt-2">
                                No es posible añadir nuevos clientes a la lista de espera de un producto descontinuado.
                            </p>
                        </div>
                    ) : (
                        <form id="demand-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-fg">
                                        Teléfono <span className="text-danger">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handlePastePhone}
                                        className="flex items-center gap-1 text-xs text-primary hover:text-primary font-semibold transition-colors"
                                        title="Pega el teléfono desde el portapapeles"
                                    >
                                        <ClipboardPaste size={15} aria-hidden="true" />
                                        Pegar Teléfono
                                    </button>
                                </div>
                                <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                                    className="w-full px-3 py-2 border border-strong rounded-lg bg-surface text-fg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    placeholder="+593999999999"
                                />
                            </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-fg">
                                    Nombre del Cliente <span className="text-fg-subtle text-xs font-normal">(Opcional)</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handlePasteName}
                                    className="flex items-center gap-1 text-xs text-primary hover:text-primary font-semibold transition-colors"
                                    title="Pega el nombre desde el portapapeles"
                                >
                                    <ClipboardPaste size={15} aria-hidden="true" />
                                    Pegar Nombre
                                </button>
                            </div>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-strong rounded-lg bg-surface text-fg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                placeholder="Ej. Juan Pérez"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-fg mb-1">
                                Notas adicionales <span className="text-fg-subtle text-xs font-normal">(Opcional)</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 border border-strong rounded-lg bg-surface text-fg focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                                placeholder="Ej. Busca versión en color negro..."
                            />
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1 bg-surface-2 p-3 rounded-lg border border-subtle">
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isApproved) {
                                        let importerStock = 0;
                                        if (product.inventory_levels) {
                                            importerStock = product.inventory_levels.find((l: any) => l.warehouses?.type === 'digital_partner')?.current_stock || 0;
                                        }
                                        if (importerStock <= 0) {
                                            alert("No se puede aprobar: No hay stock en la importadora.\n\nDisclaimer: Si ya hay stock porque han revisado aparte, se debe solicitar a la administración la actualización del sistema con el stock visible en la importadora para poder aprobar este pedido.");
                                            return;
                                        }
                                    }
                                    setIsApproved(!isApproved);
                                }}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${ isApproved ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600' }`}
                                role="switch"
                                aria-checked={isApproved}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${ isApproved ? 'translate-x-5' : 'translate-x-0' }`}
                                />
                            </button>
                            <div>
                                <span className={`block text-sm font-semibold ${isApproved ? 'text-primary dark:text-primary' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {isApproved ? 'Pedido Aprobado en espera' : 'Pedido No Aprobado'}
                                </span>
                                <span className="block text-xs text-fg-muted">
                                    Activa esto si verificaste el stock en la importadora. (Opcional)
                                </span>
                            </div>
                        </div>
                    </form>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-subtle bg-surface-2 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-fg-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="demand-form"
                        disabled={loading || discontinued}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm shadow-primary/20"
                    >
                        {loading ? (
                            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <Save size={18} aria-hidden="true" />
                        )}
                        Registrar
                    </button>
                </div>

            </div>
        </div>
    );
};
