import { supabase } from '../supabaseClient';

const BUCKET = 'payment_receipts';
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Convierte tanto las URL públicas antiguas como los valores nuevos en una
 * ruta interna del bucket. La columna conserva su nombre histórico, pero ya
 * no guarda una URL que cualquiera pueda abrir.
 */
export function paymentReceiptPath(storedValue: string | null | undefined): string | null {
    const value = storedValue?.trim();
    if (!value) return null;

    const bucketMarker = `/${BUCKET}/`;
    const markerIndex = value.indexOf(bucketMarker);
    if (markerIndex >= 0) {
        const encodedPath = value.slice(markerIndex + bucketMarker.length).split('?')[0];
        try {
            return decodeURIComponent(encodedPath);
        } catch {
            return encodedPath;
        }
    }

    return value.replace(new RegExp(`^${BUCKET}/`), '').split('?')[0] || null;
}

/** Crea una URL temporal solo para el usuario autenticado que abre la orden. */
export async function signedPaymentReceiptUrl(
    storedValue: string | null | undefined,
): Promise<string | null> {
    const path = paymentReceiptPath(storedValue);
    if (!path) return null;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error) {
        console.error('No se pudo firmar el comprobante de pago:', error.message);
        return null;
    }
    return data.signedUrl;
}
