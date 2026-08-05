/**
 * thermalLabelPrinter.ts
 * Prints product barcode labels directly to the USB thermal roll printer
 * (a "POS-8360"-class 80mm/203dpi ESC/POS printer) at a given physical
 * label size.
 *
 * This sends raw ESC/POS raster (GS v 0) bytes to the printer via QZ Tray
 * (utils/qzTray.ts) instead of using window.print(). That's deliberate:
 * window.print() hands the page to the Windows printer driver, which is
 * free to reinterpret/rotate/rescale the requested @page size -- that
 * mismatch is what caused labels to print sideways and at the wrong
 * length. Raw ESC/POS raster has no such translation layer: the bitmap we
 * build here, at the printer's own dot resolution, is printed dot-for-dot,
 * top row first, so there is nothing left that can silently rotate it.
 */
import { renderLabelToCanvas, LabelCanvasSize } from './mobileLabelPrinter';
import { printRasterJobs, resolveThermalPrinterName, RasterPrintJob } from './qzTray';

export interface ThermalLabelItem {
    sku: string;
    name: string;
    quantity: number;
}

// The installed thermal printer's head is 80mm (8cm) wide — no preset,
// built-in or custom, may ever print wider than that regardless of what
// was selected/saved.
export const MAX_THERMAL_WIDTH_MM = 80;

// POS-8360 spec: 203 DPI, 576 printable dots/line (~72mm of the 80mm roll,
// the rest being non-printable margin next to the print head). These two
// numbers are what turn a physical mm size into an exact dot bitmap for
// the ESC/POS raster command -- if this printer is ever swapped for a
// different model, update these two constants from its datasheet.
const THERMAL_DPI = 203;
const THERMAL_MAX_DOTS_WIDTH = 576;

const MM_TO_INCH = 1 / 25.4;

// GS v 0 raster rows are stored byte-packed (8 dots/byte), so the width in
// dots should be a multiple of 8 -- otherwise the trailing partial byte's
// unused bits are undefined padding, which can show up as a stray column
// of noise at the right edge of the label.
const mmToDots = (mm: number, alignToByte = false): number => {
    const dots = Math.round(mm * MM_TO_INCH * THERMAL_DPI);
    return alignToByte ? Math.round(dots / 8) * 8 : dots;
};

// Downsamples the (high-DPI) source canvas into a new canvas sized exactly
// to the printer's native dot dimensions, which is the bitmap ESC/POS will
// print 1:1 (dotDensity 'single' in qzTray.ts -- no further rescaling).
const toDeviceRasterBase64 = (source: HTMLCanvasElement, dotsW: number, dotsH: number): string => {
    const out = document.createElement('canvas');
    out.width = dotsW;
    out.height = dotsH;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dotsW, dotsH);
    ctx.drawImage(source, 0, 0, dotsW, dotsH);
    return out.toDataURL('image/png', 1.0).split(',')[1];
};

export const printLabelsOnThermalPrinter = async (
    items: ThermalLabelItem[],
    requestedSize: LabelCanvasSize,
    printerName?: string
): Promise<void> => {
    const size: LabelCanvasSize = {
        widthMm: Math.min(requestedSize.widthMm, MAX_THERMAL_WIDTH_MM),
        heightMm: requestedSize.heightMm,
    };

    const dotsW = Math.min(mmToDots(size.widthMm, true), THERMAL_MAX_DOTS_WIDTH);
    const dotsH = mmToDots(size.heightMm);

    const base64Cache = new Map<string, string>();
    const jobs: RasterPrintJob[] = [];

    for (const item of items) {
        if (item.quantity < 1) continue;
        if (!base64Cache.has(item.sku)) {
            const sourceCanvas = await renderLabelToCanvas({ sku: item.sku, name: item.name }, size);
            base64Cache.set(item.sku, toDeviceRasterBase64(sourceCanvas, dotsW, dotsH));
        }
        const base64Png = base64Cache.get(item.sku)!;
        for (let i = 0; i < item.quantity; i++) {
            // Cut after every label: each one is a separate sticker meant
            // to be applied to a different part, not a multi-label receipt.
            jobs.push({ base64Png, cutAfter: true });
        }
    }

    if (jobs.length === 0) return;

    const targetPrinter = printerName ?? (await resolveThermalPrinterName());
    await printRasterJobs(targetPrinter, jobs);
};
