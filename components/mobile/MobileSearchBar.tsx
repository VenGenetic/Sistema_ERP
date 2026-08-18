import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronRight, Clock, History, Mic, MicOff, ScanLine, Search, TrendingUp, X } from 'lucide-react';
import { getSuggestions } from '../../utils/mobileSearchEngine';
import { getSearchHistory, rememberSearch } from '../../utils/mobileSearchHistory';

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

interface MobileSearchBarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    products: any[];
    placeholder?: string;
    onClear?: () => void;
    autoFocus?: boolean;
}

const MobileSearchBar: React.FC<MobileSearchBarProps> = ({
    searchTerm,
    setSearchTerm,
    products,
    placeholder = "Escanea código o busca repuesto...",
    onClear,
    autoFocus = false
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [localValue, setLocalValue] = useState(searchTerm);
    const [hasSpeechSupport] = useState(() => {
        return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    });

    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // `setSearchTerm` suele llegar como flecha en línea, así que su identidad
    // cambia en cada render del padre. Leerlo por ref permite montar el
    // micrófono una sola vez (ver el efecto de abajo) sin quedarse con una
    // versión caducada del callback.
    const setSearchTermRef = useRef(setSearchTerm);
    setSearchTermRef.current = setSearchTerm;

    /*
        Último valor que este componente le mandó al padre.

        El campo se sincronizaba con `searchTerm` en cada cambio, y `searchTerm`
        llega con 250 ms de retardo: si una pulsación caía justo después de que
        disparara el temporizador, el efecto devolvía al campo el valor anterior
        y borraba lo último tecleado. Con un lector de código —que teclea a
        ráfagas— era fácil dar con esa ventana y perder un carácter del código.

        Guardando lo que hemos emitido, el campo sólo se resincroniza cuando el
        cambio viene de fuera (limpiar desde la pantalla, restaurar un término),
        que es para lo único que hacía falta.
    */
    const emittedRef = useRef(searchTerm);

    useEffect(() => {
        if (searchTerm === emittedRef.current) return;
        emittedRef.current = searchTerm;
        setLocalValue(searchTerm);
    }, [searchTerm]);

    const commit = useCallback((val: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        emittedRef.current = val;
        setSearchTerm(val);
    }, [setSearchTerm]);

    // Debounced search: update parent after 250ms of no typing
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val); // instant local update for responsive typing

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            commit(val); // trigger expensive search after pause
        }, 250);
    }, [commit]);

    /*
        El lector físico cierra el código con Enter, y no había nada escuchando:
        aunque el código llegara entero había que esperar igual los 250 ms del
        retardo. Enter confirma en el acto, guarda el término y cierra el teclado.
    */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const val = localValue.trim();
        commit(val);
        if (val.length >= 2) {
            rememberSearch(val);
            setHistory(getSearchHistory());
        }
        setIsFocused(false);
        inputRef.current?.blur();
    };

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // Suggestions use debounced search term (parent's searchTerm), NOT localValue
    const sugerencias = useMemo(() => {
        if (!searchTerm || searchTerm.trim().length < 2) return [];
        return getSuggestions(products, searchTerm, 6);
    }, [products, searchTerm]);

    /*
        Lo que de verdad busca quien tiene el teléfono en la mano, no una lista
        escrita a mano. Si todavía no hay historial se cae a unos términos
        habituales del taller, que al menos dan algo que tocar el primer día.
    */
    const [history, setHistory] = useState<string[]>(getSearchHistory);
    const busquedasHabituales = ['Freno', 'Pastillas', 'Batería', 'Cadena', 'Arrastre', 'Llanta', 'Faro', 'Aceite', 'Bujía'];
    const atajos = history.length > 0 ? history : busquedasHabituales;
    const mostrandoHistorial = history.length > 0;

    /*
        El micrófono se monta UNA vez y se apaga al desmontar.

        Antes el efecto dependía de `setSearchTerm`: como el padre lo pasa en
        línea, se creaba un `SpeechRecognition` nuevo en cada render y el
        anterior quedaba suelto. Y sin limpieza, salir de la pantalla mientras
        escuchaba dejaba el micrófono encendido y el indicador del sistema
        puesto hasta recargar la app.
    */
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;

            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            // Español de Ecuador: reconoce mejor los nombres de repuesto dictados aquí.
            recognition.lang = 'es-EC';
            recognition.onresult = (event: any) => {
                const transcript = event.results[0]?.[0]?.transcript;
                if (transcript) {
                    const cleaned = transcript.trim().replace(/\.$/, '');
                    setLocalValue(cleaned);
                    setSearchTermRef.current(cleaned);
                    if (cleaned.length >= 2) rememberSearch(cleaned);
                }
            };
            // El estado lo mandan los eventos del propio reconocedor, no la
            // suposición del que pulsa: si el navegador niega el permiso o lo
            // corta por silencio, el botón dejaba de parpadear solo por
            // `onend`, pero podía haber quedado en rojo tras un `start()` que
            // nunca llegó a arrancar.
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = () => setIsListening(false);

            recognitionRef.current = recognition;

            return () => {
                recognition.onresult = null;
                recognition.onstart = null;
                recognition.onend = null;
                recognition.onerror = null;
                try { recognition.abort(); } catch { /* nunca llegó a arrancar */ }
                recognitionRef.current = null;
            };
        } catch (error) {
            console.error('Error inicializando micrófono:', error);
        }
    }, []);

    const handleVoiceSearch = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const recognition = recognitionRef.current;
        if (!recognition) return;

        // `start()` lanza InvalidStateError si ya estaba escuchando, y ese caso
        // se da de verdad: `onend` puede llegar tarde y dejar `isListening`
        // desfasado respecto al reconocedor.
        try {
            if (isListening) recognition.stop();
            else recognition.start();
        } catch (error) {
            console.warn('No se pudo alternar el micrófono:', error);
            setIsListening(false);
        }
        inputRef.current?.focus();
    };

    const handleSuggestionClick = (sugerencia: string) => {
        const cleaned = sugerencia.replace(/"/g, '');
        setLocalValue(cleaned);
        commit(cleaned);
        if (cleaned.length >= 2) {
            rememberSearch(cleaned);
            setHistory(getSearchHistory());
        }
        setIsFocused(false);
        inputRef.current?.blur();
    };

    const handleClearClick = () => {
        setLocalValue('');
        commit('');
        if (onClear) onClear();
        inputRef.current?.focus();
    };

    const showSuggestions = isFocused && (sugerencias.length > 0 || (!localValue && atajos.length > 0));

    // Cerrar sugerencias al tocar afuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative w-full z-30" ref={dropdownRef}>
            <div className={`relative flex items-center transition-all duration-300 rounded-2xl border ${
                isFocused
                    ? 'bg-slate-900 border-amber-500 shadow-lg ring-2 ring-amber-500/20'
                    : 'bg-slate-900/90 border-slate-700 shadow-sm'
            }`}>
                {/* Icono Lupa o Escaner */}
                <div className="pl-4 text-slate-400 flex items-center pointer-events-none">
                    {localValue
                        ? <Search size={22} aria-hidden="true" />
                        : <ScanLine size={22} aria-hidden="true" />}
                </div>

                {/*
                    Campo de Texto.

                    Sin variantes `dark:`. El modo móvil es SIEMPRE oscuro —su fondo
                    está fijo en `bg-slate-950`, no depende del tema— pero `dark:`
                    sólo se activa cuando la clase `dark` está puesta en <html>, que
                    es cosa del tema del escritorio (ver utils/theme.ts).

                    Con el tema claro activo, `text-slate-800 dark:text-white` caía
                    en el gris casi negro sobre el fondo `bg-slate-900` de la barra:
                    se escribía a ciegas. `text-base` (16px) además es obligatorio,
                    porque por debajo iOS hace zoom automático al enfocar el campo.
                */}
                <input
                    ref={inputRef}
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    placeholder={placeholder}
                    className="w-full px-3 py-3.5 bg-transparent text-white text-base placeholder:text-slate-500 outline-none border-none focus:ring-0 rounded-2xl font-medium [&::-webkit-search-cancel-button]:hidden"
                    value={localValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                />

                {/* Botón Borrar (X) y Micrófono */}
                <div className="pr-2 flex items-center gap-1 shrink-0">
                    {localValue && (
                        <button
                            type="button"
                            onClick={handleClearClick}
                            className="min-w-[44px] min-h-[44px] text-slate-400 active:text-white rounded-full active:bg-slate-700 transition-colors flex items-center justify-center active:scale-90"
                            aria-label="Limpiar búsqueda"
                        >
                            <X size={19} aria-hidden="true" />
                        </button>
                    )}

                    {/* Divisor vertical: solo tiene sentido si hay algo a cada
                        lado. Se pintaba siempre, así que en un campo vacío o sin
                        soporte de voz quedaba una rayita suelta contra el borde. */}
                    {localValue && hasSpeechSupport && (
                        <div className="h-6 w-px bg-slate-700 mx-0.5" aria-hidden="true"></div>
                    )}

                    {/* Botón de Voz */}
                    {hasSpeechSupport && (
                        <button
                            type="button"
                            onClick={handleVoiceSearch}
                            className={`min-w-[44px] min-h-[44px] rounded-xl transition-all flex items-center justify-center active:scale-90 ${
                                isListening
                                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse'
                                    : 'text-slate-400 active:text-amber-400 active:bg-slate-700'
                            }`}
                            aria-label={isListening ? 'Detener búsqueda por voz' : 'Buscar por voz'}
                            aria-pressed={isListening}
                        >
                            {isListening
                                ? <MicOff size={21} aria-hidden="true" />
                                : <Mic size={21} aria-hidden="true" />}
                        </button>
                    )}
                </div>
            </div>

            {/* PANEL DE SUGERENCIAS */}
            {showSuggestions && (
                /*
                    Mismo fallo que en el campo: era `bg-white dark:bg-slate-900`
                    con el contenido fijo en tonos claros (`text-slate-200`,
                    fichas `bg-slate-800`). Con el tema claro el panel salía blanco
                    y las coincidencias resultaban ilegibles encima.
                */
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 animate-slide-down origin-top max-h-[65dvh] overflow-y-auto overscroll-contain">
                    
                    {/* Si NO hay búsqueda: Mostrar Populares / Más Buscado */}
                    {!localValue ? (
                        <div className="p-4">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                {mostrandoHistorial
                                    ? <Clock size={15} aria-hidden="true" />
                                    : <TrendingUp size={15} aria-hidden="true" />}
                                {mostrandoHistorial ? 'Tus últimas búsquedas' : 'Búsquedas habituales'}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {atajos.map((term) => (
                                    <button
                                        key={term}
                                        type="button"
                                        onClick={() => handleSuggestionClick(term)}
                                        className="min-h-[44px] px-3.5 bg-slate-800 active:bg-amber-500 active:text-slate-950 text-slate-200 text-sm font-semibold rounded-xl transition-all active:scale-95 border border-slate-700 shadow-xs"
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Si HAY búsqueda: Mostrar Coincidencias Rápida */
                        <div className="py-2">
                            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                                <span>Coincidencias Rápida</span>
                                <span className="text-amber-400 font-extrabold">{sugerencias.length} resultados</span>
                            </div>
                            
                            <div className="divide-y divide-slate-800/50">
                                {sugerencias.map((sugerencia, index) => {
                                    const isCode = sugerencia.startsWith('"');
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => handleSuggestionClick(sugerencia)}
                                            className="w-full text-left px-4 py-3 flex items-center gap-3 group transition-colors border-l-4 border-transparent active:bg-slate-700 active:border-amber-500"
                                        >
                                            <div className={`p-1.5 rounded-xl flex items-center justify-center ${
                                                isCode ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'
                                            }`}>
                                                {isCode
                                                    ? <History size={17} aria-hidden="true" />
                                                    : <Search size={17} aria-hidden="true" />}
                                            </div>
                                            <span className={`flex-1 text-sm ${
                                                isCode ? 'font-mono font-bold text-amber-400' : 'text-slate-200 font-semibold'
                                            }`}>
                                                {sugerencia.replace(/"/g, '')}
                                            </span>
                                            <ChevronRight
                                                size={17}
                                                className="text-slate-600 transition-transform group-active:translate-x-1 group-active:text-amber-400"
                                                aria-hidden="true"
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MobileSearchBar;
