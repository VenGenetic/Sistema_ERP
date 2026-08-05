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
}

// Standard ESC/POS commands (same across ESC/POS-compatible thermal
// printers, including the POS-8360): ESC J n feeds n/180" of paper before
// cutting so the blade doesn't land on the last printed line, then GS V 0
// performs a full cut.
const ESC_POS_FEED_BEFORE_CUT = '\x1B' + '\x4A' + '\x18'; // ESC J 24
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
        }
    }

    await qz.print(config, data);
};
