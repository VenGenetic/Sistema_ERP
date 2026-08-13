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

// qz.websocket.isActive() reports true as soon as the socket reaches
// CONNECTING, not just once it's OPEN -- so two overlapping callers (e.g.
// the printer selector's "Detectar" and a checkout print firing around the
// same time) can race: the second one sees isActive() already true, skips
// connect(), and calls straight into qz.printers.find()/print() before QZ
// Tray's onopen handler has attached connection.sendData, throwing
// "sendData is not a function". Funneling every caller through the same
// in-flight connect() promise means the second caller waits for the first
// connection attempt to actually finish instead of racing it.
let connectingPromise: Promise<void> | null = null;

export const ensureQzConnected = async (): Promise<void> => {
    configureSecurity();

    // Check the in-flight attempt *before* isActive(): isActive() alone
    // would already read true for a connection still in CONNECTING state,
    // which is exactly the state a concurrent caller must not act on yet.
    if (!connectingPromise) {
        if (qz.websocket.isActive()) return;
        connectingPromise = qz.websocket.connect().finally(() => {
            connectingPromise = null;
        });
    }

    try {
        await connectingPromise;
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
