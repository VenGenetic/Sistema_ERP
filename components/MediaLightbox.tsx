import React, { useState, useEffect, useRef } from 'react';
import { useBackDismiss } from '../hooks/useBackDismiss';
import {
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Download,
  ExternalLink,
  Plus,
  X,
} from 'lucide-react';

export interface MediaItem {
    type: 'image' | 'video';
    url: string;
    title?: string;
}

interface MediaLightboxProps {
    isOpen: boolean;
    media: MediaItem[];
    initialIndex?: number;
    onClose: () => void;
    onAddMedia?: () => void;
}

/** Recorrido mínimo del dedo para que el gesto cuente como cambio de imagen. */
const SWIPE_THRESHOLD = 56;

export const MediaLightbox: React.FC<MediaLightboxProps> = ({ isOpen, media, initialIndex = 0, onClose, onAddMedia }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Arrastre horizontal: en el teléfono se pasa de foto deslizando, no buscando
    // una flecha de 32px con el pulgar.
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const [dragX, setDragX] = useState(0);

    // Reset index when opened
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, initialIndex]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex, media.length]);

    // El botón «atrás» del teléfono cierra el visor en lugar de salir del catálogo.
    useBackDismiss(isOpen, onClose);

    if (!isOpen || media.length === 0) return null;

    // Prevención de error: si currentIndex está fuera del rango porque la lista de media cambió
    const safeIndex = currentIndex >= media.length ? 0 : currentIndex;
    const currentMedia = media[safeIndex];

    if (!currentMedia) return null; // Fallback adicional por si media[safeIndex] es undefined

    const handlePrev = () => {
        setCurrentIndex((prev) => {
            const current = prev >= media.length ? 0 : prev;
            return current === 0 ? media.length - 1 : current - 1;
        });
    };

    const handleNext = () => {
        setCurrentIndex((prev) => {
            const current = prev >= media.length ? 0 : prev;
            return current === media.length - 1 ? 0 : current + 1;
        });
    };

    /* ── Deslizar para cambiar de imagen ── */

    const handleTouchStart = (e: React.TouchEvent) => {
        if (media.length < 2) return;
        // En un vídeo el dedo es para la barra de reproducción, no para navegar.
        if ((e.target as HTMLElement).tagName === 'VIDEO') return;
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartRef.current.x;
        const dy = touch.clientY - touchStartRef.current.y;
        // Si el gesto es más vertical que horizontal, es un scroll: no lo secuestramos.
        if (Math.abs(dx) < Math.abs(dy)) return;
        setDragX(dx);
    };

    const handleTouchEnd = () => {
        if (!touchStartRef.current) return;
        if (dragX <= -SWIPE_THRESHOLD) handleNext();
        else if (dragX >= SWIPE_THRESHOLD) handlePrev();
        touchStartRef.current = null;
        setDragX(0);
    };

    const handleDownload = async (item: MediaItem) => {
        try {
            // Se usa fetch para forzar la descarga en lugar de abrir en otra pestaña (problema de CORS)
            const response = await fetch(item.url);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            
            // Extraer el SKU del título (formato: "SKU - Nombre")
            const sku = item.title ? item.title.split(' - ')[0].trim() : 'archivo';
            
            // Intentar extraer extensión de la URL, si no, usar fallback
            let ext = item.type === 'video' ? 'mp4' : 'jpg';
            try {
                const parts = item.url.split('?')[0].split('.');
                const parsedExt = parts[parts.length - 1].toLowerCase();
                if (parsedExt && parsedExt.length <= 4 && /^[a-z0-9]+$/.test(parsedExt)) {
                    ext = parsedExt;
                }
            } catch (e) {}

            a.download = `${sku}.${ext}`;
            document.body.appendChild(a);
            a.click();
            
            window.URL.revokeObjectURL(blobUrl);
            a.remove();
        } catch (error) {
            console.error('Error descargando archivo:', error);
            // Fallback si falla el fetch (ej. bloqueos estrictos)
            window.open(item.url, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={onClose}>
            {/* Download Button */}
            {/* Open in Catalog Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    // Extract SKU from title (format: "SKU - Name")
                    const sku = currentMedia.title ? currentMedia.title.split(' - ')[0].trim() : '';
                    if (sku) {
                        const url = `${window.location.origin}/#/products?search=${encodeURIComponent(sku)}`;
                        window.open(url, '_blank');
                    }
                }}
                title="Abrir en Catálogo"
                className="absolute top-6 right-36 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md z-10"
            >
                <ExternalLink size={18} aria-hidden="true" />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); handleDownload(currentMedia); }}
                title="Descargar archivo"
                className="absolute top-6 right-20 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md z-10"
            >
                <Download size={18} aria-hidden="true" />
            </button>

            {/* Close Button */}
            <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md z-10"
            >
                <X size={18} aria-hidden="true" />
            </button>

            {/* Title (Optional) */}
            {currentMedia.title && (
                <div className="absolute top-6 left-6 max-w-[70%] text-white bg-black/50 px-4 py-2 rounded-lg backdrop-blur-md z-10">
                    <h3 className="font-bold text-lg truncate">{currentMedia.title}</h3>
                    <p className="text-xs text-white/70 uppercase tracking-widest">{currentMedia.type === 'video' ? 'Video Demostrativo' : 'Fotografía Principal'}</p>
                </div>
            )}

            {/* Navigation Arrows */}
            {media.length > 1 && (
                <>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                        className="absolute left-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md z-10 hover:scale-110"
                    >
                        <ChevronLeft size={32} aria-hidden="true" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        className="absolute right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md z-10 hover:scale-110"
                    >
                        <ChevronRight size={32} aria-hidden="true" />
                    </button>
                </>
            )}

            {/* Thumbnail Carousel */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10 bg-black/40 p-3 rounded-2xl backdrop-blur-md overflow-x-auto max-w-[90vw]">
                {media.map((item, idx) => (
                    <button 
                        key={idx} 
                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                        className={`h-16 w-16 rounded-lg overflow-hidden transition-all duration-300 border-2 flex-shrink-0 ${idx === currentIndex ? 'border-primary scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    >
                        {item.type === 'video' ? (
                            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                <CirclePlay size={18} className="text-success" aria-hidden="true" />
                            </div>
                        ) : (
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                        )}
                    </button>
                ))}
                {onAddMedia && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onAddMedia(); }}
                        className="h-16 w-16 rounded-lg overflow-hidden transition-all duration-300 border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 hover:text-white hover:border-white hover:bg-white/10 flex-shrink-0"
                        title="Añadir foto/video"
                    >
                        <Plus size={24} aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Media Content */}
            <div
                className="w-full h-full max-w-6xl max-h-[85vh] p-8 flex items-center justify-center animate-in fade-in zoom-in-95 duration-300 touch-pan-y"
                onClick={(e) => e.stopPropagation()} // Prevent click from closing when clicking inside media area
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                style={{
                    transform: dragX ? `translateX(${dragX}px)` : undefined,
                    // Durante el arrastre la imagen sigue al dedo; al soltar, vuelve con animación.
                    transition: dragX ? 'none' : 'transform 200ms ease-out',
                }}
            >
                {currentMedia.type === 'video' ? (
                    <video 
                        src={currentMedia.url} 
                        controls 
                        autoPlay 
                        className="max-w-full max-h-full object-contain rounded-xl shadow-xl"
                        key={currentMedia.url} // Force remount if URL changes
                    />
                ) : (
                    <img 
                        src={currentMedia.url} 
                        alt={currentMedia.title || 'Imagen del producto'} 
                        className="max-w-full max-h-full object-contain rounded-xl shadow-xl"
                    />
                )}
            </div>
        </div>
    );
};
