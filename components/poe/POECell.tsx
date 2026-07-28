import React, { useState, useRef, useEffect } from 'react';
import { POEProcedure, POEColumn, POETag } from '../../types/poe';
import { usePOEStore } from '../../store/usePOEStore';
import { Plus, Check, X, Settings, Tag as TagIcon } from 'lucide-react';

interface POECellProps {
  procedure: POEProcedure;
  column: POEColumn;
}

export const POECell: React.FC<POECellProps> = ({ procedure, column }) => {
  const { tags, updateCellCustomValue, setActiveSidePeekColumnId, createTag } = usePOEStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditingText, setIsEditingText] = useState(false);
  const [textVal, setTextVal] = useState('');
  const cellRef = useRef<HTMLDivElement>(null);

  const columnTags = tags.filter(t => t.column_id === column.id).sort((a, b) => a.order_index - b.order_index);
  const currentValue = procedure.custom_values?.[column.id];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsEditingText(false);
      }
    };
    if (isOpen || isEditingText) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isEditingText]);

  // Manejo de Texto
  if (column.type === 'text' || column.type === 'number' || column.type === 'date') {
    const handleStartEdit = () => {
      setTextVal(currentValue || '');
      setIsEditingText(true);
    };

    const handleSaveText = () => {
      setIsEditingText(false);
      if (currentValue !== textVal) {
        updateCellCustomValue(procedure.id, column.id, textVal);
      }
    };

    if (isEditingText) {
      return (
        <div ref={cellRef} className="w-full h-full p-1 flex items-center">
          <input
            type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
            onBlur={handleSaveText}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveText()}
            autoFocus
            className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-blue-500 rounded text-slate-900 dark:text-white focus:outline-none"
          />
        </div>
      );
    }

    return (
      <div
        onClick={handleStartEdit}
        className="w-full h-full min-h-[36px] px-3 py-2 text-xs text-slate-700 dark:text-slate-300 flex items-center cursor-text hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors truncate"
      >
        {currentValue ? (
          column.type === 'date' ? new Date(currentValue).toLocaleDateString() : currentValue
        ) : (
          <span className="text-slate-400 dark:text-slate-600 italic text-[11px]">Vacío...</span>
        )}
      </div>
    );
  }

  // Manejo de SINGLE_SELECT (Selección Única - 1 solo Tag)
  if (column.type === 'single_select') {
    const selectedTagId = typeof currentValue === 'string' ? currentValue : null;
    const selectedTag = columnTags.find(t => t.id === selectedTagId);
    
    const filteredTags = columnTags.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectTag = (tagId: string) => {
      // Si se vuelve a hacer click al mismo, se quita la selección
      updateCellCustomValue(procedure.id, column.id, tagId === selectedTagId ? null : tagId);
      setIsOpen(false);
      setSearchTerm('');
    };

    const handleCreateNewTag = async () => {
      if (!searchTerm.trim()) return;
      const newTag = await createTag(column.id, searchTerm.trim());
      if (newTag) {
        updateCellCustomValue(procedure.id, column.id, newTag.id);
      }
      setSearchTerm('');
      setIsOpen(false);
    };

    return (
      <div ref={cellRef} className="relative w-full h-full min-h-[36px] px-2 py-1.5 flex items-center">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full min-h-[26px] flex items-center gap-1 cursor-pointer rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all px-1"
        >
          {selectedTag ? (
            <span 
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm truncate max-w-full transition-all hover:opacity-90"
              style={{ 
                backgroundColor: `${selectedTag.color}22`, 
                color: selectedTag.color, 
                border: `1px solid ${selectedTag.color}55` 
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedTag.color }} />
              {selectedTag.name}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-[11px] inline-flex items-center gap-1 transition-colors px-1">
              <Plus className="w-3 h-3" />
              Seleccionar...
            </span>
          )}
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 z-50 mt-1 w-56 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150">
            <input
              type="text"
              placeholder="Buscar o crear tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white mb-2 focus:outline-none focus:border-blue-500"
            />
            
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {filteredTags.length > 0 ? (
                filteredTags.map(t => {
                  const isSelected = t.id === selectedTagId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTag(t.id)}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                        isSelected ? 'bg-slate-100 dark:bg-slate-800 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span 
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 truncate"
                        style={{ backgroundColor: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-2" />}
                    </div>
                  );
                })
              ) : searchTerm.trim() ? (
                <button
                  onClick={handleCreateNewTag}
                  className="w-full flex items-center gap-1.5 text-left px-2 py-1.5 text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crear tag: <span className="font-semibold">"{searchTerm}"</span>
                </button>
              ) : (
                <p className="text-center py-2 text-[11px] text-slate-400">Sin tags en este grupo.</p>
              )}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  setActiveSidePeekColumnId(column.id);
                }}
                className="flex items-center gap-1 text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 font-medium transition-colors w-full justify-center py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Settings className="w-3 h-3" />
                Administrar Tags (Consola)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Manejo de MULTI_SELECT (Lista de Tags - Permite seleccionar varios)
  if (column.type === 'multi_select') {
    const selectedTagIds: string[] = Array.isArray(currentValue) ? currentValue : (typeof currentValue === 'string' ? [currentValue] : []);
    const selectedTags = columnTags.filter(t => selectedTagIds.includes(t.id));

    const filteredTags = columnTags.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleToggleTag = (tagId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const exists = selectedTagIds.includes(tagId);
      const nextIds = exists 
        ? selectedTagIds.filter(id => id !== tagId) 
        : [...selectedTagIds, tagId];
      updateCellCustomValue(procedure.id, column.id, nextIds);
    };

    const handleCreateNewTag = async () => {
      if (!searchTerm.trim()) return;
      const newTag = await createTag(column.id, searchTerm.trim());
      if (newTag) {
        handleToggleTag(newTag.id);
      }
      setSearchTerm('');
    };

    return (
      <div ref={cellRef} className="relative w-full h-full min-h-[36px] px-2 py-1.5 flex items-center">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full min-h-[26px] flex flex-wrap items-center gap-1 cursor-pointer rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all px-1"
        >
          {selectedTags.length > 0 ? (
            selectedTags.map(tag => (
              <span 
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-sm group transition-all"
                style={{ 
                  backgroundColor: `${tag.color}22`, 
                  color: tag.color, 
                  border: `1px solid ${tag.color}55` 
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
                <button
                  onClick={(e) => handleToggleTag(tag.id, e)}
                  className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 text-slate-500 hover:text-rose-500 transition-colors ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-[11px] inline-flex items-center gap-1 transition-colors px-1">
              <Plus className="w-3 h-3" />
              Añadir a lista...
            </span>
          )}
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 z-50 mt-1 w-60 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150">
            <input
              type="text"
              placeholder="Buscar o crear para lista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white mb-2 focus:outline-none focus:border-blue-500"
            />
            
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {filteredTags.length > 0 ? (
                filteredTags.map(t => {
                  const isSelected = selectedTagIds.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleToggleTag(t.id)}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                        isSelected ? 'bg-slate-100 dark:bg-slate-800 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span 
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 truncate max-w-[170px]"
                        style={{ backgroundColor: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-400 dark:border-slate-600'}`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              ) : searchTerm.trim() ? (
                <button
                  onClick={handleCreateNewTag}
                  className="w-full flex items-center gap-1.5 text-left px-2 py-1.5 text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crear tag: <span className="font-semibold">"{searchTerm}"</span>
                </button>
              ) : (
                <p className="text-center py-2 text-[11px] text-slate-400">Sin tags configurados.</p>
              )}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  setActiveSidePeekColumnId(column.id);
                }}
                className="flex items-center gap-1 text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 font-medium transition-colors w-full justify-center py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Settings className="w-3 h-3" />
                Administrar Tags (Consola)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div className="px-3 py-2 text-xs text-slate-400">-</div>;
};
