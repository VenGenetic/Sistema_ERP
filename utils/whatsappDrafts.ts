/** Borradores locales, separados por conversacion. Nunca se envian solos. */
const PREFIJO = 'whatsapp_inbox_draft_v1:';

function clave(conversationId: number, userId: string | null): string {
    return `${PREFIJO}${userId ?? 'anon'}:${conversationId}`;
}

export function leerBorradorWhatsApp(conversationId: number, userId: string | null): string {
    try {
        return localStorage.getItem(clave(conversationId, userId)) ?? '';
    } catch {
        return '';
    }
}

export function guardarBorradorWhatsApp(conversationId: number, userId: string | null, texto: string): void {
    try {
        if (texto.trim()) localStorage.setItem(clave(conversationId, userId), texto);
        else localStorage.removeItem(clave(conversationId, userId));
    } catch {
        // La caja de texto sigue funcionando si el navegador bloquea storage.
    }
}

export function borrarBorradorWhatsApp(conversationId: number, userId: string | null): void {
    try {
        localStorage.removeItem(clave(conversationId, userId));
    } catch {
        // Enviar no depende del almacenamiento local.
    }
}
