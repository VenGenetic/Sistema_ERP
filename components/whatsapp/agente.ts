import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

/**
 * El estado del proceso del agente, y qué significa para quien está por
 * escribirle a un cliente.
 *
 * Vive acá y no en cada pantalla porque la REGLA es una sola: si el agente
 * está caído, desconectado de WhatsApp o con la salida bloqueada, lo que se
 * escriba queda en cola y no sale. Tener esa regla escrita dos veces
 * significa que un día la bandeja avisa y el modo móvil no -- y ahí alguien
 * escribe tres veces al vacío desde el mostrador.
 */

/** Fila de `agent_settings` (migración 0027). */
export interface EstadoAgente {
    agent_last_seen_at: string | null;
    agent_connection: 'connected' | 'connecting' | 'disconnected' | null;
    agent_outbound_mode: 'blocked' | 'erp_only' | 'full' | null;
}

/**
 * Cuánto puede tardar el latido antes de dar el proceso por caído. El
 * agente late cada 30s, así que 2 minutos tolera un par de fallos seguidos
 * sin dar una falsa alarma.
 */
export const LATIDO_MAXIMO_MS = 2 * 60 * 1000;

/** "recién" / "hace 5 min" / "hace 3 h" / "hace 2 d". */
export function haceCuanto(iso: string): string {
    const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutos < 1) return 'recién';
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    return `hace ${Math.round(horas / 24)} d`;
}

export interface AvisoDeEnvio {
    titulo: string;
    detalle: string;
}

/**
 * Qué hay que avisar antes de escribir, o `null` si todo está bien.
 *
 * `hace` traduce una fecha a "hace 5 min": cada pantalla pasa la suya para
 * no arrastrar acá una dependencia de formato.
 */
export function avisoDeEnvio(
    estado: EstadoAgente | null,
    hace: (iso: string) => string,
): AvisoDeEnvio | null {
    if (!estado) return null;

    const ultimo = estado.agent_last_seen_at ? new Date(estado.agent_last_seen_at).getTime() : 0;
    if (!ultimo || Date.now() - ultimo > LATIDO_MAXIMO_MS) {
        return {
            titulo: 'El agente está caído',
            detalle: ultimo
                ? `No da señales desde ${hace(estado.agent_last_seen_at!)}. Lo que escribas queda en cola y sale cuando vuelva.`
                : 'Nunca reportó estar activo. Lo que escribas queda en cola y sale cuando arranque.',
        };
    }
    if (estado.agent_connection !== 'connected') {
        return {
            titulo: 'El agente no está conectado a WhatsApp',
            detalle: 'Está intentando reconectar. Los mensajes quedan en cola y salen cuando la sesión vuelva.',
        };
    }
    if (estado.agent_outbound_mode === 'blocked') {
        return {
            titulo: 'La salida a clientes está bloqueada en el servidor',
            detalle:
                'Con OUTBOUND_MODE=blocked no sale nada, ni siquiera lo que escribas vos. Hay que cambiarlo en el .env del agente.',
        };
    }
    return null;
}

/** Cada cuánto se relee el latido. Igual que en la bandeja de escritorio. */
const CADA_MS = 30_000;

/**
 * Estado del agente + interruptor maestro, listos para usar.
 *
 * Lo usa el modo móvil. La bandeja de escritorio hace su propia lectura
 * porque ya la tiene enganchada a su botón "Actualizar" y a su canal de
 * realtime, pero la REGLA de qué avisar sale de `avisoDeEnvio`, que es la
 * misma para las dos.
 */
export function useAgente(userId: string | null) {
    const [estado, setEstado] = useState<EstadoAgente | null>(null);
    /** `null` mientras no se sabe: no es lo mismo que "apagado". */
    const [globalEncendido, setGlobalEncendido] = useState<boolean | null>(null);
    /**
     * Los dos agentes, por separado. El de RECEPCIÓN junta los datos del
     * repuesto; el VENDEDOR cotiza contra el catálogo.
     *
     * Están aparte del maestro porque el punto de partida real del
     * negocio es "recepción automática + vendedor humano", y eso no se
     * puede expresar con un solo interruptor. El maestro sigue mandando
     * por encima: apagado, no contesta ninguno.
     */
    const [agentes, setAgentes] = useState<{ recepcion: boolean; ventas: boolean } | null>(null);

    const leer = useCallback(async () => {
        const { data, error } = await supabase
            .from('agent_settings')
            .select(
                'agent_last_seen_at, agent_connection, agent_outbound_mode, bot_auto_reply_enabled, intake_agent_enabled, sales_agent_enabled',
            )
            .eq('id', 1)
            .maybeSingle();
        if (error || !data) {
            setEstado(null);
            return;
        }
        const fila = data as EstadoAgente & { bot_auto_reply_enabled?: boolean };
        setEstado({
            agent_last_seen_at: fila.agent_last_seen_at,
            agent_connection: fila.agent_connection,
            agent_outbound_mode: fila.agent_outbound_mode,
        });
        setGlobalEncendido(Boolean(fila.bot_auto_reply_enabled));
        // Si la migración 0035 no corrió, las columnas no vienen: queda en
        // null y la pantalla no muestra los interruptores, en vez de
        // mostrarlos apagados y hacer creer que el agente está frenado.
        const conAgentes = data as { intake_agent_enabled?: boolean; sales_agent_enabled?: boolean };
        setAgentes(
            conAgentes.intake_agent_enabled === undefined
                ? null
                : {
                      recepcion: Boolean(conAgentes.intake_agent_enabled),
                      ventas: Boolean(conAgentes.sales_agent_enabled),
                  },
        );
    }, []);

    useEffect(() => {
        leer();
        const t = setInterval(leer, CADA_MS);
        return () => clearInterval(t);
    }, [leer]);

    /**
     * Interruptor MAESTRO. Apagado, el agente no le contesta a nadie aunque
     * una conversación esté habilitada. Devuelve el error para que la
     * pantalla lo muestre: creer que quedó apagado cuando sigue encendido es
     * exactamente el error que no se puede permitir.
     */
    const alternarGlobal = useCallback(async (): Promise<string | null> => {
        if (globalEncendido === null) return null;
        const { error } = await supabase
            .from('agent_settings')
            .update({
                bot_auto_reply_enabled: !globalEncendido,
                updated_at: new Date().toISOString(),
                updated_by: userId,
            })
            .eq('id', 1);
        await leer();
        return error ? `No se pudo cambiar el interruptor general: ${error.message}` : null;
    }, [globalEncendido, userId, leer]);

    /**
     * Prende o apaga uno de los dos agentes. Devuelve el error para que la
     * pantalla lo muestre: igual que con el maestro, creer que quedó
     * apagado cuando sigue encendido es el error que no se puede permitir.
     */
    const alternarAgente = useCallback(
        async (cual: 'recepcion' | 'ventas'): Promise<string | null> => {
            if (!agentes) return null;
            const columna = cual === 'recepcion' ? 'intake_agent_enabled' : 'sales_agent_enabled';
            const { error } = await supabase
                .from('agent_settings')
                .update({ [columna]: !agentes[cual], updated_at: new Date().toISOString(), updated_by: userId })
                .eq('id', 1);
            await leer();
            const nombre = cual === 'recepcion' ? 'de recepción' : 'vendedor';
            return error ? `No se pudo cambiar el agente ${nombre}: ${error.message}` : null;
        },
        [agentes, userId, leer],
    );

    return { estado, globalEncendido, agentes, recargar: leer, alternarGlobal, alternarAgente };
}
