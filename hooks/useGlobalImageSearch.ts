import { useEffect, useState, useRef } from 'react';
// Import Vite worker natively
import ImageWorker from '../workers/imageEmbedder.worker?worker';

export interface ImageSearchState {
    status: 'idle' | 'loading' | 'processing' | 'success' | 'error';
    message: string;
    embedding: number[] | null;
    error: string | null;
}

export function useGlobalImageSearch(onEmbeddingFound: (embedding: number[], previewUrl: string) => void) {
    const [searchState, setSearchState] = useState<ImageSearchState>({
        status: 'idle',
        message: '',
        embedding: null,
        error: null
    });
    const [isDragging, setIsDragging] = useState(false);
    const workerRef = useRef<Worker | null>(null);
    const previewUrlRef = useRef<string>('');

    // Keep the callback ref updated to avoid stale closures
    const onEmbeddingFoundRef = useRef(onEmbeddingFound);
    useEffect(() => {
        onEmbeddingFoundRef.current = onEmbeddingFound;
    }, [onEmbeddingFound]);

    useEffect(() => {
        // Initialize Web Worker
        workerRef.current = new ImageWorker();

        workerRef.current.onmessage = (event: MessageEvent) => {
            const { status, message, embedding, error } = event.data;

            if (status === 'loading') {
                setSearchState(prev => ({ ...prev, status: 'loading', message }));
            } else if (status === 'ready') {
                setSearchState(prev => ({ ...prev, status: 'idle', message: '' }));
            } else if (status === 'processing') {
                setSearchState(prev => ({ ...prev, status: 'processing', message }));
            } else if (status === 'success' && embedding) {
                setSearchState({
                    status: 'success',
                    message: 'Búsqueda completada',
                    embedding,
                    error: null
                });
                onEmbeddingFoundRef.current(embedding, previewUrlRef.current);
            } else if (status === 'error') {
                setSearchState({
                    status: 'error',
                    message: 'Error al procesar la imagen',
                    embedding: null,
                    error: error || 'Error desconocido'
                });
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const processImageFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setSearchState({
                status: 'error',
                message: 'El archivo debe ser una imagen',
                embedding: null,
                error: 'Tipo de archivo no válido'
            });
            return;
        }

        // Clean up previous preview URL to avoid memory leaks
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
        }
        
        previewUrlRef.current = URL.createObjectURL(file);
        
        const reader = new FileReader();
        reader.onload = () => {
            const buffer = reader.result as ArrayBuffer;
            if (workerRef.current) {
                setSearchState(prev => ({ ...prev, status: 'processing', message: 'Preparando imagen...' }));
                workerRef.current.postMessage({
                    action: 'embed',
                    imageBuffer: buffer
                }, [buffer]); // transfer ownership of buffer
            }
        };
        reader.readAsArrayBuffer(file);
    };

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();
                        processImageFile(file);
                        break;
                    }
                }
            }
        };

        const handleDragOver = (event: DragEvent) => {
            event.preventDefault();
            setIsDragging(true);
        };

        const handleDragLeave = (event: DragEvent) => {
            event.preventDefault();
            setIsDragging(false);
        };

        const handleDrop = (event: DragEvent) => {
            event.preventDefault();
            setIsDragging(false);
            
            const files = event.dataTransfer?.files;
            if (files && files.length > 0) {
                processImageFile(files[0]);
            }
        };

        window.addEventListener('paste', handlePaste);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('paste', handlePaste);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
        };
    }, []);

    const resetSearch = () => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = '';
        }
        setSearchState({
            status: 'idle',
            message: '',
            embedding: null,
            error: null
        });
    };

    return { searchState, isDragging, resetSearch, processImageFile };
}
