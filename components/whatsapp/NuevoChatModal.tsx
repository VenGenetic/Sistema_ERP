import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquarePlus, Phone, Search, UserRound } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import { cn, focusRing, input } from '../ui/styles';
import { formatPhoneDisplay, normalizePhoneEC } from '../../utils/phone';
import { abrirOCrearConversacion, colaTelefono, pareceLid } from '../../utils/conversacionesWhatsapp';
import { esTelefonoEC } from '../../utils/telefonosEnTexto';

/**
 * Empezar un chat con alguien que todavía no escribió.
 *
 * Hasta ahora la bandeja solo sabía CONTESTAR: se podía escribir en un
 * chat que ya existía y nada más. Si un cliente daba su número por
 * teléfono, o el vendedor lo tenía anotado en un papel, no había ninguna
 * forma de arrancar la conversación desde el ERP -- se escribía desde el
 * celular y eso es exactamente lo que hace que la conversación se pierda:
 * lo que se manda desde el teléfono le llega cifrado al agente y nunca
 * queda registrado.
 *
 * Un solo campo para las dos cosas (buscar y escribir el número) porque
 * son el mismo gesto: uno tipea a quién quiere escribirle. Si lo que
 * escribe se parece a un teléfono, aparece arriba la acción de abrirle el
 * chat; si se parece a un nombre, aparecen los chats que coinciden.
 *
 * El botón de abrir SIEMPRE pasa por `abrirOCrearConversacion`, que busca
 * antes de crear. Es lo que impide terminar con dos chats del mismo
 * cliente por un número escrito distinto.
 */

interface FilaEncontrada {
    id: number;
    phone_number: string;
    customer_name: string | null;
    last_message_at: string | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** La pantalla decide cómo mostrar el chat (escritorio y móvil difieren). */
    onAbrir: (conversationId: number) => void;
}

/** Cuánto se espera antes de salir a buscar, para no consultar por tecla. */
const ESPERA_MS = 280;

/**
 * PostgREST parte el filtro `or(...)` por comas y paréntesis: si van
 * dentro del texto buscado, la consulta sale rota (error 400, la búsqueda
 * no devuelve nada y parece que el cliente no existe). Se quitan, junto
 * con los comodines, que si no permiten armar patrones desde el buscador.
 */
function limpiarParaFiltro(texto: string): string {
    return texto.replace(/[,()*%\\]/g, ' ').trim();
}

export const NuevoChatModal: React.FC<Props> = ({ isOpen, onClose, onAbrir }) => {
    const [texto, setTexto] = useState('');
    const [nombre, setNombre] = useState('');
    const [resultados, setResultados] = useState<FilaEncontrada[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [abriendo, setAbriendo] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const campoRef = useRef<HTMLInputElement>(null);
    const busquedaRef = useRef(0);
    const abriendoRef = useRef(false);

    // Cada apertura empieza limpia: dejar el número del cliente anterior
    // cargado es el camino corto a escribirle al equivocado.
    useEffect(() => {
        busquedaRef.current += 1;
        if (!isOpen) return;
        setTexto('');
        setNombre('');
        setResultados([]);
        setError(null);
        setAbriendo(false);
    }, [isOpen]);

    /*
        El Modal enfoca el primer control que encuentra, que es la equis de
        cerrar. Acá el primer control útil es el campo: esta pantalla se
        abre para escribir un número, y aparecer con el foco en «cerrar»
        obliga a un toque de más cada vez.

        Va en el cuadro SIGUIENTE y no en este: el Modal enfoca dentro de
        un `requestAnimationFrame` propio, así que enfocar en el mismo
        cuadro sería pelearse por el foco y perder.
    */
    useEffect(() => {
        if (!isOpen) return;
        let segundo = 0;
        const primero = requestAnimationFrame(() => {
            segundo = requestAnimationFrame(() => campoRef.current?.focus());
        });
        return () => {
            cancelAnimationFrame(primero);
            cancelAnimationFrame(segundo);
        };
    }, [isOpen]);

    const numero = useMemo(() => (esTelefonoEC(texto) ? normalizePhoneEC(texto) : null), [texto]);

    const buscar = useCallback(async (consulta: string) => {
        const turno = ++busquedaRef.current;
        const limpio = limpiarParaFiltro(consulta);
        const digitos = limpio.replace(/\D/g, '');
        if (limpio.length < 2 && digitos.length < 3) {
            setResultados([]);
            setBuscando(false);
            setError(null);
            return;
        }

        setBuscando(true);
        try {
            // En un `.or()` de PostgREST el comodín es `*`, no `%`.
            const condiciones = [`customer_name.ilike.*${limpio}*`];
            // Por la COLA del número: en la base está `593…` y acá se puede
            // haber escrito `09…`, así que buscar el texto entero no
            // encuentra nada. Con 3 dígitos ya vale la pena.
            if (digitos.length >= 3) condiciones.push(`phone_number.like.*${colaTelefono(digitos)}*`);

            const { data, error: err } = await supabase
                .from('agent_conversations')
                .select('id, phone_number, customer_name, last_message_at')
                .or(condiciones.join(','))
                .order('last_message_at', { ascending: false, nullsFirst: false })
                .limit(8);
            if (err) throw err;
            if (turno !== busquedaRef.current) return;
            setResultados((data ?? []) as FilaEncontrada[]);
        } catch (err: any) {
            if (turno !== busquedaRef.current) return;
            setError(err?.message ?? 'No se pudo buscar.');
        } finally {
            if (turno === busquedaRef.current) setBuscando(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const t = setTimeout(() => buscar(texto), ESPERA_MS);
        return () => clearTimeout(t);
    }, [texto, isOpen, buscar]);

    const abrirNumero = async () => {
        if (!numero || abriendoRef.current) return;
        abriendoRef.current = true;
        setAbriendo(true);
        setError(null);
        try {
            const { id } = await abrirOCrearConversacion(numero, nombre);
            onAbrir(id);
            onClose();
        } catch (err: any) {
            setError(err?.message ?? 'No se pudo abrir el chat.');
        } finally {
            abriendoRef.current = false;
            setAbriendo(false);
        }
    };

    const abrirExistente = (id: number) => {
        onAbrir(id);
        onClose();
    };

    /* Un chat ya cargado en los resultados que sea ESTE mismo número: si
       está, la fila de arriba dice «abrir» y no «empezar». */
    const yaExiste = numero
        ? resultados.find((r) => !pareceLid(r.phone_number) && colaTelefono(r.phone_number) === colaTelefono(numero))
        : undefined;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Chat nuevo"
            subtitle="Buscá al cliente o escribí el número al que le querés escribir."
            width="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={abrirNumero}
                        disabled={!numero}
                        loading={abriendo}
                        icon={<MessageSquarePlus size={15} aria-hidden="true" />}
                    >
                        {yaExiste ? 'Abrir el chat' : 'Empezar el chat'}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div>
                    <label htmlFor="chat-nuevo-busqueda" className="mb-1.5 block text-sm font-medium text-fg">
                        Teléfono o nombre
                    </label>
                    <div className="relative">
                        <Search
                            size={16}
                            className={input.leadingIcon}
                            aria-hidden="true"
                        />
                        <input
                            id="chat-nuevo-busqueda"
                            ref={campoRef}
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && numero && !abriendo) {
                                    e.preventDefault();
                                    abrirNumero();
                                }
                            }}
                            placeholder="0999123456  ·  Juan Pérez"
                            autoComplete="off"
                            className={cn(input.base, input.size.lg, input.withLeadingIcon, 'pr-9')}
                        />
                        {buscando && (
                            <Loader2
                                size={15}
                                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-fg-muted"
                                aria-hidden="true"
                            />
                        )}
                    </div>
                    <p className="mt-1.5 text-xs text-fg-muted">
                        {numero
                            ? `Se le va a escribir a ${formatPhoneDisplay(numero)}.`
                            : texto.trim()
                              ? 'Escribí el número completo (0999123456) para poder abrirle un chat.'
                              : 'Celular o convencional del Ecuador.'}
                    </p>
                </div>

                {/* El nombre solo cuando de verdad se va a crear el chat: en
                    los que ya existen lo pone WhatsApp y pisarlo acá sería
                    cambiarle el nombre al cliente sin querer. */}
                {numero && !yaExiste && (
                    <div>
                        <label htmlFor="chat-nuevo-nombre" className="mb-1.5 block text-sm font-medium text-fg">
                            Nombre <span className="font-normal text-fg-muted">(opcional)</span>
                        </label>
                        <div className="relative">
                            <UserRound
                                size={16}
                                className={input.leadingIcon}
                                aria-hidden="true"
                            />
                            <input
                                id="chat-nuevo-nombre"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Cómo lo tenés anotado"
                                autoComplete="off"
                                className={cn(input.base, input.size.lg, input.withLeadingIcon)}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">{error}</p>
                )}

                {resultados.length > 0 && (
                    <div>
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted">
                            Chats que ya existen
                        </p>
                        <ul className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle">
                            {resultados.map((r) => (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        onClick={() => abrirExistente(r.id)}
                                        className={cn(
                                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover',
                                            focusRing,
                                        )}
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
                                            {r.customer_name ? (
                                                <span className="text-[13px] font-semibold">
                                                    {r.customer_name.trim().charAt(0).toUpperCase()}
                                                </span>
                                            ) : (
                                                <Phone size={14} aria-hidden="true" />
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-fg">
                                                {r.customer_name?.trim() ||
                                                    (pareceLid(r.phone_number)
                                                        ? 'Contacto de WhatsApp'
                                                        : formatPhoneDisplay(r.phone_number))}
                                            </span>
                                            {!pareceLid(r.phone_number) && (
                                                <span className="block truncate text-xs tabular-nums text-fg-muted">
                                                    {formatPhoneDisplay(r.phone_number)}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {!buscando && texto.trim().length >= 2 && resultados.length === 0 && (
                    <p className="flex items-center gap-2 text-sm text-fg-muted">
                        <MessageSquarePlus size={15} aria-hidden="true" />
                        {numero
                            ? 'Nadie con ese número escribió todavía. Se le abre un chat nuevo.'
                            : 'Ningún chat coincide.'}
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default NuevoChatModal;
