import React, { useState } from 'react';

const REMITENTE = {
    nombre: 'Freddy Fernando Avila Andrade',
    direccion: 'Jose Antepara 4519 Rosendo Aviles',
    ciudad: 'Guayaquil',
    telefono: '0993279707',
    cedulaRuc: '1720596905',
};

interface Destinatario {
    nombre: string;
    direccion: string;
    ciudad: string;
    telefono: string;
    cedulaRuc: string;
}

const EMPTY_DESTINATARIO: Destinatario = {
    nombre: '',
    direccion: '',
    ciudad: '',
    telefono: '',
    cedulaRuc: '',
};

const OrderShipments: React.FC = () => {
    const [destinatario, setDestinatario] = useState<Destinatario>(EMPTY_DESTINATARIO);

    const isComplete = Object.values(destinatario).every((v) => v.trim().length > 0);

    const handleChange = (field: keyof Destinatario) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setDestinatario((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handlePrint = () => {
        if (!isComplete) return;
        window.print();
    };

    const handleClear = () => setDestinatario(EMPTY_DESTINATARIO);

    return (
        <div className="p-6 md:p-8 max-w-3xl mx-auto">
            <style>{'@media print { @page { margin: 5mm; size: auto; } }'}</style>
            {/* ── Editor (oculto al imprimir) ─────────────────────── */}
            <div className="print:hidden">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Envíos</h1>
                    <p className="text-slate-500 text-sm mt-1">Genera la guía de despacho para pegar en el paquete.</p>
                </div>

                {/* Remitente (fijo) */}
                <div className="bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-4">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Remitente</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div><span className="text-slate-500">Nombre:</span> <span className="font-medium text-slate-900 dark:text-white">{REMITENTE.nombre}</span></div>
                        <div><span className="text-slate-500">Dirección:</span> <span className="font-medium text-slate-900 dark:text-white">{REMITENTE.direccion}</span></div>
                        <div><span className="text-slate-500">Ciudad:</span> <span className="font-medium text-slate-900 dark:text-white">{REMITENTE.ciudad}</span></div>
                        <div><span className="text-slate-500">Teléfono:</span> <span className="font-medium text-slate-900 dark:text-white">{REMITENTE.telefono}</span></div>
                        <div><span className="text-slate-500">Cédula/RUC:</span> <span className="font-medium text-slate-900 dark:text-white">{REMITENTE.cedulaRuc}</span></div>
                    </div>
                </div>

                {/* Destinatario (formulario) */}
                <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-4">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Destinatario</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                            type="text" placeholder="Nombre completo *"
                            value={destinatario.nombre} onChange={handleChange('nombre')}
                            className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 text-sm bg-transparent"
                        />
                        <input
                            type="text" placeholder="Teléfono *"
                            value={destinatario.telefono} onChange={handleChange('telefono')}
                            className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 text-sm bg-transparent"
                        />
                        <input
                            type="text" placeholder="Dirección *"
                            value={destinatario.direccion} onChange={handleChange('direccion')}
                            className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 text-sm bg-transparent sm:col-span-2"
                        />
                        <input
                            type="text" placeholder="Ciudad *"
                            value={destinatario.ciudad} onChange={handleChange('ciudad')}
                            className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 text-sm bg-transparent"
                        />
                        <input
                            type="text" placeholder="Cédula o RUC *"
                            value={destinatario.cedulaRuc} onChange={handleChange('cedulaRuc')}
                            className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 text-sm bg-transparent"
                        />
                    </div>
                    {!isComplete && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                            Completa todos los datos del destinatario para poder imprimir.
                        </p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleClear}
                        className="px-4 py-2 rounded-md font-medium text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Limpiar
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={!isComplete}
                        className="px-5 py-2 rounded-md font-bold text-sm text-white bg-primary hover:bg-primary/90 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        Imprimir Guía
                    </button>
                </div>
            </div>

            {/* ── Guía imprimible (oculta en pantalla, visible solo al imprimir) ──
                 Tamaño de etiqueta pequeña (~11.25cm de ancho, 25% más grande
                 que el original de 9cm) para que quepa en repuestos chicos:
                 no ocupa toda la hoja, solo un recuadro que se recorta y se
                 pega en el paquete. */}
            <div className="hidden print:block text-black" style={{ width: '11.25cm', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                <div className="border-2 border-black rounded-md overflow-hidden">
                    {/* Dos columnas: remitente (izquierda) / destinatario (derecha) */}
                    <div className="flex">
                        <div className="flex-1 px-2.5 py-3 border-r-2 border-black" style={{ fontSize: '11px', lineHeight: 1.65 }}>
                            <p className="font-bold uppercase tracking-wide text-slate-600 mb-1" style={{ fontSize: '10px' }}>De</p>
                            <p className="font-bold" style={{ fontSize: '12px' }}>{REMITENTE.nombre}</p>
                            <p>{REMITENTE.direccion}</p>
                            <p>{REMITENTE.ciudad}</p>
                            <p>Tel: {REMITENTE.telefono}</p>
                            <p>C.I./RUC: {REMITENTE.cedulaRuc}</p>
                        </div>

                        <div className="flex-1 px-2.5 py-3" style={{ fontSize: '11px', lineHeight: 1.65 }}>
                            <p className="font-bold uppercase tracking-wide text-slate-600 mb-1" style={{ fontSize: '10px' }}>Para</p>
                            <p className="font-bold" style={{ fontSize: '13.5px' }}>{destinatario.nombre}</p>
                            <p>{destinatario.direccion}</p>
                            <p className="font-bold">{destinatario.ciudad}</p>
                            <p>Tel: {destinatario.telefono}</p>
                            <p>C.I./RUC: {destinatario.cedulaRuc}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderShipments;
