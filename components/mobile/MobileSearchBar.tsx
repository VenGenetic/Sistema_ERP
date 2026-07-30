import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getSuggestions } from '../../utils/mobileSearchEngine';

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

    // Sync local value when parent changes searchTerm (e.g. clear)
    useEffect(() => {
        setLocalValue(searchTerm);
    }, [searchTerm]);

    // Debounced search: update parent after 250ms of no typing
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val); // instant local update for responsive typing

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchTerm(val); // trigger expensive search after pause
        }, 250);
    }, [setSearchTerm]);

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

    const busquedasPopulares = ['Freno', 'Pastillas', 'Batería', 'Cadena', 'Arrastre', 'Llanta', 'Faro', 'Aceite', 'Bujía'];

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = false;
                recognitionRef.current.lang = 'es-ES';
                recognitionRef.current.onresult = (event: any) => {
                    const transcript = event.results[0]?.[0]?.transcript;
                    if (transcript) {
                        const cleaned = transcript.trim().replace(/\.$/, '');
                        setLocalValue(cleaned);
                        setSearchTerm(cleaned);
                    }
                    setIsListening(false);
                };
                recognitionRef.current.onend = () => setIsListening(false);
                recognitionRef.current.onerror = () => setIsListening(false);
            }
        } catch (error) {
            console.error('Error inicializando micrófono:', error);
        }
    }, [setSearchTerm]);

    const handleVoiceSearch = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!recognitionRef.current) {
            alert('Tu navegador no soporta búsqueda por voz.');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
        inputRef.current?.focus();
    };

    const handleSuggestionClick = (sugerencia: string) => {
        const cleaned = sugerencia.replace(/"/g, '');
        setLocalValue(cleaned);
        setSearchTerm(cleaned);
        setIsFocused(false);
        inputRef.current?.blur();
    };

    const handleClearClick = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setLocalValue('');
        setSearchTerm('');
        if (onClear) onClear();
        inputRef.current?.focus();
    };

    const showSuggestions = isFocused && (sugerencias.length > 0 || (!localValue && busquedasPopulares.length > 0));

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
                    : 'bg-slate-900/90 border-slate-700 shadow-sm hover:border-slate-600'
            }`}>
                {/* Icono Lupa o Escaner */}
                <div className="pl-4 text-slate-400 dark:text-slate-400 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-[24px]">
                        {localValue ? 'search' : 'qr_code_scanner'}
                    </span>
                </div>

                {/* Campo de Texto */}
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    className="w-full px-3 py-3.5 bg-transparent text-slate-800 dark:text-white text-base placeholder:text-slate-400 dark:placeholder:text-slate-400 outline-none border-none focus:ring-0 rounded-2xl font-medium"
                    value={localValue}
                    onChange={handleInputChange}
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
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center active:scale-90"
                            title="Limpiar"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    )}

                    {/* Divisor vertical */}
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

                    {/* Botón de Voz */}
                    {hasSpeechSupport && (
                        <button
                            type="button"
                            onClick={handleVoiceSearch}
                            className={`p-2 rounded-xl transition-all flex items-center justify-center active:scale-90 ${
                                isListening
                                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse'
                                    : 'text-slate-400 hover:text-amber-400 hover:bg-slate-700'
                            }`}
                            title="Buscar por voz"
                        >
                            <span className="material-symbols-outlined text-[22px]">
                                {isListening ? 'mic_off' : 'mic'}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* PANEL DE SUGERENCIAS */}
            {showSuggestions && (
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-down origin-top max-h-[65vh] overflow-y-auto">
                    
                    {/* Si NO hay búsqueda: Mostrar Populares / Más Buscado */}
                    {!localValue ? (
                        <div className="p-4">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-3">
                                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                                Búsqueda Rápida / Populares
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {busquedasPopulares.map((term) => (
                                    <button
                                        key={term}
                                        type="button"
                                        onClick={() => handleSuggestionClick(term)}
                                        className="px-3.5 py-2 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-sm font-semibold rounded-xl transition-all active:scale-95 border border-slate-700 shadow-xs"
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Si HAY búsqueda: Mostrar Coincidencias Rápida */
                        <div className="py-2">
                            <div className="px-4 py-2 text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center">
                                <span>Coincidencias Rápida</span>
                                <span className="text-amber-400 font-extrabold">{sugerencias.length} resultados</span>
                            </div>
                            
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {sugerencias.map((sugerencia, index) => {
                                    const isCode = sugerencia.startsWith('"');
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => handleSuggestionClick(sugerencia)}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-800/80 flex items-center gap-3 group transition-colors border-l-4 border-transparent hover:border-amber-500 active:bg-slate-750"
                                        >
                                            <div className={`p-1.5 rounded-xl flex items-center justify-center ${
                                                isCode ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400 group-hover:text-amber-400'
                                            }`}>
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {isCode ? 'history' : 'search'}
                                                </span>
                                            </div>
                                            <span className={`flex-1 text-sm ${
                                                isCode ? 'font-mono font-bold text-amber-400' : 'text-slate-200 font-semibold'
                                            }`}>
                                                {sugerencia.replace(/"/g, '')}
                                            </span>
                                            <span className="material-symbols-outlined text-slate-600 group-hover:text-amber-400 text-[18px] transition-transform group-hover:translate-x-1">
                                                chevron_right
                                            </span>
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
