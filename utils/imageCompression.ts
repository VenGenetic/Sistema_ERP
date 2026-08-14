/**
 * imageCompression.ts
 * Reduce las fotos antes de subirlas a Supabase Storage.
 *
 * Existe porque ningún camino de subida comprimía nada: una foto sacada con el
 * celular entraba tal cual, de 3 a 5 MB. El catálogo tapaba ese peso pidiendo
 * miniaturas al transformador de imágenes de Supabase, que se factura por
 * imagen origen y terminó costando ~$30 mensuales de excedente. Comprimiendo
 * en el navegador el archivo ya llega liviano y no hace falta transformar nada
 * después (ver utils/image.ts).
 *
 * El resultado apunta al mismo perfil que el 97% del catálogo, que vino
 * optimizado del import original: WebP de unas pocas decenas de KB. A 1600px
 * de lado mayor sigue habiendo resolución de sobra para verlo en pantalla
 * completa y para la ficha que se comparte por WhatsApp (1200x1200).
 */

const MAX_SIDE = 1600;
const QUALITY = 0.82;

// Por debajo de esto no vale la pena recomprimir: el ahorro es marginal y
// volver a codificar sólo degrada la imagen.
const SKIP_BELOW_BYTES = 120 * 1024;

const loadImage = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo leer la imagen'));
        };
        img.src = url;
    });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/** Cambia la extensión del nombre para que coincida con el formato real. */
const withExtension = (name: string, ext: string): string => {
    const base = name.replace(/\.[^./\\]+$/, '') || 'imagen';
    return `${base}.${ext}`;
};

/**
 * Devuelve una versión liviana en WebP del archivo, o el archivo original si no
 * conviene o no se puede convertir.
 *
 * Nunca lanza: una subida que funciona con un archivo pesado es mejor que una
 * que falla por un problema de compresión. Los formatos que el navegador no
 * sabe decodificar en un canvas (HEIC de iPhone, por ejemplo) caen solos en ese
 * camino y suben tal cual.
 */
export const compressImageForUpload = async (file: File): Promise<File> => {
    // Los videos de la galería pasan por el mismo formulario que las fotos.
    if (!file.type.startsWith('image/')) return file;

    // Los GIF perderían la animación al pasar por el canvas.
    if (file.type === 'image/gif') return file;

    if (file.size <= SKIP_BELOW_BYTES) return file;

    try {
        const img = await loadImage(file);
        const { width, height } = img;
        if (!width || !height) return file;

        const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
        const targetW = Math.round(width * scale);
        const targetH = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const blob = await canvasToBlob(canvas, 'image/webp', QUALITY);
        // Si el navegador no soporta codificar WebP devuelve null o cae a PNG,
        // que suele pesar más que el original: en ese caso no se toca nada.
        if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;

        return new File([blob], withExtension(file.name || 'imagen', 'webp'), {
            type: 'image/webp',
            lastModified: Date.now(),
        });
    } catch {
        return file;
    }
};
