/**
 * thermalLabelPrinter.ts
 * Prints product barcode labels directly to a thermal roll printer at a
 * given physical label size (instead of laying them out on an A4 sheet).
 * Reuses the same label artwork as the A4 flow (renderLabelToCanvas) but
 * pushes it through window.print() with an explicit @page size matching
 * the label dimensions, so the browser print dialog paginates one label
 * per "page" — matching a fixed-pitch die-cut sticky label — regardless
 * of the system's default paper size.
 */
import { renderLabelToCanvas, LabelCanvasSize } from './mobileLabelPrinter';

export interface ThermalLabelItem {
    sku: string;
    name: string;
    quantity: number;
}

export const printLabelsOnThermalPrinter = async (
    items: ThermalLabelItem[],
    size: LabelCanvasSize
): Promise<void> => {
    const canvasCache = new Map<string, string>();
    const pages: string[] = [];

    for (const item of items) {
        if (item.quantity < 1) continue;
        if (!canvasCache.has(item.sku)) {
            const canvas = await renderLabelToCanvas({ sku: item.sku, name: item.name }, size);
            canvasCache.set(item.sku, canvas.toDataURL('image/png', 1.0));
        }
        const imgData = canvasCache.get(item.sku)!;
        for (let i = 0; i < item.quantity; i++) {
            pages.push(`<div class="label-page"><img src="${imgData}" /></div>`);
        }
    }

    if (pages.length === 0) return;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    iframe.contentDocument?.open();
    iframe.contentDocument?.write(`
        <html>
            <head>
                <title>Imprimir Etiquetas</title>
                <style>
                    @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    .label-page { width: ${size.widthMm}mm; height: ${size.heightMm}mm; page-break-after: always; }
                    .label-page:last-child { page-break-after: auto; }
                    .label-page img { display: block; width: 100%; height: 100%; }
                </style>
            </head>
            <body onload="window.print();">
                ${pages.join('')}
            </body>
        </html>
    `);
    iframe.contentDocument?.close();

    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 3000);
};
