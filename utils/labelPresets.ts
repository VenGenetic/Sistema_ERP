/**
 * labelPresets.ts
 * Standard + user-saved sticky-label sizes (width/height in mm) offered when
 * printing barcode labels on the thermal printer. Standard presets are
 * built into the frontend; custom presets are shared shop-wide via
 * Supabase (label_size_presets table) so any device/user can reuse them.
 */
import { supabase } from '../supabaseClient';

export interface LabelSizePreset {
    id: string;
    name: string;
    widthMm: number;
    heightMm: number;
    builtIn?: boolean;
    /**
     * Die-cut roll: vertical gap in mm between one label and the next.
     * When set, printing feeds this much after each label instead of
     * cutting -- the stickers are peeled off, and cutting would destroy
     * the registration the next label depends on (this printer has no gap
     * sensor, so feed distance is the only thing keeping labels aligned).
     */
    gapMm?: number;
    /**
     * How far in from the left edge of the print head's printable area the
     * label stock actually sits, in mm. Narrow stock in a wider paper path
     * needs this or the artwork prints offset toward one side.
     */
    offsetMm?: number;
}

// The installed printer's head is 80mm wide, so no built-in preset exceeds
// that width (see MAX_LABEL_WIDTH_MM / utils/thermalLabelPrinter.ts, which
// also clamps this defensively at print time).
export const MAX_LABEL_WIDTH_MM = 80;

export const STANDARD_LABEL_PRESETS: LabelSizePreset[] = [
    { id: 'standard-80x50', name: '80 x 50 mm (Térmica estándar)', widthMm: 80, heightMm: 50, builtIn: true },
    { id: 'standard-80x40', name: '80 x 40 mm', widthMm: 80, heightMm: 40, builtIn: true },
    { id: 'standard-58x40', name: '58 x 40 mm', widthMm: 58, heightMm: 40, builtIn: true },
    { id: 'standard-50x30', name: '50 x 30 mm', widthMm: 50, heightMm: 30, builtIn: true },
    { id: 'standard-80x100', name: '80 x 100 mm (Envío)', widthMm: 80, heightMm: 100, builtIn: true },
    // Die-cut sticker roll in use at the shop: "ETIQ. TERMICO ECO T3
    // 4X5.8_1XF_700XR_N1.4_S/I" (code ETT3E4X5.8X70) -- 40mm tall x 58mm
    // wide, one across, 700 per roll, 1.4" core. The stock is commonly
    // called "60x40" because the liner is 60mm: 58mm of label with 1mm
    // showing each side.
    //
    // gapMm sets the pitch, and it is calibrated from observed drift rather
    // than measured by eye, because drift is the far more sensitive
    // instrument: feeding 44mm made the artwork climb 2mm per label, which
    // puts the true pitch at 46mm, so the gap is 6mm and not the ~3mm it
    // looks like. (Artwork climbing means the feed is short; sinking would
    // mean it is long.) Re-derive the same way if the roll is ever swapped:
    // new gap = old gap + climb-per-label.
    //
    // This roll is printed as an uncut strip on purpose. Having the printer
    // cut each label free was implemented and abandoned: it needs the cut to
    // happen with the blade where it already sits, but this unit advances
    // the paper roughly 10mm of its own accord on GS V 0 and never reverses
    // it, so every label after the first loses its leading 10mm. Recovering
    // that needs reverse-feed, which the firmware does not expose over
    // ESC/POS. Tearing the strip by hand costs nothing and always aligns.
    { id: 'diecut-58x40', name: '58 x 40 mm (Troquelada, rollo 60mm)', widthMm: 58, heightMm: 40, gapMm: 6, offsetMm: 0, builtIn: true },
];

/**
 * Preset picked when the label UI opens with nothing selected yet. Named
 * explicitly rather than relying on array order, so reordering the list
 * above cannot silently change which size the shop prints by default.
 */
export const DEFAULT_LABEL_PRESET_ID = 'diecut-58x40';

let cachedCustomPresets: LabelSizePreset[] | null = null;

export const getLabelPresets = async (force = false): Promise<LabelSizePreset[]> => {
    if (!force && cachedCustomPresets !== null) {
        return [...STANDARD_LABEL_PRESETS, ...cachedCustomPresets];
    }

    try {
        const { data, error } = await supabase
            .from('label_size_presets')
            .select('id, name, width_mm, height_mm')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching label presets:', error);
            cachedCustomPresets = cachedCustomPresets ?? [];
        } else {
            cachedCustomPresets = (data || []).map((row: any) => ({
                id: row.id,
                name: row.name,
                widthMm: Number(row.width_mm),
                heightMm: Number(row.height_mm),
            }));
        }
    } catch (err) {
        console.error('getLabelPresets error:', err);
        cachedCustomPresets = cachedCustomPresets ?? [];
    }

    return [...STANDARD_LABEL_PRESETS, ...cachedCustomPresets];
};

export const saveLabelPreset = async (name: string, widthMm: number, heightMm: number): Promise<LabelSizePreset> => {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('label_size_presets')
        .insert({ name, width_mm: widthMm, height_mm: heightMm, created_by: userData.user?.id ?? null })
        .select('id, name, width_mm, height_mm')
        .single();

    if (error) throw error;

    const preset: LabelSizePreset = {
        id: data.id,
        name: data.name,
        widthMm: Number(data.width_mm),
        heightMm: Number(data.height_mm),
    };
    cachedCustomPresets = [...(cachedCustomPresets ?? []), preset];
    return preset;
};

export const deleteLabelPreset = async (id: string): Promise<void> => {
    const { error } = await supabase.from('label_size_presets').delete().eq('id', id);
    if (error) throw error;
    if (cachedCustomPresets) {
        cachedCustomPresets = cachedCustomPresets.filter((p) => p.id !== id);
    }
};
