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
import { renderLabelToCanvas, LabelCanvasSize, OVERSAMPLE } from './mobileLabelPrinter';
import { printRasterJobs, resolveThermalPrinterName, RasterPrintJob, FEED_UNIT_MM } from './qzTray';

export interface ThermalLabelItem {
    sku: string;
    name: string;
    quantity: number;
}

// POS-8360 spec: 203 DPI, 576 printable dots/line (~72mm of the 80mm roll,
// the rest being non-printable margin next to the print head). These two
// numbers are what turn a physical mm size into an exact dot bitmap for
// the ESC/POS raster command -- if this printer is ever swapped for a
// different model, update these two constants from its datasheet.
const THERMAL_DPI = 203;
const THERMAL_MAX_DOTS_WIDTH = 576;

const MM_TO_INCH = 1 / 25.4;

// 80mm is the width of the *paper*, not of the printable area -- the head
// only covers 576 dots (~72.08mm) of it. Laying a label out for the full
// 80mm and then rasterising it into 576 dots (which is what this did
// before) squeezed the artwork ~10% horizontally while leaving the height
// at true scale, so labels came out visibly distorted and the barcode's
// bar/space ratios drifted. Clamping to the real printable width instead
// keeps the aspect ratio honest.
export const MAX_THERMAL_WIDTH_MM = (THERMAL_MAX_DOTS_WIDTH / THERMAL_DPI) * 25.4;

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
//
// offsetDots shifts the artwork right by padding white columns onto the
// left of the bitmap. That is done here, in the raster itself, rather than
// with an ESC/POS left-margin command (GS L), because margin commands are
// among the first things cheap clones ignore -- white pixels always work.
const toDeviceRaster = (
    source: HTMLCanvasElement,
    dotsW: number,
    dotsH: number,
    offsetDots = 0
): HTMLCanvasElement => {
    const out = document.createElement('canvas');
    out.width = dotsW + offsetDots;
    out.height = dotsH;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, dotsH);
    ctx.drawImage(source, offsetDots, 0, dotsW, dotsH);

    // Collapse to pure black/white before handing the bitmap over. The print
    // head is 1-bit, so *something* has to binarise this -- doing it here
    // means it happens at a known 50% midpoint rather than whatever
    // threshold (or dither) the ESC/POS encoder picks. Dithering especially
    // would shred a barcode, turning solid bars into stipple. Even at an
    // exact OVERSAMPLE:1 ratio Chrome's high-quality downscale filter bleeds
    // slightly across bar edges; this cleans that back into the crisp
    // whole-dot modules a scanner needs.
    const img = ctx.getImageData(0, 0, out.width, dotsH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const luma = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const v = luma < 128 ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    return out;
};

const canvasToBase64 = (c: HTMLCanvasElement): string =>
    c.toDataURL('image/png', 1.0).split(',')[1];

/** Roll geometry beyond the label's own size. Both are die-cut concerns. */
export interface ThermalRollOptions {
    /** Vertical gap between labels, mm. Set => feed instead of cut. */
    gapMm?: number;
    /** Left inset of the stock within the printable area, mm. */
    offsetMm?: number;
    /**
     * Cut once after the final label, to free the finished strip from the
     * roll. Only ever once per batch -- cutting between labels cannot work
     * on this printer (see the note further down).
     */
    cutAtEnd?: boolean;
}

const CUT_AT_END_KEY = 'thermal_cut_at_end';

export const getCutAtEnd = (): boolean => {
    try {
        return localStorage.getItem(CUT_AT_END_KEY) === '1';
    } catch {
        return false;
    }
};

export const setCutAtEnd = (value: boolean): void => {
    try {
        localStorage.setItem(CUT_AT_END_KEY, value ? '1' : '0');
    } catch {
        // localStorage unavailable -- the preference just won't persist.
    }
};

export const printLabelsOnThermalPrinter = async (
    items: ThermalLabelItem[],
    requestedSize: LabelCanvasSize,
    printerName?: string,
    roll: ThermalRollOptions = {}
): Promise<void> => {
    // The offset eats into the width available for the label itself, so it
    // has to be reserved before the label is clamped to the printable area.
    const offsetDots = Math.max(0, mmToDots(roll.offsetMm ?? 0, true));
    const maxLabelWidthMm = ((THERMAL_MAX_DOTS_WIDTH - offsetDots) / THERMAL_DPI) * 25.4;

    const size: LabelCanvasSize = {
        widthMm: Math.min(requestedSize.widthMm, maxLabelWidthMm),
        heightMm: requestedSize.heightMm,
    };

    const dotsW = Math.min(mmToDots(size.widthMm, true), THERMAL_MAX_DOTS_WIDTH - offsetDots);
    const dotsH = mmToDots(size.heightMm);

    // Die-cut stock: advance to the next label instead of cutting.
    //
    // With no gap sensor on this printer, accumulated feed error is the only
    // thing that can walk the artwork off the stickers, and the two units
    // involved fight each other: the raster advances in 203dpi dots while
    // ESC J feeds in 1/180", and the pitch is a whole multiple of neither.
    // Rounding each label's feed independently therefore leaves a small
    // constant bias -- roughly 1mm per 100 labels here -- so instead the
    // true cumulative position is tracked in mm and every feed is derived
    // from how far behind that target the paper actually is. The rounding
    // remainder carries into the next label rather than being discarded,
    // which keeps long runs locked to the real pitch.
    const isDieCut = (roll.gapMm ?? 0) > 0;
    const pitchMm = size.heightMm + (roll.gapMm ?? 0);
    const contentAdvanceMm = (dotsH / THERMAL_DPI) * 25.4;
    let advancedMm = 0;
    let labelsEmitted = 0;

    const base64Cache = new Map<string, string>();
    const jobs: RasterPrintJob[] = [];

    for (const item of items) {
        if (item.quantity < 1) continue;
        if (!base64Cache.has(item.sku)) {
            // Render at an exact whole multiple of the final dot grid so the
            // downsample below is a clean OVERSAMPLE:1 box average -- that is
            // what keeps barcode bars solid black instead of anti-aliased
            // grey, which a 1-bit thermal head cannot reproduce faithfully.
            const sourceCanvas = await renderLabelToCanvas(
                { sku: item.sku, name: item.name },
                size,
                { width: dotsW * OVERSAMPLE, height: dotsH * OVERSAMPLE }
            );
            const device = toDeviceRaster(sourceCanvas, dotsW, dotsH, offsetDots);
            base64Cache.set(item.sku, canvasToBase64(device));
        }
        const base64Png = base64Cache.get(item.sku)!;
        for (let i = 0; i < item.quantity; i++) {
            // Die-cut stock is peeled, not cut -- feed across the gap onto
            // the next label. Continuous stock gets a cut per label, since
            // each one is a separate sticker rather than a running receipt.
            if (!isDieCut) {
                jobs.push({ base64Png, cutAfter: true });
                continue;
            }
            labelsEmitted++;
            advancedMm += contentAdvanceMm;
            const feedUnits = Math.max(
                0,
                Math.round((pitchMm * labelsEmitted - advancedMm) / FEED_UNIT_MM)
            );
            advancedMm += feedUnits * FEED_UNIT_MM;
            jobs.push({ base64Png, feedUnitsAfter: feedUnits });
        }
    }

    if (jobs.length === 0) return;

    // Die-cut stock is never cut by the printer -- the strip is torn by hand.
    //
    // Having the printer cut each label free was built and then removed. The
    // scheme it needs is "chained printing": print into the strip between
    // head and blade so the blade is already on the label boundary, then cut
    // without feeding. It simulates perfectly, but the hardware does not
    // cooperate -- this unit advances the paper about 10mm of its own accord
    // when it receives GS V 0, and never winds it back, so every label after
    // the first comes out missing its leading 10mm. Undoing that needs
    // reverse-feed, which the firmware does not expose over ESC/POS.
    //
    // Leaving the paper where it is keeps every label exactly one pitch
    // apart, wastes nothing, and the die-cut edges separate by peeling
    // anyway. Do not reintroduce a per-label cut here without first
    // confirming the printer can cut in place.
    //
    // One cut at the very end is a different matter and is safe to offer:
    // it frees the finished strip from the roll, and whatever the blade
    // costs is paid once per batch instead of once per label. It does leave
    // the paper somewhere the next batch cannot assume, so the roll has to
    // be repositioned afterwards -- which is why this is opt-in.
    if (isDieCut && roll.cutAtEnd) {
        jobs[jobs.length - 1] = { ...jobs[jobs.length - 1], cutAfter: true };
    }

    const targetPrinter = printerName ?? (await resolveThermalPrinterName());
    await printRasterJobs(targetPrinter, jobs);
};
