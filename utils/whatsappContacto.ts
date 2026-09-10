import { supabase } from '../supabaseClient';

/**
 * El nombre con el que se ve un chat en la bandeja.
 *
 * WhatsApp solo entrega el nombre que el propio cliente puso en su perfil,
 * y eso en un negocio de repuestos casi nunca sirve: llegan chats que se
 * llaman «.», «Mecanica», un emoji, o directamente nada -- y entonces la
 * lista muestra el número pelado. Con treinta chats abiertos, encontrar «el
 * de la Dmax blanca» entre nueve números de diez dígitos es el cuello de
 * botella real del mostrador.
 *
 * Se escribe SOLO en `agent_conversations.customer_name`, que es un campo
 * nuestro. Deliberadamente NO se toca `customers.name` del ERP aunque haya
 * un cliente vinculado: ese nombre es el que sale impreso en facturas y
 * proformas, y renombrar un chat para reconocerlo no puede cambiarle la
 * razón social a nadie.
 *
 * El proceso del agente vuelve a escribir este campo cuando el cliente
 * cambia su perfil de WhatsApp (ver el repo `agente/`). Por eso el nombre
 * puesto a mano puede volver atrás: es una etiqueta de trabajo, no un dato
 * maestro. El modal lo dice.
 */

export const MAX_NOMBRE_CONTACTO = 60;

/** Guarda el nombre del chat, o lo devuelve al que trae WhatsApp con `null`. */
export async function guardarNombreContacto(
    conversationId: number,
    nombre: string | null,
): Promise<string | null> {
    const limpio = nombre?.trim().replace(/\s+/g, ' ').slice(0, MAX_NOMBRE_CONTACTO) || null;

    const { error } = await supabase
        .from('agent_conversations')
        .update({ customer_name: limpio })
        .eq('id', conversationId);

    if (error) {
        // 42501 = lo bloqueó una política RLS. Decirlo con nombre y apellido
        // ahorra buscar el error en la consola de Supabase.
        if (error.code === '42501') {
            throw new Error('Tu usuario no tiene permiso para renombrar chats.');
        }
        throw new Error(`No se pudo guardar el nombre: ${error.message}`);
    }

    return limpio;
}
