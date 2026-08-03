/**
 * mobileLabelPrinter.ts
 * Lightweight utility for fast barcode label generation & download on mobile.
 * No modals, no new tabs — generates PDF and triggers download directly.
 */
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { loadBrandLogo, drawLabelBrandHeader } from './brandLogo';

// --- Render a single label to an offscreen canvas ---
export const renderLabelToCanvas = async (product: { sku: string; name: string }): Promise<HTMLCanvasElement> => {
    const DPI = 300;
    const MM_TO_INCH = 1 / 25.4;
    const W = Math.round((210 / 3) * MM_TO_INCH * DPI); // ~827px
    const H = Math.round((297 / 7) * MM_TO_INCH * DPI); // ~501px
    const PAD = Math.round(W * 0.04);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000000';

    // --- BRAND HEADER: small logo + "LV PARTS" bold, separated by a line ---
    const logoImg = await loadBrandLogo().catch(() => null);
    const contentTop = drawLabelBrandHeader(ctx, logoImg, W, PAD);

    // --- BARCODE, vertically centered in the space left below the header ---
    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, product.sku, {
        format: 'CODE128',
        displayValue: false,
        width: 3,
        height: Math.round(H * 0.32),
        margin: 0,
        lineColor: '#000000',
        background: '#ffffff',
    });

    const bcW = Math.min(barcodeCanvas.width, W - PAD * 2);
    const bcH = barcodeCanvas.height;
    const bcX = (W - bcW) / 2;
    const contentH = H - contentTop;
    const bcY = contentTop + (contentH - bcH) / 2;

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

    // --- Draw Barcode ---
    ctx.drawImage(barcodeCanvas, bcX, bcY, bcW, bcH);

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

// --- Generate PDF with N labels and trigger download (no new tabs) ---
export const printLabelsQuick = async (
    product: { sku: string; name: string },
    quantity: number = 3
): Promise<void> => {
    const canvas = await renderLabelToCanvas(product);
    const imgData = canvas.toDataURL('image/png', 1.0);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cols = 3;
    const rows = 7;
    const LABEL_W = 210 / cols;
    const LABEL_H = 297 / rows;

    let currentItem = 0;
    while (currentItem < quantity) {
        if (currentItem > 0 && currentItem % (cols * rows) === 0) {
            pdf.addPage();
        }

        const indexOnPage = currentItem % (cols * rows);
        const col = indexOnPage % cols;
        const row = Math.floor(indexOnPage / cols);

        const x = col * LABEL_W;
        const y = row * LABEL_H;

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        pdf.setLineDashPattern([2, 1.5], 0);
        pdf.rect(x, y, LABEL_W, LABEL_H);
        pdf.setLineDashPattern([], 0);

        pdf.addImage(imgData, 'PNG', x, y, LABEL_W, LABEL_H);
        currentItem++;
    }

    // Download directly — no window.open, no new tabs
    pdf.save(`etiquetas_${product.sku}_x${quantity}.pdf`);

    // Haptic feedback if available
    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
    }
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
