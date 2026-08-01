/**
 * invoiceParser.ts
 * Extracts product lines (código, descripción, cantidad) from an Ecuadorian
 * SRI-style sales invoice PDF (the "factura" template used by TODOMOTO/Odoo),
 * so labels can be printed for every part that came in that invoice.
 *
 * Text is reconstructed from PDF glyph positions (x/y) rather than trusting
 * the raw content-stream order, since some columns in this template land
 * back-to-back with zero gap (e.g. "...300CC6,00") which would otherwise
 * merge into the wrong token if we only concatenated stream order.
 */
import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line import/no-unresolved
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ParsedInvoiceLine {
    sku: string;
    description: string;
    quantity: number;
    unitPrice?: number;
    amount?: number;
}

interface PositionedItem {
    str: string;
    x: number;
    y: number;
    endX: number;
    height: number;
}

// Parses a locale number like "1.234,56" or "4,00" into a JS float.
const parseEsNumber = (raw: string): number => {
    const cleaned = raw.replace(/\$/g, '').trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : NaN;
};

// A "código" (SKU) in this catalog is always alphanumeric with optional
// dashes/dots/slashes, at least 3 chars, and contains at least one digit
// (so plain words from prose paragraphs don't get mistaken for a SKU).
const SKU_RE = /^[A-Z0-9][A-Z0-9\-.\/]{2,}$/;

const looksLikeSku = (token: string): boolean =>
    SKU_RE.test(token) && /\d/.test(token);

// A full invoice row — código, descripción, cantidad, precio unitario, IVA
// and importe — always lands on one reconstructed line in this template.
// When a long descripción wraps, the overflow (plus the unit word, e.g.
// "Unidades") spills onto the *next* line by itself; it never pushes the
// numeric columns down with it.
const rowRegex = /^(\S+)\s+(.+?)(\d+(?:[.,]\d{2,4})?)\s+(\d+(?:[.,]\d{2,4}))\s+IVA\s*\d+%\s*\$?\s*([\d.,]+)\s*$/i;
// Fallback for rows missing the price/IVA/amount columns (e.g. exempt items).
const rowRegexSimple = /^(\S+)\s+(.+?)(\d+(?:[.,]\d{2,4})?)\s*(?:Unidades?|Kits?|Sets?|Pares?|Litros?|Metros?)\s*$/i;
// A wrapped-description continuation line: leftover words followed by the
// unit label, e.g. "2/ADV200/ADV300/EVEREST 300CC Unidades" or just "Unidades".
const continuationRegex = /^(.*?)\s*(?:Unidades?|Kits?|Sets?|Pares?|Litros?|Metros?)\s*$/i;

const groupIntoLines = (items: PositionedItem[]): PositionedItem[][] => {
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: PositionedItem[][] = [];
    for (const item of sorted) {
        const last = lines[lines.length - 1];
        if (last) {
            const refY = last[0].y;
            const tolerance = Math.max(2, item.height * 0.4);
            if (Math.abs(item.y - refY) <= tolerance) {
                last.push(item);
                continue;
            }
        }
        lines.push([item]);
    }
    // Each line's items were pushed in y-sorted (row) order; re-sort within
    // the line left-to-right and join with a space only when there's a
    // visible gap, matching how the text actually renders on the page.
    return lines.map(line => line.sort((a, b) => a.x - b.x));
};

const lineToText = (line: PositionedItem[]): string => {
    let text = '';
    let prevEndX: number | null = null;
    for (const item of line) {
        const str = item.str;
        if (!str.trim()) continue;
        if (prevEndX !== null) {
            const gap = item.x - prevEndX;
            if (gap > item.height * 0.15) text += ' ';
        }
        text += str;
        prevEndX = item.endX;
    }
    return text.replace(/\s+/g, ' ').trim();
};

export interface ParsedInvoice {
    invoiceNumber: string | null;
    lines: ParsedInvoiceLine[];
}

export const parseInvoicePdf = async (file: File): Promise<ParsedInvoice> => {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    const results: ParsedInvoiceLine[] = [];
    const seenKeys = new Set<string>();
    let invoiceNumber: string | null = null;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();

        if (!invoiceNumber) {
            const flatText = content.items.map((it: any) => it.str || '').join(' ');
            const m = flatText.match(/No:?\s*(\d{3}-\d{3}-\d{9})/);
            if (m) invoiceNumber = m[1];
        }

        const items: PositionedItem[] = content.items
            .filter((it: any): it is { str: string; transform: number[]; width: number; height: number } => typeof it.str === 'string')
            .map((it: any) => {
                const [, , , , x, y] = it.transform;
                return {
                    str: it.str,
                    x,
                    y,
                    endX: x + (it.width || 0),
                    height: it.height || Math.abs(it.transform[3]) || 10,
                };
            });

        const lines = groupIntoLines(items).map(lineToText).filter(Boolean);

        const isStopLine = (line: string) =>
            /^Código\s+Descripción/i.test(line) ||
            /^(Pagos|Subtotal|IVA\b|Total\b|Información adicional|Términos)/i.test(line);

        const isRowStart = (line: string) => looksLikeSku(line.split(' ')[0] || '');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (isStopLine(line) || !isRowStart(line)) continue;

            let sku: string | null = null;
            let description = '';
            let quantity = NaN;
            let unitPrice: number | undefined;
            let amount: number | undefined;

            const full = line.match(rowRegex);
            if (full) {
                const [, skuRaw, descRaw, qtyRaw, priceRaw, amountRaw] = full;
                sku = skuRaw.trim();
                description = descRaw.replace(/\s+/g, ' ').trim();
                quantity = parseEsNumber(qtyRaw);
                unitPrice = parseEsNumber(priceRaw);
                amount = parseEsNumber(amountRaw);
            } else {
                const simple = line.match(rowRegexSimple);
                if (simple) {
                    const [, skuRaw, descRaw, qtyRaw] = simple;
                    sku = skuRaw.trim();
                    description = descRaw.replace(/\s+/g, ' ').trim();
                    quantity = parseEsNumber(qtyRaw);
                }
            }

            if (!sku || !looksLikeSku(sku) || !Number.isFinite(quantity) || quantity <= 0) continue;

            // If the descripción wrapped, the overflow (plus the unit word)
            // sits alone on the next line — fold it in and consume that line.
            // A wrapped fragment can itself start with something that looks
            // like a SKU (slashes/digits), so the real disqualifier is
            // whether the next line is a complete row on its own, not just
            // whether its first token resembles a código.
            const next = lines[i + 1];
            const nextIsCompleteRow = next !== undefined && (rowRegex.test(next) || rowRegexSimple.test(next));
            if (next !== undefined && !isStopLine(next) && !nextIsCompleteRow) {
                const cont = next.match(continuationRegex);
                if (cont) {
                    const extra = cont[1].trim();
                    if (extra) description = `${description} ${extra}`.replace(/\s+/g, ' ').trim();
                    i += 1;
                }
            }

            const key = `${sku}::${line}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);

            results.push({
                sku,
                description,
                quantity: Math.max(1, Math.round(quantity)),
                unitPrice,
                amount,
            });
        }
    }

    return { invoiceNumber, lines: results };
};
