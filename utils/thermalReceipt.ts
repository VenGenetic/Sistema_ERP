/**
 * thermalReceipt.ts
 * Prints a POS sale as a receipt on the 80mm thermal printer, through
 * window.print() with an explicit @page matching the receipt's rendered
 * size -- the same mechanism thermalLabelPrinter.ts originally used for
 * barcode labels, before that file was switched to QZ Tray. QZ Tray
 * requires its own desktop app to be installed, running, and have its
 * certificate trusted on every POS machine, which turned out to be an
 * unreliable dependency in the field; window.print() only needs the
 * thermal printer to be set up as a normal Windows/OS printer, same as
 * any other, and prints through the browser's own print pipeline.
 *
 * Receipts are rendered as a bitmap rather than as ESC/POS text because the
 * text path would put layout at the mercy of the printer's own font metrics
 * and codepage -- and this shop prints Spanish, where a mis-set codepage
 * turns every accented character into noise. Drawing to a canvas keeps the
 * layout, the accents and the column alignment under our control.
 *
 * NOTE ON PAPER: this expects continuous 80mm roll stock, not the die-cut
 * label roll. Receipts are variable length and get cut at the end, which is
 * exactly what die-cut stock cannot do (see thermalLabelPrinter.ts).
 */
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

    const BODY = mm(2.8);
    const SMALL = mm(2.3);
    const ITEM_TITLE = mm(1.8);
    const BIG = mm(4.2);
    const LINE = Math.round(BODY * 1.35);

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
        y += Math.round(size * 0.35);
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
        y += Math.round(size * 0.35);
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
    // Item description uses a smaller, cleaner font (2.4mm) so long titles fit nicely.
    for (const line of data.lines) {
        ctx.font = `${ITEM_TITLE}px sans-serif`;
        for (const part of wrap(ctx, line.name, CONTENT_W)) {
            text(part, { size: ITEM_TITLE, bold: false });
        }
        row(
            `  ${line.sku}   ${line.quantity} x ${money(line.unitPrice)}`,
            money(line.quantity * line.unitPrice),
            { size: SMALL }
        );
        y += Math.round(LINE * 0.15);
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

/**
 * Sends the rendered receipt to window.print() via a hidden iframe, one
 * "page" per copy, with @page sized to exactly match the canvas -- same
 * approach as the pre-QZ Tray thermalLabelPrinter.ts. Resolves once the
 * iframe is torn down, giving the browser's print pipeline time to pick up
 * the content before it disappears from the DOM.
 */
const printCanvasViaBrowser = (canvas: HTMLCanvasElement, copies: number): Promise<void> => {
    const widthMm = (canvas.width / OVERSAMPLE / THERMAL_DPI) * 25.4;
    const heightMm = (canvas.height / OVERSAMPLE / THERMAL_DPI) * 25.4;
    const imgData = canvas.toDataURL('image/png', 1.0);
    const pages = Array.from(
        { length: Math.max(1, copies) },
        () => `<div class="receipt-page"><img src="${imgData}" /></div>`
    ).join('');

    return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        iframe.contentDocument?.open();
        iframe.contentDocument?.write(`
            <html>
                <head>
                    <title>Recibo</title>
                    <style>
                        @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        .receipt-page { width: ${widthMm}mm; height: ${heightMm}mm; page-break-after: always; }
                        .receipt-page:last-child { page-break-after: auto; }
                        .receipt-page img { display: block; width: 100%; height: 100%; }
                    </style>
                </head>
                <body onload="window.print();">
                    ${pages}
                </body>
            </html>
        `);
        iframe.contentDocument?.close();

        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
            resolve();
        }, 3000);
    });
};

export const printReceiptOnThermalPrinter = async (
    data: ReceiptData,
    copies: number = 2
): Promise<void> => {
    const canvas = await renderReceiptToCanvas(data);
    await printCanvasViaBrowser(canvas, copies);
};

/** Reimprime el recibo de una orden existente llamando a la BD y enviándolo a la impresora térmica (2 copias por defecto) */
export const reprintOrderReceipt = async (orderId: number | string, copies: number = 2): Promise<void> => {
    const { data: order, error } = await supabase
        .from('orders')
        .select(`
            id, created_at, shipping_cost,
            customers (name, identification_number, discount_percentage),
            accounts!payment_account_id (name),
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

    await printReceiptOnThermalPrinter(receiptData, copies);
};

/** Renders the receipt for on-screen preview without touching the printer. */
export const renderReceiptPreview = async (data: ReceiptData): Promise<HTMLCanvasElement> =>
    renderReceiptToCanvas(data);
