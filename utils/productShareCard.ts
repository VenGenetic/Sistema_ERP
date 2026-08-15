/**
 * productShareCard.ts
 * Genera la ficha cuadrada de un repuesto (imagen + descripción + precio) y la
 * deja lista para pegar en WhatsApp.
 *
 * Es el mismo diseño que la tarjeta del catálogo público (catalogo-motos), a
 * propósito: lo que el vendedor manda desde el ERP tiene que verse igual que lo
 * que el cliente ve en el catálogo, o pareceria material de otro negocio.
 *
 * Se dibuja en un canvas en vez de capturar el DOM porque la tarjeta no existe
 * como elemento en pantalla -- el catálogo la arma igual -- y así el resultado
 * no depende del tema claro/oscuro ni del tamaño de la ventana.
 */
import { loadBrandLogo } from './brandLogo';
import { getThumbnailUrl } from './image';

export interface ShareCardProduct {
    sku: string;
    name: string;
    price?: number | null;
    image_url?: string | null;
    category?: string | null;
    local_stock?: number | null;
    importer_stock?: number | null;
    inventory_levels?: Array<{ current_stock?: number | null }> | null;
}

/** Cómo terminó la ficha en manos del usuario, para que quien llame avise en consecuencia. */
export type ShareCardOutcome = 'shared' | 'copied' | 'downloaded' | 'cancelled';

const SIZE = 1200;
const CENTER = SIZE / 2;
const FONT = '"Inter", "Helvetica Neue", Arial, sans-serif';

/**
 * Precio tal como se le muestra al cliente: redondeado al entero de arriba y
 * sin centavos (16.15 y 16.99 salen igual, $17).
 *
 * Es la misma convención que ya usan ShareDemandModal y la proforma, así que
 * un repuesto cotizado por WhatsApp y el mismo repuesto en una proforma dan la
 * misma cifra; mostrar el PVP crudo aquí abriría discusiones por centavos.
 */
const customerPriceText = (price?: number | null): string => `$${Math.ceil(Number(price) || 0)}`;

/**
 * Carga la imagen del repuesto para dibujarla en el canvas.
 *
 * crossOrigin='anonymous' es obligatorio: sin él el canvas queda "tainted" y
 * toBlob() lanza, que es justo el paso final de todo esto. Devuelve null en vez
 * de fallar si la imagen no carga -- una ficha sin foto sigue sirviendo para
 * pasar precio y descripción, y varios repuestos no tienen foto todavía.
 */
const loadProductImage = (url?: string | null): Promise<HTMLImageElement | null> => {
    if (!url) return Promise.resolve(null);

    const optimized = getThumbnailUrl(url, 1000, 1000) || url;

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        let triedOriginal = false;

        img.onload = () => resolve(img);
        img.onerror = () => {
            // La transformación de Supabase puede no estar habilitada; el
            // objeto original casi siempre sigue ahí.
            if (!triedOriginal && optimized !== url) {
                triedOriginal = true;
                img.src = url;
            } else {
                resolve(null);
            }
        };

        img.src = optimized;
    });
};

interface StockBadge {
    text: string;
    bg: string;
    fg: string;
}

const resolveStockBadge = (product: ShareCardProduct): StockBadge => {
    const fromLevels = product.inventory_levels?.reduce(
        (acc, level) => acc + (level.current_stock || 0),
        0
    );
    const local = fromLevels ?? Number(product.local_stock || 0);
    const importer = Number(product.importer_stock || 0);

    if (local > 0) return { text: 'DISPONIBLE', bg: '#dcfce7', fg: '#166534' };
    // Sin stock propio pero el importador lo tiene: se consigue, no se pierde la venta.
    if (importer > 0) return { text: 'BAJO PEDIDO', bg: '#fef3c7', fg: '#92400e' };
    return { text: 'AGOTADO', bg: '#fee2e2', fg: '#991b1b' };
};

const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] => {
    const lines: string[] = [];
    let current = '';
    for (const word of text.split(' ')) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines;
};

const drawHeader = (ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 40, SIZE - 80, 130);

    // "LV" recto + "PARTS" en cursiva roja, con el logo a la izquierda: el
    // bloque completo se mide antes para poder centrarlo como una sola pieza.
    const logoSize = logo ? 68 : 0;
    const logoGap = logo ? 18 : 0;

    ctx.font = `900 54px ${FONT}`;
    const lvWidth = ctx.measureText('LV').width;
    ctx.font = `italic 900 54px ${FONT}`;
    const partsWidth = ctx.measureText('PARTS').width;

    const blockWidth = logoSize + logoGap + lvWidth + 10 + partsWidth;
    let x = CENTER - blockWidth / 2;

    if (logo) {
        ctx.drawImage(logo, x, 105 - logoSize + 12, logoSize, logoSize);
        x += logoSize + logoGap;
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 54px ${FONT}`;
    ctx.fillText('LV', x, 105);
    ctx.fillStyle = '#e11d48';
    ctx.font = `italic 900 54px ${FONT}`;
    ctx.fillText('PARTS', x + lvWidth + 10, 105);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText('CATÁLOGO OFICIAL DE REPUESTOS', CENTER, 145);

    ctx.fillStyle = '#e11d48';
    ctx.fillRect(40, 170, SIZE - 80, 8);
};

const drawFooter = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(40, 1080, SIZE - 80, 80);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.font = `500 20px ${FONT}`;
    ctx.fillText('Catálogo en línea: lvparts.ec  •  Pedidos por WhatsApp', CENTER, 1128);
};

/** Dibuja la ficha completa y devuelve el canvas listo para exportar. */
const renderCard = async (product: ShareCardProduct): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo inicializar el canvas');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 40;
    ctx.strokeRect(20, 20, SIZE - 40, SIZE - 40);

    const [logo, image] = await Promise.all([
        loadBrandLogo().catch(() => null),
        loadProductImage(product.image_url),
    ]);

    drawHeader(ctx, logo);
    drawFooter(ctx);

    const badge = resolveStockBadge(product);

    // El alto de la foto es lo que sobre después del texto, no un valor fijo:
    // una descripción de cuatro líneas no puede empujar el precio fuera de la
    // tarjeta ni quedar pisada por el pie.
    ctx.font = `bold 36px ${FONT}`;
    const titleLines = wrapText(ctx, product.name, 1040);
    const titleLineHeight = 44;

    const spacingBelowImage = 40;
    const spacingBelowTitle = 15;
    const subHeight = 24;
    const spacingBelowSub = 30;
    const priceHeight = 75;
    const textHeight =
        spacingBelowImage +
        titleLines.length * titleLineHeight +
        spacingBelowTitle +
        subHeight +
        spacingBelowSub +
        priceHeight;

    const boxX = 80;
    const boxY = 208;
    const boxWidth = 1040;
    const boxHeight = 902 - textHeight - 50;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    if (image) {
        // Se encaja por el lado que sobra para no deformar la foto.
        const imgRatio = image.width / image.height;
        const boxRatio = boxWidth / boxHeight;
        let drawWidth = boxWidth - 40;
        let drawHeight = boxHeight - 40;
        let drawX = boxX + 20;
        let drawY = boxY + 20;

        if (imgRatio > boxRatio) {
            drawHeight = (boxWidth - 40) / imgRatio;
            drawY = boxY + (boxHeight - drawHeight) / 2;
        } else {
            drawWidth = (boxHeight - 40) * imgRatio;
            drawX = boxX + (boxWidth - drawWidth) / 2;
        }
        ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    } else {
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.font = `bold 32px ${FONT}`;
        ctx.fillText('SIN FOTO', CENTER, boxY + boxHeight / 2);
    }

    if (badge.text === 'AGOTADO') {
        ctx.save();
        ctx.translate(boxX + boxWidth / 2, boxY + boxHeight / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 130px ${FONT}`;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 14;
        ctx.strokeText('AGOTADO', 0, 0);
        ctx.fillStyle = 'rgba(220, 38, 38, 0.7)';
        ctx.fillText('AGOTADO', 0, 0);
        ctx.restore();
        ctx.textBaseline = 'alphabetic';
    }

    let y = boxY + boxHeight + spacingBelowImage + 30;

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = `bold 36px ${FONT}`;
    for (const line of titleLines) {
        ctx.fillText(line, CENTER, y);
        y += titleLineHeight;
    }

    y += spacingBelowTitle;
    ctx.fillStyle = '#64748b';
    ctx.font = `bold 20px ${FONT}`;
    let info = `SECCIÓN: ${String(product.category || 'General').toUpperCase()}`;
    if (product.sku) info += `   |   REFERENCIA: ${product.sku}`;
    ctx.fillText(info, CENTER, y);

    // Precio y estado van en la misma fila, centrados como un bloque.
    y += spacingBelowSub + 40;
    ctx.font = `900 68px ${FONT}`;
    const priceText = customerPriceText(product.price);
    const priceWidth = ctx.measureText(priceText).width;
    const badgeWidth = badge.text === 'BAJO PEDIDO' ? 240 : 210;
    const badgeHeight = 64;
    const startX = CENTER - (priceWidth + 30 + badgeWidth) / 2;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(priceText, startX, y);

    const badgeX = startX + priceWidth + 30;
    const badgeY = y - 56;

    ctx.fillStyle = badge.bg;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 16);
    } else {
        ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
    }
    ctx.fill();
    ctx.strokeStyle = badge.fg;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = badge.fg;
    ctx.font = `900 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(badge.text, badgeX + badgeWidth / 2, badgeY + 40);

    return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('No se pudo generar la imagen'));
        }, 'image/png');
    });

const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Arma la ficha del repuesto y la entrega por la mejor vía disponible:
 * compartir nativo en el teléfono (abre WhatsApp directo), portapapeles en el
 * escritorio, y descarga si el navegador no soporta ninguna de las dos.
 */
export const shareProductCard = async (product: ShareCardProduct): Promise<ShareCardOutcome> => {
    const canvas = await renderCard(product);
    const blob = await canvasToBlob(canvas);
    const fileName = `repuesto-${product.sku || 'ficha'}.png`;

    const file = new File([blob], fileName, { type: 'image/png' });
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    if (isMobileDevice && navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: product.name,
                text: `${product.name} - ${customerPriceText(product.price)}`,
            });
            return 'shared';
        } catch (err: any) {
            // Cerrar la hoja de compartir es una decisión del usuario, no un
            // fallo: no tiene sentido "arreglarlo" descargando el archivo.
            if (err?.name === 'AbortError') return 'cancelled';
        }
    }

    if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        try {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            return 'copied';
        } catch {
            // El navegador rechaza escribir el portapapeles si la pestaña
            // perdió el foco; la descarga siempre funciona.
        }
    }

    downloadBlob(blob, fileName);
    return 'downloaded';
};
