import React, { useEffect, useState } from 'react';
import { getLabelPresets, saveLabelPreset, deleteLabelPreset, LabelSizePreset, MAX_LABEL_WIDTH_MM, DEFAULT_LABEL_PRESET_ID } from '../utils/labelPresets';
import {
  Trash2,
} from 'lucide-react';

interface LabelSizeSelectorProps {
    value: LabelSizePreset | null;
    onChange: (preset: LabelSizePreset) => void;
}

export const LabelSizeSelector: React.FC<LabelSizeSelectorProps> = ({ value, onChange }) => {
    const [presets, setPresets] = useState<LabelSizePreset[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newWidth, setNewWidth] = useState('');
    const [newHeight, setNewHeight] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const list = await getLabelPresets();
            setPresets(list);
            if (!value && list.length > 0) {
                onChange(list.find((p) => p.id === DEFAULT_LABEL_PRESET_ID) ?? list[0]);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (e.target.value === '__new__') {
            setShowAddForm(true);
            return;
        }
        const preset = presets.find((p) => p.id === e.target.value);
        if (preset) onChange(preset);
    };

    const handleSaveNew = async () => {
        const width = parseFloat(newWidth);
        const height = parseFloat(newHeight);
        if (!newName.trim() || !width || !height || width <= 0 || height <= 0) {
            alert('Completa un nombre y medidas válidas (mm).');
            return;
        }
        if (width > MAX_LABEL_WIDTH_MM) {
            alert(`El ancho máximo soportado por la impresora térmica es ${MAX_LABEL_WIDTH_MM}mm (8cm).`);
            return;
        }
        setSaving(true);
        try {
            const preset = await saveLabelPreset(newName.trim(), width, height);
            setPresets((prev) => [...prev, preset]);
            onChange(preset);
            setShowAddForm(false);
            setNewName('');
            setNewWidth('');
            setNewHeight('');
        } catch (error: any) {
            alert('Error al guardar el tamaño: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (preset: LabelSizePreset) => {
        if (preset.builtIn) return;
        if (!confirm(`¿Eliminar el tamaño "${preset.name}"?`)) return;
        try {
            await deleteLabelPreset(preset.id);
            const remaining = presets.filter((p) => p.id !== preset.id);
            setPresets(remaining);
            if (value?.id === preset.id && remaining.length > 0) {
                onChange(remaining[0]);
            }
        } catch (error: any) {
            alert('Error al eliminar el tamaño: ' + error.message);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-fg">Tamaño de etiqueta:</label>
            <div className="flex items-center gap-2">
                <select
                    value={value?.id ?? ''}
                    onChange={handleSelectChange}
                    className="flex-1 px-3 py-2 bg-surface-2 border border-subtle rounded-lg text-fg font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                >
                    {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name} ({p.widthMm}×{p.heightMm}mm)
                        </option>
                    ))}
                    <option value="__new__">+ Nuevo tamaño personalizado...</option>
                </select>
                {value && !value.builtIn && (
                    <button
                        type="button"
                        onClick={() => handleDelete(value)}
                        className="p-2 text-danger hover:bg-danger-soft rounded-lg transition-colors shrink-0"
                        title="Eliminar este tamaño personalizado"
                    >
                        <Trash2 size={18} aria-hidden="true" />
                    </button>
                )}
            </div>

            {showAddForm && (
                <div className="flex flex-col gap-2 p-3 bg-surface-2 border border-subtle rounded-lg mt-1">
                    <input
                        type="text"
                        placeholder="Nombre (ej. Rollo Xprinter 60x40)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="px-3 py-1.5 bg-surface border border-subtle rounded-lg text-sm text-fg outline-none"
                    />
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            placeholder={`Ancho mm (máx ${MAX_LABEL_WIDTH_MM})`}
                            value={newWidth}
                            onChange={(e) => setNewWidth(e.target.value)}
                            className="w-24 px-3 py-1.5 bg-surface border border-subtle rounded-lg text-sm text-fg outline-none"
                        />
                        <span className="text-fg-subtle text-sm">×</span>
                        <input
                            type="number"
                            placeholder="Alto mm"
                            value={newHeight}
                            onChange={(e) => setNewHeight(e.target.value)}
                            className="w-24 px-3 py-1.5 bg-surface border border-subtle rounded-lg text-sm text-fg outline-none"
                        />
                        <span className="text-fg-subtle text-sm">mm</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                        <button
                            type="button"
                            onClick={handleSaveNew}
                            disabled={saving}
                            className="flex-1 py-1.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg disabled:opacity-70"
                        >
                            {saving ? 'Guardando...' : 'Guardar tamaño'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAddForm(false)}
                            className="px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-hover rounded-lg"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
