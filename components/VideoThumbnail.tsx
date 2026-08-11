import React, { useState, useEffect, useRef } from 'react';
import {
  CirclePlay,
  Film,
} from 'lucide-react';

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
            className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden border border-subtle bg-black shadow-sm relative cursor-pointer group"
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
                    <Film size={16} className="text-fg-subtle" aria-hidden="true" />
                </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <CirclePlay size={20} className="text-white opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-all drop-shadow-md" aria-hidden="true" />
            </div>
        </div>
    );
};
