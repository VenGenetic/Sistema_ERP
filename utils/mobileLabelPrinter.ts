/**
 * mobileLabelPrinter.ts
 * Lightweight utility for fast barcode label generation & download on mobile.
 * No modals, no new tabs — generates PDF and triggers download directly.
 */
import JsBarcode from 'jsbarcode';
import { loadBrandLogo, drawLabelBrandHeader } from './brandLogo';

export interface LabelCanvasSize {
    widthMm: number;
    heightMm: number;
}

// Default label size: one cell of the 3x7 grid used to fill an A4 sheet (70 x 42.428mm)
export const DEFAULT_LABEL_SIZE: LabelCanvasSize = { widthMm: 210 / 3, heightMm: 297 / 7 };

// The source art is rendered at an exact integer multiple of the thermal
// printer's 203 DPI (see thermalLabelPrinter.ts) rather than a round number
// like 600. That matters for the barcode: at 600 DPI a bar module lands on
// 1.83 printer dots, so the 3:1-ish downsample smears each bar edge into
// grey. A thermal head is 1-bit -- it either burns a dot or it doesn't --
// so those greys get thresholded inconsistently and the bar/space ratios
// CODE128 depends on are destroyed, which is what makes a printed label
// refuse to scan. With OVERSAMPLE=3 every 3 source pixels collapse into
// exactly 1 printer dot, so a module drawn 3*n pixels wide prints as
// exactly n solid dots.
export const OVERSAMPLE = 3;
const DEVICE_DPI = 203;
const SOURCE_DPI = DEVICE_DPI * OVERSAMPLE; // 609

/** Exact pixel dimensions to render at, bypassing the mm->DPI calculation. */
export interface ExactPixelSize {
    width: number;
    height: number;
}

// --- Render a single label to an offscreen canvas ---
export const renderLabelToCanvas = async (
    product: { sku: string; name: string },
    size: LabelCanvasSize = DEFAULT_LABEL_SIZE,
    exactPixels?: ExactPixelSize
): Promise<HTMLCanvasElement> => {
    // When printing thermally the caller passes the exact source dimensions
    // (device dots * OVERSAMPLE) so the downsample is a clean integer ratio.
    // Otherwise (A4 PDF / preview) derive them from the physical size.
    const MM_TO_INCH = 1 / 25.4;
    const W = exactPixels ? exactPixels.width : Math.round(size.widthMm * MM_TO_INCH * SOURCE_DPI);
    const H = exactPixels ? exactPixels.height : Math.round(size.heightMm * MM_TO_INCH * SOURCE_DPI);
    const PAD = Math.round(W * 0.04);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000000';

    // --- BRAND HEADER: small logo + "LV PARTS" bold, separated by a line ---
    const logoImg = await loadBrandLogo().catch(() => null);
    const contentTop = drawLabelBrandHeader(ctx, logoImg, W, PAD);

    // --- BARCODE, vertically centered in the space left below the header ---
    // The module (narrowest bar) width is picked in whole printer dots, and
    // the barcode is never rescaled when drawn -- any fractional scaling
    // would reintroduce the blurred-bar problem OVERSAMPLE exists to avoid.
    // Start at 3 dots (~0.37mm, comfortable for handheld scanners) and step
    // down only as far as a long SKU actually requires to fit the label.
    const maxBarcodeW = W - PAD * 2;
    const barcodeCanvas = document.createElement('canvas');
    let moduleDots = 3;
    for (;;) {
        JsBarcode(barcodeCanvas, product.sku, {
            format: 'CODE128',
            displayValue: false,
            width: moduleDots * OVERSAMPLE,
            height: Math.round(H * 0.32),
            margin: 0,
            lineColor: '#000000',
            background: '#ffffff',
        });
        if (barcodeCanvas.width <= maxBarcodeW || moduleDots === 1) break;
        moduleDots--;
    }

    // Snapped to the oversample grid so each module still lands on whole
    // dots once the canvas is downsampled to the printer's resolution.
    const bcW = barcodeCanvas.width;
    const bcH = barcodeCanvas.height;
    const bcX = Math.round((W - bcW) / 2 / OVERSAMPLE) * OVERSAMPLE;
    const contentH = H - contentTop;
    const bcY = Math.round((contentTop + (contentH - bcH) / 2) / OVERSAMPLE) * OVERSAMPLE;

    // --- DESCRIPTION TEXT (above barcode, below header) ---
    const descAreaH = bcY - contentTop;
    const descMaxW = W - PAD * 2;

    let descFontSize = Math.round(H * 0.085);
    const MIN_FONT = Math.round(H * 0.045);

    const wrapText = (text: string, maxW: number, fontSize: number) => {
        ctx.font = `bold ${fontSize}px sans-serif`;
        const words = text.split(' ');
        const lines: string[] = [];
        let current = '';
        for (const word of words) {
            const test = current ? `${current} ${word}` : word;
            if (ctx.measureText(test).width > maxW && current) {
                lines.push(current);
                current = word;
            } else {
                current = test;
            }
        }
        if (current) lines.push(current);
        return lines;
    };

    let descLines: string[] = [];
    while (descFontSize >= MIN_FONT) {
        descLines = wrapText(product.name, descMaxW, descFontSize);
        const totalH = descLines.length * descFontSize * 1.25;
        if (totalH <= descAreaH - PAD * 0.5) break;
        descFontSize -= 2;
    }

    const descLineH = descFontSize * 1.25;
    const descBlockH = descLines.length * descLineH;
    let descY = contentTop + (descAreaH - descBlockH) / 2 + descFontSize;
    ctx.font = `bold ${descFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    for (const line of descLines) {
        ctx.fillText(line, W / 2, descY);
        descY += descLineH;
    }

    // --- Draw Barcode (1:1 -- no width/height args, so no rescaling) ---
    ctx.drawImage(barcodeCanvas, bcX, bcY);

    // --- SKU TEXT (below barcode) ---
    const skuAreaTop = bcY + bcH;
    const skuAreaH = H - skuAreaTop - PAD;

    let skuFontSize = Math.round(H * 0.1);
    const MIN_SKU_FONT = Math.round(H * 0.055);
    while (skuFontSize >= MIN_SKU_FONT) {
        ctx.font = `bold ${skuFontSize}px monospace`;
        if (ctx.measureText(product.sku).width <= descMaxW) break;
        skuFontSize -= 2;
    }
    ctx.font = `bold ${skuFontSize}px monospace`;
    ctx.textAlign = 'center';
    const skuY = skuAreaTop + (skuAreaH + skuFontSize) / 2;
    ctx.fillText(product.sku, W / 2, skuY);

    return canvas;
};


// --- Print history management (localStorage) ---
const HISTORY_KEY = 'mobile_print_history';
const MAX_HISTORY = 15;

export interface PrintHistoryItem {
    id: number;
    sku: string;
    name: string;
    image_url?: string;
    printedAt: number; // timestamp
    quantity: number;
}

export const addToPrintHistory = (product: { id: number; sku: string; name: string; image_url?: string }, quantity: number): void => {
    try {
        const history = getPrintHistory();
        // Remove existing entry for same product if any
        const filtered = history.filter(h => h.id !== product.id);
        filtered.unshift({
            id: product.id,
            sku: product.sku,
            name: product.name,
            image_url: product.image_url,
            printedAt: Date.now(),
            quantity,
        });
        // Keep only latest N
        const trimmed = filtered.slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.error('Error saving print history:', e);
    }
};

export const getPrintHistory = (): PrintHistoryItem[] => {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};
