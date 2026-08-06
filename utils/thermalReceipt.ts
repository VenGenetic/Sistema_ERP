/**
 * thermalReceipt.ts
 * Prints a POS sale as a receipt on the 80mm thermal printer, over the same
 * raw ESC/POS raster path the barcode labels use (utils/qzTray.ts).
 *
 * Receipts are rendered as a bitmap rather than as ESC/POS text because the
 * text path would put layout at the mercy of the printer's own font metrics
 * and codepage -- and this shop prints Spanish, where a mis-set codepage
 * turns every accented character into noise. Drawing to a canvas keeps the
 * layout, the accents and the column alignment under our control, and it
 * reuses the oversample-and-binarise trick that made the labels crisp.
 *
 * NOTE ON PAPER: this expects continuous 80mm roll stock, not the die-cut
 * label roll. Receipts are variable length and get cut at the end, which is
 * exactly what die-cut stock cannot do (see thermalLabelPrinter.ts).
 */
import { printRasterJobs, resolveThermalPrinterName } from './qzTray';
import { loadBrandLogo, BRAND_NAME } from './brandLogo';
import { supabase } from '../supabaseClient';

export interface ReceiptLine {
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
}

export interface ReceiptData {
    orderId: number | string | null;
    date: Date;
    customerName: string;
    customerId?: string;
    lines: ReceiptLine[];
    subtotal: number;
    discountPercentage?: number;
    promoDiscount?: number;
    shipping?: number;
    total: number;
    paymentMethod?: string;
    cashier?: string;
}

// Same head geometry as the label printer: 203 dpi, 576 printable dots.
const THERMAL_DPI = 203;
const RECEIPT_DOTS_WIDTH = 576;
const OVERSAMPLE = 3;

// Source canvas is an exact whole multiple of the dot grid, so the
// downsample is a clean box average instead of a blurring resample.
const W = RECEIPT_DOTS_WIDTH * OVERSAMPLE;
const mm = (v: number) => Math.round((v / 25.4) * THERMAL_DPI) * OVERSAMPLE;

const PAD = mm(3);
const CONTENT_W = W - PAD * 2;

// Generous upper bound; the canvas is cropped to what was actually drawn.
const MAX_HEIGHT = 40000;

const money = (n: number): string =>
    (Number.isFinite(n) ? n : 0).toFixed(2);

/** Splits text into lines that fit maxW at the context's current font. */
const wrap = (ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] => {
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
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
    return lines.length > 0 ? lines : [''];
};

const renderReceiptToCanvas = async (data: ReceiptData): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = MAX_HEIGHT;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, MAX_HEIGHT);
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'alphabetic';

    const BODY = mm(3.2);
    const SMALL = mm(2.6);
    const BIG = mm(5);
    const LINE = Math.round(BODY * 1.45);

    let y = PAD;

    const text = (
        s: string,
        opts: { size?: number; bold?: boolean; align?: CanvasTextAlign; mono?: boolean } = {}
    ) => {
        const size = opts.size ?? BODY;
        ctx.font = `${opts.bold ? 'bold ' : ''}${size}px ${opts.mono ? 'monospace' : 'sans-serif'}`;
        ctx.textAlign = opts.align ?? 'left';
        const x = opts.align === 'center' ? W / 2 : opts.align === 'right' ? W - PAD : PAD;
        y += size;
        ctx.fillText(s, x, y);
        y += Math.round(size * 0.45);
    };

    /** Label on the left, value hard against the right margin. */
    const row = (left: string, right: string, opts: { bold?: boolean; size?: number } = {}) => {
        const size = opts.size ?? BODY;
        ctx.font = `${opts.bold ? 'bold ' : ''}${size}px sans-serif`;
        y += size;
        ctx.textAlign = 'left';
        ctx.fillText(left, PAD, y);
        ctx.textAlign = 'right';
        ctx.fillText(right, W - PAD, y);
        y += Math.round(size * 0.45);
    };

    const rule = (dashed = false) => {
        y += Math.round(LINE * 0.35);
        const h = Math.max(1, Math.round(OVERSAMPLE * 0.8));
        if (dashed) {
            const dash = mm(1.2);
            for (let x = PAD; x < W - PAD; x += dash * 2) {
                ctx.fillRect(x, y, Math.min(dash, W - PAD - x), h);
            }
        } else {
            ctx.fillRect(PAD, y, CONTENT_W, h);
        }
        y += h + Math.round(LINE * 0.35);
    };

    // --- Header: logo (if it loads) then the shop name ---
    const logo = await loadBrandLogo().catch(() => null);
    if (logo && logo.width > 0) {
        const logoW = mm(16);
        const logoH = Math.round((logo.height / logo.width) * logoW);
        ctx.drawImage(logo, Math.round((W - logoW) / 2), y, logoW, logoH);
        y += logoH + Math.round(LINE * 0.4);
    }
    text(BRAND_NAME, { size: BIG, bold: true, align: 'center' });
    text('NOTA DE VENTA', { size: SMALL, align: 'center' });
    rule();

    // --- Sale identification ---
    const d = data.date;
    const stamp =
        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/` +
        `${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    if (data.orderId !== null && data.orderId !== undefined) {
        row('Orden:', `#${data.orderId}`, { bold: true });
    }
    row('Fecha:', stamp, { size: SMALL });
    if (data.cashier) row('Atendido por:', data.cashier, { size: SMALL });
    rule(true);

    // --- Customer ---
    text('CLIENTE', { size: SMALL, bold: true });
    text(data.customerName || 'CONSUMIDOR FINAL', { size: BODY });
    if (data.customerId) text(`ID: ${data.customerId}`, { size: SMALL });
    rule();

    // --- Line items ---
    // Description gets its own full-width line and the amounts sit under it,
    // rather than squeezing four columns into 72mm where long part names
    // would have to be truncated to fit.
    for (const line of data.lines) {
        ctx.font = `bold ${BODY}px sans-serif`;
        for (const part of wrap(ctx, line.name, CONTENT_W)) {
            text(part, { bold: true });
        }
        row(
            `  ${line.sku}   ${line.quantity} x ${money(line.unitPrice)}`,
            money(line.quantity * line.unitPrice),
            { size: SMALL }
        );
        y += Math.round(LINE * 0.2);
    }
    rule();

    // --- Totals ---
    row('Subtotal', money(data.subtotal), { size: SMALL });
    if (data.discountPercentage) {
        row(
            `Descuento (${data.discountPercentage}%)`,
            `-${money(data.subtotal * (data.discountPercentage / 100))}`,
            { size: SMALL }
        );
    }
    if (data.promoDiscount) row('Promoción', `-${money(data.promoDiscount)}`, { size: SMALL });
    if (data.shipping) row('Envío', money(data.shipping), { size: SMALL });
    rule();
    row('TOTAL', `$${money(data.total)}`, { bold: true, size: BIG });

    if (data.paymentMethod) {
        y += Math.round(LINE * 0.3);
        row('Forma de pago', data.paymentMethod, { size: SMALL });
    }

    y += LINE;
    text('¡Gracias por su compra!', { size: SMALL, align: 'center' });

    // --- Crop to what was actually drawn ---
    const usedHeight = Math.min(MAX_HEIGHT, y + PAD);
    const cropped = document.createElement('canvas');
    cropped.width = W;
    // Height must land on a whole printer dot so the raster maps 1:1.
    cropped.height = Math.ceil(usedHeight / OVERSAMPLE) * OVERSAMPLE;
    const cctx = cropped.getContext('2d')!;
    cctx.fillStyle = '#ffffff';
    cctx.fillRect(0, 0, cropped.width, cropped.height);
    cctx.drawImage(canvas, 0, 0, W, cropped.height, 0, 0, W, cropped.height);
    return cropped;
};

/** Downsamples to device dots and forces pure black/white, as labels do. */
const toDeviceBase64 = (source: HTMLCanvasElement): string => {
    const dotsW = RECEIPT_DOTS_WIDTH;
    const dotsH = Math.round(source.height / OVERSAMPLE);

    const out = document.createElement('canvas');
    out.width = dotsW;
    out.height = dotsH;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dotsW, dotsH);
    ctx.drawImage(source, 0, 0, dotsW, dotsH);

    const img = ctx.getImageData(0, 0, dotsW, dotsH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const luma = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const v = luma < 128 ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    return out.toDataURL('image/png', 1.0).split(',')[1];
};

export const printReceiptOnThermalPrinter = async (
    data: ReceiptData,
    printerName?: string,
    copies: number = 2
): Promise<void> => {
    const canvas = await renderReceiptToCanvas(data);
    const base64Png = toDeviceBase64(canvas);
    const targetPrinter = printerName ?? (await resolveThermalPrinterName());
    const jobs = Array.from({ length: Math.max(1, copies) }, () => ({ base64Png, cutAfter: true }));
    await printRasterJobs(targetPrinter, jobs);
};

/** Reimprime el recibo de una orden existente llamando a la BD y enviándolo a la impresora térmica (2 copias por defecto) */
export const reprintOrderReceipt = async (orderId: number | string, copies: number = 2): Promise<void> => {
    const { data: order, error } = await supabase
        .from('orders')
        .select(`
            id, created_at, shipping_cost,
            customers (name, identification_number, discount_percentage),
            accounts (name),
            order_items (
                quantity, unit_price,
                products (sku, name)
            )
        `)
        .eq('id', orderId)
        .single();

    if (error || !order) {
        throw new Error(`No se pudo cargar la orden #${orderId}: ${error?.message || 'No encontrada'}`);
    }

    const lines: ReceiptLine[] = (order.order_items as any[])?.map((item: any) => ({
        sku: item.products?.sku || 'SKU',
        name: item.products?.name || 'Producto',
        quantity: item.quantity || 1,
        unitPrice: item.unit_price || 0,
    })) || [];

    const subtotal = lines.reduce((acc, l) => acc + (l.quantity * l.unitPrice), 0);
    const shipping = order.shipping_cost || 0;
    const total = subtotal + shipping;

    const receiptData: ReceiptData = {
        orderId: order.id,
        date: new Date(order.created_at || Date.now()),
        customerName: (order.customers as any)?.name || 'CONSUMIDOR FINAL',
        customerId: (order.customers as any)?.identification_number,
        lines,
        subtotal,
        discountPercentage: (order.customers as any)?.discount_percentage || undefined,
        shipping: shipping || undefined,
        total,
        paymentMethod: (order.accounts as any)?.name || undefined,
    };

    await printReceiptOnThermalPrinter(receiptData, undefined, copies);
};

/** Renders the receipt for on-screen preview without touching the printer. */
export const renderReceiptPreview = async (data: ReceiptData): Promise<HTMLCanvasElement> =>
    renderReceiptToCanvas(data);
