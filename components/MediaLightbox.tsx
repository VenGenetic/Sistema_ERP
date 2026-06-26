import React, { useState, useEffect } from 'react';

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
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({ isOpen, media, initialIndex = 0, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity" onClick={onClose}>
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
                <span className="material-symbols-outlined">open_in_new</span>
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); handleDownload(currentMedia); }}
                title="Descargar archivo"
                className="absolute top-6 right-20 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md z-10"
            >
                <span className="material-symbols-outlined">download</span>
            </button>

            {/* Close Button */}
            <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md z-10"
            >
                <span className="material-symbols-outlined">close</span>
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
                        <span className="material-symbols-outlined text-[32px]">chevron_left</span>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        className="absolute right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md z-10 hover:scale-110"
                    >
                        <span className="material-symbols-outlined text-[32px]">chevron_right</span>
                    </button>

                    {/* Pagination Indicators */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                        {media.map((_, idx) => (
                            <div 
                                key={idx} 
                                className={`h-2 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Media Content */}
            <div 
                className="w-full h-full max-w-6xl max-h-[85vh] p-8 flex items-center justify-center animate-in fade-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()} // Prevent click from closing when clicking inside media area
            >
                {currentMedia.type === 'video' ? (
                    <video 
                        src={currentMedia.url} 
                        controls 
                        autoPlay 
                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                        key={currentMedia.url} // Force remount if URL changes
                    />
                ) : (
                    <img 
                        src={currentMedia.url} 
                        alt={currentMedia.title || 'Imagen del producto'} 
                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                    />
                )}
            </div>
        </div>
    );
};
