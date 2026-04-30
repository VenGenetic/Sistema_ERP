import React, { useState, useEffect, useRef } from 'react';

interface VideoThumbnailProps {
    src: string;
    onClick: () => void;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ src, onClick }) => {
    const [shouldLoad, setShouldLoad] = useState(false);
    const videoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Use IntersectionObserver to lazy load the video frame only when scrolling into view
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                // Defer loading to prioritize text rendering
                setTimeout(() => setShouldLoad(true), 300);
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        if (videoRef.current) {
            observer.observe(videoRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div 
            ref={videoRef}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-black shadow-sm relative cursor-pointer group"
        >
            {shouldLoad ? (
                <video 
                    src={`${src}#t=0.1`} 
                    preload="metadata" 
                    className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    muted 
                    playsInline 
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">movie</span>
                </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="material-symbols-outlined text-[20px] text-white opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-all drop-shadow-md">play_circle</span>
            </div>
        </div>
    );
};
