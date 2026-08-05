import React, { useState } from 'react';
import { listQzPrinters, getSavedPrinterName, setSavedPrinterName } from '../utils/qzTray';

/**
 * Lets the user see/override which QZ Tray printer receives thermal label
 * jobs (utils/thermalLabelPrinter.ts). Most single-printer setups never
 * need to touch this -- printLabelsOnThermalPrinter() auto-falls-back to
 * Windows' default printer the first time it runs -- but this is here for
 * machines with more than one printer registered, or to fix a wrong
 * auto-detected default.
 */
export const ThermalPrinterSelector: React.FC = () => {
    const [current, setCurrent] = useState<string | null>(getSavedPrinterName());
    const [options, setOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDetect = async () => {
        setLoading(true);
        setError(null);
        try {
            const printers = await listQzPrinters();
            setOptions(printers);
            if (printers.length === 1) {
                setSavedPrinterName(printers[0]);
                setCurrent(printers[0]);
            }
        } catch (err: any) {
            setError(err.message || 'No se pudo conectar con QZ Tray.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (name: string) => {
        setSavedPrinterName(name);
        setCurrent(name);
    };

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Impresora térmica (QZ Tray):</label>
            <div className="flex items-center gap-2">
                {options.length > 0 ? (
                    <select
                        value={current ?? ''}
                        onChange={(e) => handleSelect(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                        {options.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                ) : (
                    <div className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 dark:text-slate-400 truncate">
                        {current ?? 'Sin detectar (se usará la predeterminada de Windows)'}
                    </div>
                )}
                <button
                    type="button"
                    onClick={handleDetect}
                    disabled={loading}
                    className="px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg border border-primary/30 disabled:opacity-60 shrink-0"
                    title="Detectar impresoras disponibles vía QZ Tray"
                >
                    {loading ? '...' : 'Detectar'}
                </button>
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
    );
};
