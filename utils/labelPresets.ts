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
     * Die-cut roll: nominal gap in mm between one label and the next,
     * passed to the printer's TSPL GAP command. The Xprinter XP-450B has a
     * real gap sensor -- once calibrated on the physical unit for a given
     * roll (hold FEED while powering on until the LED settles solid blue),
     * this value only needs to be in the right ballpark for the sensor to
     * lock onto the true boundary; it is not a hand-tuned feed distance the
     * way it had to be on the older sensor-less printer.
     */
    gapMm?: number;
    /**
     * How far in from the left edge of the print head's printable area the
     * label stock actually sits, in mm. Unused by the current printer (its
     * gap sensor handles registration regardless of stock position), kept
     * only in case narrower stock on a future printer needs it again.
     */
    offsetMm?: number;
}

// The XP-450B's head covers up to ~104mm -- see MAX_THERMAL_WIDTH_MM in
// utils/thermalLabelPrinter.ts, which also clamps this defensively at print
// time. No built-in preset here should exceed that.
export const MAX_LABEL_WIDTH_MM = 104;

export const STANDARD_LABEL_PRESETS: LabelSizePreset[] = [
    { id: 'standard-80x50', name: '80 x 50 mm (Térmica estándar)', widthMm: 80, heightMm: 50, builtIn: true },
    { id: 'standard-80x40', name: '80 x 40 mm', widthMm: 80, heightMm: 40, builtIn: true },
    { id: 'standard-58x40', name: '58 x 40 mm', widthMm: 58, heightMm: 40, builtIn: true },
    { id: 'standard-50x30', name: '50 x 30 mm', widthMm: 50, heightMm: 30, builtIn: true },
    { id: 'standard-80x100', name: '80 x 100 mm (Envío)', widthMm: 80, heightMm: 100, builtIn: true },
    // Die-cut sticker roll in use at the shop: 60mm wide x 40mm tall labels,
    // printed on the Xprinter XP-450B (TSPL, real gap sensor). gapMm=2 is a
    // nominal declaration for the sensor to calibrate against, not a
    // hand-tuned feed distance.
    //
    // A different, much more painful version of this preset (58x40mm,
    // gapMm 6.45) existed for a prior ESC/POS printer with no gap sensor,
    // where the gap had to be derived by hand from observed drift across
    // whole print runs to fake what a real sensor does for free. That
    // printer was retired; if these numbers ever look wrong again, the
    // current printer's own FEED-button calibration routine is the fix, not
    // a repeat of that exercise.
    { id: 'diecut-60x40', name: '60 x 40 mm (Troquelada)', widthMm: 60, heightMm: 40, gapMm: 2, builtIn: true },
];

/**
 * Preset picked when the label UI opens with nothing selected yet. Named
 * explicitly rather than relying on array order, so reordering the list
 * above cannot silently change which size the shop prints by default.
 */
export const DEFAULT_LABEL_PRESET_ID = 'diecut-60x40';

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
