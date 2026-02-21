import { useEffect, useRef } from 'react';

/**
 * Global hook to listen for barcode scanner inputs.
 * Barcode scanners typically act like keyboards that emit keystrokes very rapidly
 * and terminate with an 'Enter' key.
 * 
 * @param onScan Callback fired when a barcode is successfully read.
 * @param typingDelay The maximum delay (in ms) between keystrokes to be considered a scan (usually < 20ms).
 */
export function useBarcodeScanner(onScan: (barcode: string) => void, typingDelay: number = 50) {
    const buffer = useRef('');
    const lastKeyTime = useRef<number>(Date.now());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const currentTime = Date.now();

            // Ignore modifier keys and other special keys
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;

            // If the time between this key and the last key is longer than typingDelay,
            // assume it's human typing and reset the buffer.
            if (currentTime - lastKeyTime.current > typingDelay) {
                buffer.current = e.key;
            } else {
                buffer.current += e.key;
            }

            // Scanners usually terminate the sequence with an 'Enter' key
            if (e.key === 'Enter') {
                // If the buffer length is reasonable for a barcode, handle it
                // We slice off the last 'Enter'
                const barcode = buffer.current.slice(0, -5); // 'Enter' is 5 chars long
                if (barcode.length > 3) {
                    // Need to prevent default otherwise rapid input can trigger form submissions
                    e.preventDefault();
                    onScan(barcode);
                }
                buffer.current = '';
            }

            lastKeyTime.current = currentTime;
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onScan, typingDelay]);
}
