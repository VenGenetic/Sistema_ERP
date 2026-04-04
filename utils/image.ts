/**
 * Optimiza las URLs de Supabase Storage usando su motor de transformacin de imgenes.
 * Si no es una URL de Supabase, devuelve la URL original.
 */
export function getThumbnailUrl(originalUrl: string | null | undefined, width = 100, height = 100): string | undefined {
    if (!originalUrl) return undefined;
    
    // Solo aplica si es una URL de Supabase Storage
    if (originalUrl.includes('supabase.co/storage/v1/object/public/')) {
        // Cambia 'object/public' por 'render/image/public' e inyecta los parmetros
        return originalUrl
            .replace('object/public', 'render/image/public') + 
            `?width=${width}&height=${height}&resize=contain`;
    }
    
    return originalUrl;
}
