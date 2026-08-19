/**
 * Devuelve la URL con la que mostrar una imagen de producto.
 *
 * Antes reescribía todas las URLs al transformador de Supabase
 * (`render/image/public`), que se factura aparte: se cobra por "imagen origen",
 * es decir cada imagen distinta que se transforma durante el mes. Con ~5.800
 * productos con foto eso significaba ~5.700 imágenes origen mensuales, unos $30
 * de excedente sobre el plan Pro.
 *
 * No compensaba. El 97,6% del catálogo ya son WebP de ~16 KB, así que la
 * transformación gastaba dinero para ahorrar unos pocos KB por miniatura, y
 * encima sumaba latencia: la primera petición de cada variante la genera el
 * servidor al vuelo. Las pocas imágenes pesadas que quedaban (PNG de ~800 KB
 * subidos crudos desde la app) se convirtieron a WebP una sola vez con
 * scripts/optimize_product_images.py, y las nuevas se comprimen antes de subirse
 * (utils/imageCompression.ts), de modo que ya no hay nada que transformar.
 *
 * Se conservan los parámetros de tamaño aunque no se usen: documentan a qué
 * tamaño se muestra cada imagen en cada pantalla y evitan tocar las ~20
 * llamadas existentes. Si alguna vez hiciera falta volver a transformar algo
 * puntual, el sitio para hacerlo es este.
 */
export function getThumbnailUrl(
    originalUrl: string | null | undefined,
    _width = 100,
    _height = 100
): string | undefined {
    return originalUrl || undefined;
}
