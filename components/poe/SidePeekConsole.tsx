import React, { useState } from 'react';
import { usePOEStore } from '../../store/usePOEStore';
import { useShallow } from 'zustand/react/shallow';
import { DEFAULT_TAG_COLORS, POETag, POEColumnType } from '../../types/poe';
import { 
  X, 
  Settings, 
  Tag as TagIcon, 
  Tags, 
  Type, 
  Calendar, 
  Hash, 
  Plus, 
  Trash2, 
  Palette, 
  Filter, 
  ArrowUpAZ, 
  ArrowDownZA, 
  AlertCircle,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export const SidePeekConsole: React.FC = () => {
  const {
    columns,
    tags,
    activeSidePeekColumnId,
    setActiveSidePeekColumnId,
    updateColumn,
    deleteColumn,
    createTag,
    updateTag,
    deleteTag,
    sortColumnId,
    sortDirection,
    setSort,
    columnFilters,
    setColumnFilter
  } = usePOEStore(
    useShallow((state) => ({
      columns: state.columns,
      tags: state.tags,
      activeSidePeekColumnId: state.activeSidePeekColumnId,
      setActiveSidePeekColumnId: state.setActiveSidePeekColumnId,
      updateColumn: state.updateColumn,
      deleteColumn: state.deleteColumn,
      createTag: state.createTag,
      updateTag: state.updateTag,
      deleteTag: state.deleteTag,
      sortColumnId: state.sortColumnId,
      sortDirection: state.sortDirection,
      setSort: state.setSort,
      columnFilters: state.columnFilters,
      setColumnFilter: state.setColumnFilter,
    }))
  );

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLORS[0]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  if (!activeSidePeekColumnId) return null;

  const column = columns.find(c => c.id === activeSidePeekColumnId);
  if (!column) {
    // Si la columna seleccionada se eliminó
    setActiveSidePeekColumnId(null);
    return null;
  }

  const columnTags = tags
    .filter(t => t.column_id === column.id)
    .sort((a, b) => a.order_index - b.order_index);

  const activeFilter = columnFilters[column.id];

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    await createTag(column.id, newTagName.trim(), newTagColor);
    setNewTagName('');
    // Elegir el siguiente color de la paleta dinámicamente
    const nextIdx = (DEFAULT_TAG_COLORS.indexOf(newTagColor) + 1) % DEFAULT_TAG_COLORS.length;
    setNewTagColor(DEFAULT_TAG_COLORS[nextIdx]);
  };

  const getColumnTypeLabel = (type: POEColumnType) => {
    switch (type) {
      case 'single_select': return 'Seleccionar (1 Solo Tag)';
      case 'multi_select': return 'Lista (Varios Tags)';
      case 'date': return 'Fecha de Ejecución';
      case 'number': return 'Número / Métricas';
      default: return 'Texto Libre';
    }
  };

  const isTagType = column.type === 'single_select' || column.type === 'multi_select';

  return (
    <aside className="w-[340px] shrink-0 bg-surface border-l border-subtle flex flex-col shadow-lg transition-all duration-300 animate-in slide-in-from-right-10 z-30">
      {/* CABECERA DE LA CONSOLA DE EDICIÓN */}
      <div className="p-4 border-b border-subtle flex items-center justify-between bg-slate-50/70 dark:bg-[#0c1117]/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Settings className="w-4 h-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase font-bold text-fg tracking-wider flex items-center gap-1.5">
              Consola de Edición
            </h3>
            <p className="text-[11px] text-fg-muted">Propiedades y tags en vivo</p>
          </div>
        </div>

        <button
          onClick={() => setActiveSidePeekColumnId(null)}
          className="p-1 text-fg-subtle hover:text-slate-700 dark:hover:text-slate-200 hover:bg-surface-hover rounded-lg transition-colors"
          title="Cerrar consola (Side Peek)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar text-xs">
        
        {/* SECCIÓN 1: NOMBRE Y TIPO DE COLUMNA */}
        <section className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="font-bold text-fg text-xs flex items-center gap-1.5">
              Nombre de Columna
            </label>
            {column.is_system && (
              <span className="px-1.5 py-0.5 text-2xs bg-warning/10 text-warning border border-warning/20 rounded font-semibold">
                Principal
              </span>
            )}
          </div>

          <input
            type="text"
            value={column.name}
            onChange={(e) => updateColumn(column.id, { name: e.target.value })}
            className="w-full px-3 py-1.5 text-sm font-semibold bg-surface border border-subtle rounded-lg text-fg focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm"
            placeholder="Nombre de la columna..."
          />
          <p className="text-[11px] text-fg-muted leading-tight">
            Al renombrar, la propiedad de los tags y los valores cargados en celdas se preservan intactos.
          </p>

          <div className="pt-2">
            <label className="block text-xs font-bold text-fg mb-1.5">
              Tipo de Datos de Columna
            </label>
            <select
              value={column.type}
              onChange={(e) => updateColumn(column.id, { type: e.target.value as POEColumnType })}
              className="w-full px-2.5 py-2 text-xs bg-surface border border-subtle rounded-lg font-medium text-fg focus:outline-none focus:border-primary"
            >
              <option value="single_select">🔘 Seleccionar (Solo 1 tag por celda)</option>
              <option value="multi_select">🏷️ Lista (Permite seleccionar varios tags)</option>
              <option value="text">📝 Texto Libre / Observaciones</option>
              <option value="date">📅 Fecha</option>
            </select>
          </div>
        </section>

        {/* SECCIÓN 2: GESTIÓN DE TAGS EN VIVO (SOLO PARA TAGS) */}
        {isTagType && (
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-subtle pb-2">
              <span className="font-bold text-fg flex items-center gap-1.5">
                <Tags className="w-4 h-4 text-success" />
                Tags Disponibles ({columnTags.length})
              </span>
              <span className="text-2xs text-fg-subtle font-mono">Sincronizado</span>
            </div>

            {/* Formulario para agregar nuevo Tag */}
            <form onSubmit={handleAddTag} className="space-y-2 bg-surface-2 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre del nuevo tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-surface border border-subtle rounded-lg text-xs text-fg focus:outline-none focus:border-success"
                />
                <button
                  type="submit"
                  disabled={!newTagName.trim()}
                  className="px-3 py-1.5 bg-success hover:bg-success disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Paleta de colores para el tag en creación */}
              <div className="flex items-center gap-1 pt-1 overflow-x-auto py-0.5 custom-scrollbar">
                {DEFAULT_TAG_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`w-5 h-5 rounded-full border transition-transform shrink-0 ${ newTagColor === color ? 'scale-125 border-slate-900 dark:border-white ring-2 ring-success/50' : 'border-transparent opacity-70 hover:opacity-100' }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </form>

            {/* Lista de tags con edición en línea de nombre y color */}
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {columnTags.map(tag => {
                const isEditing = editingTagId === tag.id;

                return (
                  <div 
                    key={tag.id}
                    className="p-2 bg-surface border border-slate-200/80 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2 group shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Selector de color rápido */}
                        <div className="relative group/color shrink-0">
                          <div 
                            className="w-4 h-4 rounded-full cursor-pointer shadow-inner border border-black/20 dark:border-white/20" 
                            style={{ backgroundColor: tag.color }} 
                          />
                          <div className="absolute left-0 top-full mt-1 z-50 p-1.5 bg-surface border border-subtle rounded-lg shadow-lg hidden group-hover/color:flex items-center gap-1 w-36 flex-wrap">
                            {DEFAULT_TAG_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => updateTag(tag.id, { color })}
                                className="w-4 h-4 rounded-full hover:scale-125 transition-transform shrink-0"
                                style={{ backgroundColor: color }}
                                title="Cambiar color globalmente"
                              />
                            ))}
                          </div>
                        </div>

                        {isEditing ? (
                          <input
                            type="text"
                            defaultValue={tag.name}
                            onBlur={(e) => {
                              if (e.target.value.trim() && e.target.value !== tag.name) {
                                updateTag(tag.id, { name: e.target.value.trim() });
                              }
                              setEditingTagId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            autoFocus
                            className="w-full px-2 py-0.5 bg-surface-2 border border-primary rounded text-xs font-semibold text-fg"
                          />
                        ) : (
                          <span 
                            onClick={() => setEditingTagId(tag.id)}
                            className="font-semibold truncate cursor-pointer hover:underline text-fg"
                            style={{ color: tag.color }}
                            title="Clic para editar nombre del tag en toda la tabla"
                          >
                            {tag.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-fg-subtle">
                        <button
                          onClick={() => setEditingTagId(isEditing ? null : tag.id)}
                          className="p-1 hover:text-primary rounded opacity-70 hover:opacity-100 transition-opacity"
                          title="Renombrar tag"
                        >
                          <Type className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar la etiqueta "${tag.name}"? Esto afectará todas las filas asignadas.`)) {
                              deleteTag(tag.id);
                            }
                          }}
                          className="p-1 hover:text-danger rounded opacity-70 hover:opacity-100 transition-opacity"
                          title="Eliminar tag"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECCIÓN 3: FILTRADO Y ORDEN POR ESTA COLUMNA */}
        <section className="space-y-3 pt-3 border-t border-subtle">
          <h4 className="font-bold text-fg flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-primary" />
            Control de Vista
          </h4>

          {/* Ordenar */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSort(column.id, 'asc')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium border transition-all ${ sortColumnId === column.id && sortDirection === 'asc' ? 'bg-primary border-primary text-white font-bold' : 'bg-slate-50 dark:bg-[#161b22] border-subtle text-fg-muted hover:bg-surface-hover dark:hover:bg-slate-800' }`}
            >
              <ArrowUpAZ className="w-3.5 h-3.5" />
              Ascendente
            </button>
            <button
              onClick={() => setSort(column.id, 'desc')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg font-medium border transition-all ${ sortColumnId === column.id && sortDirection === 'desc' ? 'bg-primary border-primary text-white font-bold' : 'bg-slate-50 dark:bg-[#161b22] border-subtle text-fg-muted hover:bg-surface-hover dark:hover:bg-slate-800' }`}
            >
              <ArrowDownZA className="w-3.5 h-3.5" />
              Descendente
            </button>
          </div>

          {/* Filtro específico para esta columna */}
          {isTagType ? (
            <div className="space-y-1.5 pt-2">
              <label className="block text-[11px] font-semibold text-fg-muted">
                Filtrar filas por tag:
              </label>
              <select
                value={typeof activeFilter === 'string' ? activeFilter : (Array.isArray(activeFilter) ? activeFilter[0] : '')}
                onChange={(e) => setColumnFilter(column.id, e.target.value ? e.target.value : null)}
                className="w-full px-2.5 py-1.5 bg-surface-2 border border-subtle rounded-lg text-fg font-medium text-xs focus:outline-none focus:border-primary"
              >
                <option value="">Mostrar todas (Sin filtro)</option>
                {columnTags.map(t => (
                  <option key={t.id} value={t.id}>
                    🏷️ {t.name}
                  </option>
                ))}
              </select>
              {activeFilter && (
                <button
                  onClick={() => setColumnFilter(column.id, null)}
                  className="w-full py-1 text-[11px] text-danger hover:underline text-center font-medium"
                >
                  Quitar filtro en esta columna
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 pt-2">
              <label className="block text-[11px] font-semibold text-fg-muted">
                Filtrar por texto exacto:
              </label>
              <input
                type="text"
                placeholder="Buscar contenido en columna..."
                value={activeFilter || ''}
                onChange={(e) => setColumnFilter(column.id, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-surface-2 border border-subtle rounded-lg text-fg font-medium text-xs focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </section>
      </div>

      {/* PIE CON ACCIÓN PELIGROSA: ELIMINAR COLUMNA */}
      <div className="p-3 border-t border-subtle bg-surface-2 flex justify-between items-center">
        {!column.is_system ? (
          <button
            onClick={() => {
              if (confirm(`¿Estás seguro de eliminar la columna "${column.name}"? Se perderán las etiquetas asociadas.`)) {
                deleteColumn(column.id);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-danger hover:bg-danger-soft rounded-lg font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar Columna
          </button>
        ) : (
          <span className="text-[11px] text-fg-subtle italic">Columna de sistema protegida</span>
        )}

        <button
          onClick={() => setActiveSidePeekColumnId(null)}
          className="px-3 py-1 font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-fg rounded-lg transition-all text-xs"
        >
          Listo
        </button>
      </div>
    </aside>
  );
};
