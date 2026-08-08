/**
 * thermalLabelPrinter.ts
 * Prints product barcode labels on the shop's Xprinter XP-450B (203dpi,
 * TSPL command language, genuine gap sensor) via QZ Tray raw printing.
 *
 * This replaced an earlier POS-8360 (ESC/POS, no gap sensor) specifically
 * for the gap sensor: once calibrated on the physical unit (hold FEED while
 * powering on, until the status LED settles on solid blue), the printer
 * finds each label's real boundary itself. That removes the whole
 * feed-accumulator / drift-compensation machinery the old ESC/POS path
 * needed to fake the same thing open-loop -- one PRINT command reliably
 * yields exactly one correctly-registered label, verified against the
 * shop's actual 60x40mm die-cut roll. There is no cutter on this printer;
 * labels are peeled off individually as they print, so there is no "strip"
 * or end-of-batch cut to manage either.
 */
import { renderLabelToCanvas, LabelCanvasSize, OVERSAMPLE } from './mobileLabelPrinter';
import { printTsplJob, resolveThermalPrinterName } from './qzTray';

export interface ThermalLabelItem {
    sku: string;
    name: string;
    quantity: number;
}

// XP-450B spec: 203 DPI, 4" print head. The datasheet advertises support for
// media up to 112mm wide, but that is the widest *stock* the paper path can
// physically feed, not the print element's width -- content wider than the
// head itself would just not be burned. 104mm is a conservative cap under
// the commonly-quoted ~832-848 dot head width for this printer family.
const THERMAL_DPI = 203;
export const MAX_THERMAL_WIDTH_MM = 104;

const MM_TO_INCH = 1 / 25.4;

// TSPL's BITMAP command packs rows byte-aligned (8 dots/byte, MSB first),
// same convention as ESC/POS GS v 0 -- so the width in dots must be a
// multiple of 8, or the trailing partial byte's padding bits are undefined.
const mmToDots = (mm: number, alignToByte = false): number => {
    const dots = Math.round(mm * MM_TO_INCH * THERMAL_DPI);
    return alignToByte ? Math.round(dots / 8) * 8 : dots;
};

/**
 * Downsamples the (high-DPI) source canvas to the printer's native dot
 * dimensions, binarises it to pure black/white, and bit-packs it into the
 * row-major MSB-first format TSPL's BITMAP command expects.
 *
 * The binarise-before-pack step matters for the same reason it did on the
 * ESC/POS path: the head is 1-bit, so something has to threshold the
 * anti-aliased downsample result, and doing it here at a known 50% midpoint
 * keeps barcode bars solid instead of letting them fade into a dithered
 * stipple a scanner can't read.
 */
const toPackedBitmap = (source: HTMLCanvasElement, dotsW: number, dotsH: number): Uint8Array => {
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
    const widthBytes = dotsW / 8; // dotsW is always byte-aligned (mmToDots(..., true))
    const packed = new Uint8Array(widthBytes * dotsH);
    for (let y = 0; y < dotsH; y++) {
        for (let x = 0; x < dotsW; x++) {
            const luma =
                d[(y * dotsW + x) * 4] * 0.299 +
                d[(y * dotsW + x) * 4 + 1] * 0.587 +
                d[(y * dotsW + x) * 4 + 2] * 0.114;
            // A set bit burns a dot. Threshold at the same 50% midpoint used
            // everywhere else in this pipeline.
            if (luma < 128) {
                packed[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
            }
        }
    }
    return packed;
};

const ascii = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0));

/**
 * Assembles one complete TSPL job: page geometry, the bitmap, and the PRINT
 * trigger. SIZE/GAP/DENSITY/SPEED are resent on every job rather than once
 * per batch -- confirmed harmless against the real printer (each of the
 * manual verification prints during setup included the full preamble and
 * produced one correctly-registered label every time), and it means a job
 * is self-contained: nothing about how one label prints depends on what
 * shape the previous one in the batch was.
 */
const buildTsplJob = (
    widthMm: number,
    heightMm: number,
    gapMm: number,
    dotsW: number,
    dotsH: number,
    bitmap: Uint8Array,
    copies: number
): Uint8Array => {
    const widthBytes = dotsW / 8;
    const header = ascii(
        `SIZE ${widthMm} mm,${heightMm} mm\r\n` +
            `GAP ${gapMm} mm,0 mm\r\n` +
            `DIRECTION 1\r\n` +
            `DENSITY 10\r\n` +
            `SPEED 4\r\n` +
            `CLS\r\n` +
            `BITMAP 0,0,${widthBytes},${dotsH},0,`
    );
    const footer = ascii(`\r\nPRINT ${copies},1\r\n`);

    const out = new Uint8Array(header.length + bitmap.length + footer.length);
    out.set(header, 0);
    out.set(bitmap, header.length);
    out.set(footer, header.length + bitmap.length);
    return out;
};

/** Roll geometry beyond the label's own size. */
export interface ThermalRollOptions {
    /**
     * Declared gap between labels, mm, passed straight to TSPL's GAP
     * command. This is a nominal value for the printer's own sensor to
     * calibrate against (see the module comment) -- not a hand-tuned feed
     * distance the way it had to be on the old sensor-less ESC/POS printer.
     * Defaults to 2mm, a reasonable value for typical die-cut stock; run
     * the FEED-button calibration on the printer itself after loading a
     * roll with a meaningfully different gap.
     */
    gapMm?: number;
}

export const printLabelsOnThermalPrinter = async (
    items: ThermalLabelItem[],
    requestedSize: LabelCanvasSize,
    printerName?: string,
    roll: ThermalRollOptions = {}
): Promise<void> => {
    const size: LabelCanvasSize = {
        widthMm: Math.min(requestedSize.widthMm, MAX_THERMAL_WIDTH_MM),
        heightMm: requestedSize.heightMm,
    };
    const gapMm = roll.gapMm ?? 2;

    const dotsW = mmToDots(size.widthMm, true);
    const dotsH = mmToDots(size.heightMm);

    const targetPrinter = printerName ?? (await resolveThermalPrinterName());

    for (const item of items) {
        if (item.quantity < 1) continue;

        // Render at an exact whole multiple of the final dot grid so the
        // downsample in toPackedBitmap is a clean OVERSAMPLE:1 box average
        // -- what keeps barcode bars solid black instead of anti-aliased
        // grey, which a 1-bit thermal head cannot reproduce faithfully.
        const sourceCanvas = await renderLabelToCanvas(
            { sku: item.sku, name: item.name },
            size,
            { width: dotsW * OVERSAMPLE, height: dotsH * OVERSAMPLE }
        );
        const bitmap = toPackedBitmap(sourceCanvas, dotsW, dotsH);

        // TSPL's own PRINT n prints n copies of the bitmap just staged, so
        // one job carries the item's whole quantity -- rendering happens
        // once per SKU regardless of how many copies are requested, and one
        // QZ Tray round trip does the same for the actual printing.
        const job = buildTsplJob(size.widthMm, size.heightMm, gapMm, dotsW, dotsH, bitmap, item.quantity);
        await printTsplJob(targetPrinter, job);
    }
};
