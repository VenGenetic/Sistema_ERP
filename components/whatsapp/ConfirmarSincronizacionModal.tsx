import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import ConfirmDialog from '../ui/ConfirmDialog';

interface Props {
    isOpen: boolean;
    conversationId: number | null;
    nombre: string;
    onClose: () => void;
    onConfirmed: (conversationId: number) => void;
}

/**
 * Una confirmación explícita para el caso excepcional en que una persona
 * verificó el historial del cliente fuera de la reconciliación automática.
 *
 * No enciende el bot ni recupera mensajes: sólo quita la barrera de
 * sincronización de ESTA conversación. La función SQL conserva la auditoría
 * y vuelve a bloquearla si hay una desconexión posterior.
 */
const ConfirmarSincronizacionModal: React.FC<Props> = ({
    isOpen,
    conversationId,
    nombre,
    onClose,
    onConfirmed,
}) => {
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setGuardando(false);
        }
    }, [isOpen, conversationId]);

    const cerrar = () => {
        if (guardando) return;
        setError(null);
        onClose();
    };

    const confirmar = async () => {
        if (conversationId === null || guardando) return;
        setGuardando(true);
        setError(null);

        const { error: rpcError } = await supabase.rpc('confirmar_sincronizacion_manual', {
            p_conversation_id: conversationId,
        });

        if (rpcError) {
            setError(
                rpcError.code === 'PGRST202'
                    ? 'Falta aplicar la actualización de base de datos para confirmar la sincronización.'
                    : rpcError.message || 'No se pudo confirmar la sincronización de este chat.',
            );
            setGuardando(false);
            return;
        }

        onConfirmed(conversationId);
        setGuardando(false);
        onClose();
    };

    return (
        <ConfirmDialog
            isOpen={isOpen && conversationId !== null}
            title="Confirmar historial para la IA"
            description={
                <>
                    Confirmás que el historial de <strong>{nombre}</strong> está completo y que la IA puede usarlo
                    para responder. Esto sólo elimina el bloqueo de sincronización: la IA seguirá sin contestar si
                    este chat está asignado a una persona, está cerrado o el agente no está activado.
                </>
            }
            confirmLabel="Permitir respuestas de la IA"
            cancelLabel="Cancelar"
            tono="warning"
            error={error}
            loading={guardando}
            onConfirm={() => void confirmar()}
            onClose={cerrar}
        />
    );
};

export default ConfirmarSincronizacionModal;
