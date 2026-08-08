/**
 * qzTray.ts
 * Thin wrapper around the QZ Tray browser connector (https://qz.io).
 *
 * QZ Tray is a small local application that must be installed and running
 * (system tray icon) on whichever Windows machine is physically connected
 * to the thermal printer. It lets this web app send raw ESC/POS bytes
 * straight to the printer over its own local websocket, bypassing the
 * Windows print spooler/driver and the browser's print dialog entirely.
 *
 * This exists to fix a class of bugs that are otherwise very hard to fix
 * from CSS/@page alone: browser printing via window.print() hands the page
 * off to whatever "paper size" the Windows printer driver decides to use,
 * and cheap thermal/label printer drivers frequently ignore the requested
 * @page size or silently rotate/rescale the content. Sending raw ESC/POS
 * raster commands removes that translation layer -- the bytes we send are
 * exactly what gets printed, at the exact size we computed.
 */
import qz from 'qz-tray';

const SAVED_PRINTER_KEY = 'thermal_printer_name';

let securityConfigured = false;

// Anonymous/unsigned connection: acceptable for an internal LAN tool with
// no signing server. QZ Tray will prompt once on the host machine to allow
// the connection (the user can tick "remember this decision" there).
const configureSecurity = (): void => {
    if (securityConfigured) return;
    qz.security.setCertificatePromise((resolve: () => void) => resolve());
    qz.security.setSignaturePromise(() => (resolve: () => void) => resolve());
    securityConfigured = true;
};

export const ensureQzConnected = async (): Promise<void> => {
    configureSecurity();
    if (qz.websocket.isActive()) return;
    try {
        await qz.websocket.connect();
    } catch (err) {
        throw new Error(
            'No se pudo conectar con QZ Tray. Verifica que la aplicación "QZ Tray" esté instalada y ' +
            'corriendo (ícono en la bandeja del sistema) en esta computadora, y que hayas aceptado el ' +
            'permiso de conexión la primera vez que lo pidió.'
        );
    }
};

export const isQzConnected = (): boolean => {
    try {
        return qz.websocket.isActive();
    } catch {
        return false;
    }
};

/** All printer names visible to QZ Tray on this machine. */
export const listQzPrinters = async (): Promise<string[]> => {
    await ensureQzConnected();
    const result = await qz.printers.find();
    return Array.isArray(result) ? result : [result];
};

export const getSavedPrinterName = (): string | null => {
    try {
        return localStorage.getItem(SAVED_PRINTER_KEY);
    } catch {
        return null;
    }
};

export const setSavedPrinterName = (name: string): void => {
    try {
        localStorage.setItem(SAVED_PRINTER_KEY, name);
    } catch {
        // localStorage unavailable (private mode, etc.) -- non-fatal, the
        // printer just has to be re-picked/re-detected next time.
    }
};

/**
 * Resolves which printer to send label jobs to: a previously saved/chosen
 * one, or -- for the common single-printer setup -- the machine's default
 * printer, which is then remembered for next time.
 */
export const resolveThermalPrinterName = async (): Promise<string> => {
    const saved = getSavedPrinterName();
    if (saved) return saved;

    await ensureQzConnected();
    const defaultPrinter = await qz.printers.getDefault();
    if (!defaultPrinter) {
        throw new Error(
            'No se encontró una impresora predeterminada en QZ Tray. Selecciónala manualmente desde ' +
            'el selector de impresora térmica.'
        );
    }
    setSavedPrinterName(defaultPrinter);
    return defaultPrinter;
};

export interface RasterPrintJob {
    /** Base64-encoded PNG (no "data:image/png;base64," prefix), already sized to the exact target dot dimensions. */
    base64Png: string;
    /** Send a paper-feed + cut command after this image. */
    cutAfter?: boolean;
    /**
     * Advance this many 1/180" units after the image without cutting --
     * used to cross the gap on die-cut label stock, where the labels are
     * peeled off and a cut would destroy the alignment of the next one.
     * Carried in the printer's own feed units rather than mm or dots so
     * the caller owns how the pitch gets rounded: the quantisation is
     * coarse enough (0.141mm) that letting it happen per-label, out of
     * sight, accumulates into visible drift over a long run.
     * Ignored when cutAfter is set.
     */
    feedUnitsAfter?: number;
}

// The cutter blade sits downstream of the print head, so the last dot row
// printed is still *at the head* when the job ends. The paper has to
// advance by the head-to-blade gap for that row to reach the blade --
// otherwise the cut lands inside the label and everything past the cut
// point stays in the printer, reappearing on top of the next label.
//
// Measured on this unit: with the previous 24/180" (~3.4mm) feed the cut
// fell between the barcode (which ends 36.6mm down a 50mm label) and the
// SKU line (starts 41.3mm), putting the gap at roughly 12-17mm. 18mm
// clears that whole range with a couple of mm to spare; the cost of
// overshooting is only a few mm of blank paper, while undershooting cuts
// through the label. Raise this if a cut still lands early.
// Measured, not guessed: a 60mm ruler printed and then cut with no feed at
// all came out severed at the 50mm mark, so the blade trails the head by
// 60 - 50 = 10mm. That agrees with an earlier observation too -- a 50mm
// label fed 3.4mm before cutting was severed just past its barcode (which
// ends 36.6mm down), and 50 - 10 + 3.4 = 43.4mm lands exactly there.
export const HEAD_TO_CUTTER_MM = 10;

// ESC J counts in 1/180", which is not the head's own 203 dpi dot pitch --
// distances have to be converted into feed units before they can be fed.
export const FEED_UNIT_MM = 25.4 / 180;
const mmToFeedUnits = (mm: number): number => Math.round(mm / FEED_UNIT_MM);

/**
 * ESC J n advances the paper n/180". n travels as a single raw character,
 * and anything above 0x7F risks being widened into two bytes by UTF-8
 * encoding before it reaches the printer -- so a long feed is emitted as
 * several chained commands of at most 127 rather than one oversized byte.
 */
const escPosFeed = (units: number): string => {
    let remaining = Math.max(0, Math.round(units));
    let out = '';
    while (remaining > 0) {
        const step = Math.min(127, remaining);
        out += '\x1B' + '\x4A' + String.fromCharCode(step);
        remaining -= step;
    }
    return out;
};

// Standard ESC/POS commands (same across ESC/POS-compatible thermal
// printers, including the POS-8360): ESC J n feeds, then GS V 0 full-cuts.
const ESC_POS_FEED_BEFORE_CUT = escPosFeed(mmToFeedUnits(HEAD_TO_CUTTER_MM));
const ESC_POS_FULL_CUT = '\x1D' + '\x56' + '\x00'; // GS V 0

/**
 * Sends one or more pre-rendered label bitmaps to the thermal printer as
 * raw ESC/POS raster (GS v 0) commands via QZ Tray. Each bitmap must
 * already be sized in real device dots (not mm/inches) -- see
 * mmToPrinterDots() in thermalLabelPrinter.ts -- since dotDensity is
 * fixed at 'single' here (1 image pixel = 1 printer dot, no rescaling).
 */
export const printRasterJobs = async (printerName: string, jobs: RasterPrintJob[]): Promise<void> => {
    if (jobs.length === 0) return;

    await ensureQzConnected();
    const config = qz.configs.create(printerName);

    const data: any[] = [];
    for (const job of jobs) {
        data.push({
            type: 'raw',
            format: 'image',
            flavor: 'base64',
            data: job.base64Png,
            options: {
                language: 'ESCPOS',
                dotDensity: 'single',
                imageEncoding: 'gs_v_0',
            },
        });
        if (job.cutAfter) {
            data.push(ESC_POS_FEED_BEFORE_CUT + ESC_POS_FULL_CUT);
        } else if (job.feedUnitsAfter && job.feedUnitsAfter > 0) {
            data.push(escPosFeed(job.feedUnitsAfter));
        }
    }

    await qz.print(config, data);
};

/**
 * Converts a byte array to base64 without going through String.fromCharCode
 * on the whole array at once -- spreading a large typed array into that
 * call as individual arguments can blow the JS engine's argument-count
 * limit. Chunking keeps it safe for arbitrarily large bitmaps.
 */
const uint8ToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
};

/**
 * Sends one complete TSPL command stream (page setup + BITMAP + PRINT,
 * built by thermalLabelPrinter.ts) to the Xprinter XP-450B label printer.
 *
 * Unlike the ESC/POS path above, this does not ask QZ Tray to encode an
 * image for us -- the caller has already rendered, binarised and bit-packed
 * the label into a raw TSPL byte stream (ASCII setup commands + a binary
 * BITMAP payload + the PRINT trigger). That stream contains non-text bytes,
 * so it travels as a single base64-encoded raw command rather than a plain
 * string: QZ Tray decodes it back to the exact bytes and writes them to the
 * printer as-is, with nothing in between able to reinterpret them.
 */
export const printTsplJob = async (printerName: string, tsplBytes: Uint8Array): Promise<void> => {
    await ensureQzConnected();
    const config = qz.configs.create(printerName);
    await qz.print(config, [
        { type: 'raw', format: 'command', flavor: 'base64', data: uint8ToBase64(tsplBytes) },
    ]);
};
