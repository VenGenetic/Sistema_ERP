/**
 * brandLogo.ts
 * Shared "LV PARTS" brand mark used on the small header printed at the top
 * of product labels (above the description/barcode), so all label renderers
 * (desktop single-label modal, mobile quick print, print queue batches)
 * stay visually consistent.
 */

const LOGO_SVG_MARKUP = `<svg id="Layer_5" data-name="Layer 5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 502.92 424.13"><defs><style>.cls-1{fill:#f15b27;}.cls-2,.cls-6,.cls-7{fill:#231f20;}.cls-3,.cls-4,.cls-5,.cls-8{fill:none;}.cls-3,.cls-6,.cls-7,.cls-8{stroke:#231f20;}.cls-3,.cls-6,.cls-8{stroke-width:20px;}.cls-4{stroke:#d0d2d3;}.cls-4,.cls-5,.cls-7{stroke-miterlimit:10;}.cls-4,.cls-5{stroke-width:28px;}.cls-5{stroke:#bbbdbf;}.cls-6,.cls-8{stroke-linecap:round;}.cls-8{stroke-linejoin:round;}</style></defs><g id="Layer_3" data-name="Layer 3"><g id="Layer_2" data-name="Layer 2"><path class="cls-1" d="M294.75,638.18,266,610C164,510.33,53.74,415.59,53.74,334.91c0-65.73,66.35-109.16,127.38-109.16,34.47,0,92,38.07,113.63,65.39,21.59-27.32,96.54-60.2,131-60.2,61,0,121.32,60.65,109.19,124.76-15.06,79.64-109.42,154.63-211.47,254.51Z" transform="translate(-53.74 -214.04)"/></g></g><ellipse class="cls-2" cx="189.49" cy="546.59" rx="52.16" ry="70.23" transform="translate(-201.59 -137.42) rotate(-16.55)"/><ellipse class="cls-3" cx="189.49" cy="546.59" rx="52.16" ry="70.23" transform="translate(-201.59 -137.42) rotate(-16.55)"/><ellipse class="cls-4" cx="189.49" cy="546.59" rx="11.23" ry="15.13" transform="translate(-201.58 -137.42) rotate(-16.55)"/><ellipse class="cls-2" cx="492.76" cy="440.65" rx="52.16" ry="70.23" transform="translate(-158.85 -55.42) rotate(-16.55)"/><path class="cls-2" d="M501.36,519.63c-12.53,0-25.24-4.65-36.82-13.64-14.79-11.48-26.07-28.87-31.75-49-6.83-24.15-4.67-48.74,5.92-67.45,7.61-13.44,18.79-22.49,32.33-26.16h0c16.54-4.49,34.29-.27,49.95,11.89,14.79,11.49,26.07,28.87,31.75,49,6.83,24.16,4.67,48.74-5.92,67.46-7.61,13.44-18.79,22.48-32.33,26.15A50,50,0,0,1,501.36,519.63Zm-25.09-136.9c-10.44,2.83-16.72,10.64-20.15,16.7-7.87,13.89-9.39,33.39-4.08,52.16,4.52,16,13.32,29.72,24.77,38.61,10.58,8.21,22.1,11.18,32.45,8.38s16.72-10.65,20.15-16.71c7.87-13.89,9.39-33.39,4.08-52.15-4.52-16-13.32-29.73-24.77-38.61-10.58-8.21-22.1-11.19-32.45-8.38Z" transform="translate(-53.74 -214.04)"/><ellipse class="cls-5" cx="492.72" cy="440.71" rx="11.23" ry="15.13" transform="translate(-158.86 -55.43) rotate(-16.55)"/><path class="cls-6" d="M189.55,546.53l97-91.07" transform="translate(-53.74 -214.04)"/><line class="cls-6" x1="439.03" y1="226.61" x2="292.06" y2="60.55"/><line class="cls-6" x1="358.75" y1="135.66" x2="278.8" y2="45.74"/><path class="cls-6" d="M350.41,496.07,239.84,532.93" transform="translate(-53.74 -214.04)"/><path class="cls-7" d="M240.37,391.51l49.5,74.28-67.33.64Z" transform="translate(-53.74 -214.04)"/><path class="cls-7" d="M269.79,404.1l80-39.38,18.3,108-75.79,26.49Z" transform="translate(-53.74 -214.04)"/><path class="cls-7" d="M360.08,292.5l38.35-24.84,24.31,48.71-27.42,32.46Z" transform="translate(-53.74 -214.04)"/><path class="cls-7" d="M336.51,279.89c-44.69-30.49-95.43-1.7-94.75,78.15-5.23,36.11-28.45,44-55.11,41.73L58.65,352,81,367.3l89.3,61c37.81,10,65.44-10.89,78.35-49.67,17.3-51.67,52.59-75.17,93.82-55Z" transform="translate(-53.74 -214.04)"/><polyline class="cls-2" points="288.72 50.29 301.42 11.53 322.05 10"/><polyline class="cls-8" points="288.72 50.29 301.42 11.53 322.05 10"/><path class="cls-7" d="M360.08,292.5l6-59.28,18.08,16.57Z" transform="translate(-53.74 -214.04)"/></svg>`;

export const BRAND_NAME = 'LV PARTS';

let logoImagePromise: Promise<HTMLImageElement> | null = null;

// Decodes the inline SVG once and caches the resulting Image so every label
// render (single, batch, mobile) reuses the same already-loaded bitmap
// instead of re-decoding the SVG per label.
export const loadBrandLogo = (): Promise<HTMLImageElement> => {
    if (!logoImagePromise) {
        logoImagePromise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('No se pudo cargar el logo de marca'));
            img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(LOGO_SVG_MARKUP)))}`;
        });
    }
    return logoImagePromise;
};

// Draws the small brand header (logo + "LV PARTS" bold, separated from the
// rest of the label by a thin line) at the top of a label canvas. Kept
// deliberately compact so the barcode and description below stay the most
// prominent elements. Returns the y coordinate where the rest of the label
// content should start.
export const drawLabelBrandHeader = (
    ctx: CanvasRenderingContext2D,
    logoImg: HTMLImageElement | null,
    W: number,
    PAD: number,
): number => {
    const H = ctx.canvas.height;
    const topY = Math.round(PAD * 0.55);
    const logoSize = Math.round(H * 0.085);
    const fontSize = Math.round(H * 0.06);

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    const textW = ctx.measureText(BRAND_NAME).width;
    const gap = logoImg ? Math.round(W * 0.012) : 0;
    const blockW = (logoImg ? logoSize : 0) + gap + textW;

    let x = (W - blockW) / 2;
    const rowH = Math.max(logoSize, fontSize);

    if (logoImg) {
        ctx.drawImage(logoImg, x, topY + (rowH - logoSize) / 2, logoSize, logoSize);
        x += logoSize + gap;
    }

    ctx.fillStyle = '#000000';
    ctx.fillText(BRAND_NAME, x, topY + rowH * 0.78);

    const headerBottom = topY + rowH + Math.round(H * 0.014);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, Math.round(H * 0.0035));
    ctx.beginPath();
    ctx.moveTo(PAD, headerBottom);
    ctx.lineTo(W - PAD, headerBottom);
    ctx.stroke();

    return headerBottom + Math.round(H * 0.018);
};
