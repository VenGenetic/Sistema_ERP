import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ProductoCatalogo } from '../utils/whatsappOutbox';

/**
 * Los repuestos de los que se está hablando en cada chat.
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * El software razonaba en modales y el vendedor razona en "este repuesto
 * para este cliente". Enviar al catálogo, cotizar y anotar un pedido eran
 * tres pantallas distintas, cada una con su propia caja de búsqueda y cada
 * una naciendo VACÍA. Así que encontrar un repuesto una vez no servía de
 * nada: para la segunda acción había que volver a buscarlo, y para la
 * tercera otra vez. Con nombres como "balinera rueda trasera BWS 125" eso
 * son tres búsquedas y tres oportunidades de elegir el repuesto equivocado.
 *
 * Acá el repuesto se busca UNA vez y queda a mano, pegado a la
 * conversación, hasta que se lo saca.
 *
 * POR QUÉ POR CONVERSACIÓN Y NO GLOBAL
 * ------------------------------------
 * Por lo mismo que `useChatProformaStore`, que es el patrón que esto sigue:
 * quien atiende lleva varios chats a la vez -- arma lo de un cliente, lo
 * interrumpe otro, vuelve al primero. Una bandeja global le mandaría a un
 * cliente los repuestos del otro, que es el peor error posible en esta
 * pantalla.
 *
 * POR QUÉ localStorage Y NO LA BASE
 * ---------------------------------
 * Mismo criterio que el borrador de proforma. Es trabajo en curso de UNA
 * persona en UNA sesión: sobrevive al F5, al cambio de página y al día
 * siguiente, que es lo que hacía falta. No se comparte entre dispositivos,
 * y esa es una limitación conocida, no un olvido: llevarlo a la base
 * obligaría a tabla, RLS y sincronización para un dato que se descarta a
 * las pocas horas.
 */

/**
 * Lo que se guarda de cada repuesto.
 *
 * Es una FOTO del catálogo en el momento de guardarlo, no una referencia.
 * Guardar sólo el id obligaría a consultar la base para pintar la bandeja,
 * y entonces la bandeja no podría dibujarse hasta que respondiera -- justo
 * lo contrario de lo que se busca. El precio y el stock se refrescan
 * igualmente al usarlos, porque para eso cada acción vuelve a leer el
 * producto.
 */
export interface RepuestoEnBandeja {
    productId: number;
    sku: string;
    name: string;
    imageUrl: string | null;
    price: number | null;
    /** Cuándo se guardó. Ordena la bandeja: lo último hablado va primero. */
    guardadoEn: number;
}

interface Estado {
    /** conversationId -> repuestos, del más reciente al más viejo. */
    porConversacion: Record<number, RepuestoEnBandeja[]>;

    obtener: (conversationId: number) => RepuestoEnBandeja[];
    tiene: (conversationId: number, productId: number) => boolean;
    guardar: (conversationId: number, producto: ProductoCatalogo) => void;
    alternar: (conversationId: number, producto: ProductoCatalogo) => void;
    quitar: (conversationId: number, productId: number) => void;
    limpiar: (conversationId: number) => void;
}

/**
 * La lista vacía, como CONSTANTE compartida.
 *
 * No es un detalle de estilo. Un selector de zustand que devuelva `[]`
 * recién creado entrega una referencia nueva en cada llamada, y como la
 * comparación por defecto es `Object.is`, el componente se vuelve a pintar
 * cada vez que cambia CUALQUIER conversación -- incluso las que no está
 * mirando. Con una constante, una bandeja vacía compara igual a sí misma.
 */
export const BANDEJA_VACIA: RepuestoEnBandeja[] = [];

const VACIA = BANDEJA_VACIA;

/**
 * Tope de repuestos por conversación.
 *
 * No es por memoria -- son cuatro campos por repuesto -- sino porque una
 * bandeja de treinta deja de ser un atajo y se vuelve otra lista que hay
 * que leer. Al pasarse, se cae el más viejo: en una conversación de
 * repuestos, lo que se habló hace veinte búsquedas ya no está en juego.
 */
const TOPE = 12;

function editar(
    estado: Estado,
    conversationId: number,
    cambio: (lista: RepuestoEnBandeja[]) => RepuestoEnBandeja[],
): Pick<Estado, 'porConversacion'> {
    const actual = estado.porConversacion[conversationId] ?? VACIA;
    return { porConversacion: { ...estado.porConversacion, [conversationId]: cambio(actual) } };
}

export const useBandejaStore = create<Estado>()(
    persist(
        (set, get) => ({
            porConversacion: {},

            obtener: (conversationId) => get().porConversacion[conversationId] ?? VACIA,

            tiene: (conversationId, productId) =>
                (get().porConversacion[conversationId] ?? VACIA).some((r) => r.productId === productId),

            guardar: (conversationId, producto) =>
                set((s) =>
                    editar(s, conversationId, (lista) => {
                        const nuevo: RepuestoEnBandeja = {
                            productId: producto.product_id,
                            sku: producto.sku,
                            name: producto.name,
                            imageUrl: producto.image_url,
                            price: producto.price,
                            guardadoEn: Date.now(),
                        };
                        // Volver a guardar algo que ya estaba NO lo duplica: lo
                        // sube al frente. Guardar dos veces el mismo repuesto es
                        // lo que pasa cuando alguien lo busca otra vez sin
                        // acordarse de que ya lo tenía, y el resultado esperado
                        // es tenerlo a mano, no tenerlo dos veces.
                        const resto = lista.filter((r) => r.productId !== producto.product_id);
                        return [nuevo, ...resto].slice(0, TOPE);
                    }),
                ),

            alternar: (conversationId, producto) => {
                const puesto = get().tiene(conversationId, producto.product_id);
                if (puesto) get().quitar(conversationId, producto.product_id);
                else get().guardar(conversationId, producto);
            },

            quitar: (conversationId, productId) =>
                set((s) => editar(s, conversationId, (lista) => lista.filter((r) => r.productId !== productId))),

            limpiar: (conversationId) =>
                set((s) => {
                    const copia = { ...s.porConversacion };
                    delete copia[conversationId];
                    return { porConversacion: copia };
                }),
        }),
        {
            name: 'chat-bandeja-repuestos-v1',
            storage: createJSONStorage(() => localStorage),
        },
    ),
);
