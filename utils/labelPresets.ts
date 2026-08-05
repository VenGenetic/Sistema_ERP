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
}

export const STANDARD_LABEL_PRESETS: LabelSizePreset[] = [
    { id: 'standard-80x50', name: '80 x 50 mm (Térmica estándar)', widthMm: 80, heightMm: 50, builtIn: true },
    { id: 'standard-58x40', name: '58 x 40 mm', widthMm: 58, heightMm: 40, builtIn: true },
    { id: 'standard-50x30', name: '50 x 30 mm', widthMm: 50, heightMm: 30, builtIn: true },
    { id: 'standard-100x50', name: '100 x 50 mm', widthMm: 100, heightMm: 50, builtIn: true },
    { id: 'standard-100x150', name: '100 x 150 mm (Envío)', widthMm: 100, heightMm: 150, builtIn: true },
];

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
