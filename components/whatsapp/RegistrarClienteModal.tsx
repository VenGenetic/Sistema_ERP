import React, { useEffect, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Modal from '../ui/Modal';
import { button, cn, input } from '../ui/styles';

/**
 * Dar de alta al cliente sin salir del chat.
 *
 * Hasta ahora la ficha solo decía «este número no está registrado» y
 * ofrecía un enlace a Clientes. Eso significaba: perder la conversación de
 * vista, volver a escribir a mano un teléfono que el sistema ya tenía,
 * cargar el cliente, volver al chat y refrescar. En el mostrador eso no se
 * hace: se cotiza igual sin cliente, y después la venta se factura a
 * consumidor final y se pierde el historial de esa persona -- que es
 * exactamente el dato que hace falta la próxima vez que escriba.
 *
 * El teléfono viene puesto y no se toca: es el que vincula la ficha con el
 * chat (`CustomerPanel` compara los últimos 9 dígitos). Dejarlo editable
 * permitiría crear un cliente que la ficha no vuelve a encontrar.
 */

interface Props {
    isOpen: boolean;
    /** Solo dígitos, como lo guarda `agent_conversations`. */
    phoneNumber: string;
    /** Nombre del chat, si tiene. Encabeza el formulario. */
    nombreSugerido: string | null;
    onClose: () => void;
    /** Recarga la ficha con el cliente ya vinculado. */
    onRegistrado: () => void;
}

const TIPOS: ReadonlyArray<{ id: string; texto: string; ayuda: string }> = [
    { id: 'retail', texto: 'Público', ayuda: 'Precio de lista.' },
    { id: 'mechanic', texto: 'Mecánico', ayuda: 'Taller que compra seguido.' },
    { id: 'trade', texto: 'Distribuidor', ayuda: 'Revende el repuesto.' },
];

export const RegistrarClienteModal: React.FC<Props> = ({
    isOpen,
    phoneNumber,
    nombreSugerido,
    onClose,
    onRegistrado,
}) => {
    const [nombre, setNombre] = useState('');
    const [documento, setDocumento] = useState('');
    const [tipo, setTipo] = useState('retail');
    const [descuento, setDescuento] = useState('0');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setNombre(nombreSugerido?.trim() ?? '');
        setDocumento('');
        setTipo('retail');
        setDescuento('0');
        setError(null);
    }, [isOpen, nombreSugerido]);

    const doc = documento.replace(/\D/g, '');
    const pctNumero = Number(descuento.replace(',', '.'));
    const pctValido = Number.isFinite(pctNumero) && pctNumero >= 0 && pctNumero <= 100;
    /* Cédula 10, RUC 13. No se valida el dígito verificador acá: el ERP
       tampoco lo hace en Clientes, y rechazar en el chat un documento que
       la otra pantalla acepta sería peor que no validar. */
    const docValido = doc.length === 10 || doc.length === 13;
    const puedeGuardar = nombre.trim().length >= 2 && docValido && pctValido && !guardando;

    const guardar = async () => {
        if (!puedeGuardar) return;
        setGuardando(true);
        setError(null);
        try {
            const { error: err } = await supabase.from('customers').insert([
                {
                    name: nombre.trim().replace(/\s+/g, ' '),
                    identification_number: doc,
                    phone: phoneNumber,
                    customer_type: tipo,
                    discount_percentage: pctValido ? pctNumero : 0,
                    is_final_consumer: false,
                },
            ]);
            if (err) {
                // 23505 = documento repetido. Es el error frecuente y el
                // mensaje crudo de Postgres no dice qué hacer con él.
                if (err.code === '23505') {
                    throw new Error(
                        `Ya hay un cliente con el documento ${doc}. Buscalo en Clientes y agregale este teléfono.`,
                    );
                }
                throw new Error(err.message);
            }
            onRegistrado();
            onClose();
        } catch (e: any) {
            setError(e?.message ?? 'No se pudo registrar el cliente.');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={guardando ? () => {} : onClose}
            width="sm"
            title="Registrar como cliente"
            subtitle="Queda vinculado a este chat por el teléfono."
            dismissOnOverlay={!guardando}
            dismissOnEscape={!guardando}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={guardando}
                        className={cn(button.base, button.variant.secondary, button.size.md)}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => void guardar()}
                        disabled={!puedeGuardar}
                        className={cn(button.base, button.variant.primary, button.size.md)}
                    >
                        {guardando ? (
                            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                        ) : (
                            <UserPlus size={15} aria-hidden="true" />
                        )}
                        Registrar
                    </button>
                </>
            }
        >
            <form
                className="space-y-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    void guardar();
                }}
            >
                <div>
                    <label htmlFor="cliente-nombre" className="mb-1 block text-sm font-medium text-fg">
                        Nombre o razón social
                    </label>
                    <input
                        id="cliente-nombre"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        disabled={guardando}
                        autoComplete="off"
                        className={cn(input.base, input.size.md)}
                        placeholder="Taller Vélez"
                    />
                </div>

                <div>
                    <label htmlFor="cliente-doc" className="mb-1 block text-sm font-medium text-fg">
                        Cédula o RUC
                    </label>
                    <input
                        id="cliente-doc"
                        value={documento}
                        onChange={(e) => setDocumento(e.target.value)}
                        disabled={guardando}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={13}
                        className={cn(
                            input.base,
                            input.size.md,
                            input.numeric,
                            documento.trim() !== '' && !docValido && input.invalid,
                        )}
                        placeholder="1712345678"
                    />
                    {documento.trim() !== '' && !docValido && (
                        <p role="alert" className="mt-1 text-xs text-danger">
                            La cédula tiene 10 dígitos y el RUC 13. Van {doc.length}.
                        </p>
                    )}
                </div>

                <div>
                    <span className="mb-1 block text-sm font-medium text-fg">Tipo de cliente</span>
                    <div className="grid grid-cols-3 gap-1.5">
                        {TIPOS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTipo(t.id)}
                                disabled={guardando}
                                title={t.ayuda}
                                aria-pressed={tipo === t.id}
                                className={cn(
                                    button.base,
                                    button.size.sm,
                                    tipo === t.id ? button.variant.primary : button.variant.secondary,
                                )}
                            >
                                {t.texto}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label htmlFor="cliente-descuento" className="mb-1 block text-sm font-medium text-fg">
                        Descuento habitual (%)
                    </label>
                    <input
                        id="cliente-descuento"
                        value={descuento}
                        onChange={(e) => setDescuento(e.target.value)}
                        disabled={guardando}
                        inputMode="decimal"
                        autoComplete="off"
                        className={cn(
                            input.base,
                            input.size.md,
                            input.numeric,
                            'w-24',
                            !pctValido && input.invalid,
                        )}
                    />
                    {!pctValido && (
                        <p role="alert" className="mt-1 text-xs text-danger">
                            Tiene que ser un número entre 0 y 100.
                        </p>
                    )}
                    <p className="mt-1 text-xs text-fg-muted">
                        Se muestra en la ficha al cotizar, para no vender de más ni de menos.
                    </p>
                </div>

                <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-4 text-fg-muted">
                    Teléfono: <span className="tnum font-medium text-fg">{phoneNumber}</span>. Es el que
                    vincula la ficha con este chat, así que se guarda tal cual.
                </p>

                {error && (
                    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
                        {error}
                    </p>
                )}
            </form>
        </Modal>
    );
};

export default RegistrarClienteModal;
