import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePOEStore } from '../../store/usePOEStore';
import { useShallow } from 'zustand/react/shallow';
import { POECell } from './POECell';
import { POEColumnType, POEColumn, POEProcedure } from '../../types/poe';
import { 
  Plus, 
  Settings, 
  ChevronUp, 
  ChevronDown, 
  ListCheck, 
  GitBranch, 
  Tag, 
  Tags, 
  Type, 
  Calendar, 
  Hash, 
  MoreVertical, 
  Filter, 
  Trash2,
  Sparkles
} from 'lucide-react';

export const POETable: React.FC = () => {
  const {
    procedures,
    columns,
    tags,
    searchQuery,
    selectedSopTypeFilter,
    sortColumnId,
    sortDirection,
    columnFilters,
    activeSidePeekColumnId,
    setActiveSidePeekColumnId,
    setSort,
    createColumn,
    setSelectedProcedureForModal,
    setIsCreatingNewProcedureModal,
    deleteProcedure
  } = usePOEStore(
    useShallow((state) => ({
      procedures: state.procedures,
      columns: state.columns,
      tags: state.tags,
      searchQuery: state.searchQuery,
      selectedSopTypeFilter: state.selectedSopTypeFilter,
      sortColumnId: state.sortColumnId,
      sortDirection: state.sortDirection,
      columnFilters: state.columnFilters,
      activeSidePeekColumnId: state.activeSidePeekColumnId,
      setActiveSidePeekColumnId: state.setActiveSidePeekColumnId,
      setSort: state.setSort,
      createColumn: state.createColumn,
      setSelectedProcedureForModal: state.setSelectedProcedureForModal,
      setIsCreatingNewProcedureModal: state.setIsCreatingNewProcedureModal,
      deleteProcedure: state.deleteProcedure,
    }))
  );

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<POEColumnType>('single_select');
  const addColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addColRef.current && !addColRef.current.contains(e.target as Node)) {
        setIsAddingColumn(false);
      }
    };
    if (isAddingColumn) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddingColumn]);

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    const col = await createColumn(newColName.trim(), newColType);
    setNewColName('');
    setIsAddingColumn(false);
    if (col) {
      // Opcional: abrir directamente el Side Peek para empezar a añadirle tags
      if (col.type === 'single_select' || col.type === 'multi_select') {
        setActiveSidePeekColumnId(col.id);
      }
    }
  };

  // Icono para tipo de columna
  const getColumnIcon = (type: POEColumnType) => {
    switch (type) {
      case 'single_select': return <Tag className="w-3.5 h-3.5 text-blue-500" />;
      case 'multi_select': return <Tags className="w-3.5 h-3.5 text-emerald-500" />;
      case 'date': return <Calendar className="w-3.5 h-3.5 text-amber-500" />;
      case 'number': return <Hash className="w-3.5 h-3.5 text-purple-500" />;
      default: return <Type className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Filtrado y Ordenamiento Memorizado
  const filteredAndSortedProcedures = useMemo(() => {
    let res = [...procedures];

    // 1. Filtro de búsqueda texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(p => 
        p.title.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // 2. Filtro de tipo SOP (A o B)
    if (selectedSopTypeFilter !== 'ALL') {
      res = res.filter(p => p.sop_type === selectedSopTypeFilter);
    }

    // 3. Filtros personalizados por Columna
    Object.entries(columnFilters).forEach(([colId, filterVal]) => {
      if (!filterVal || (Array.isArray(filterVal) && filterVal.length === 0)) return;
      
      res = res.filter(p => {
        const cellVal = p.custom_values?.[colId];
        if (!cellVal) return false;
        
        if (Array.isArray(filterVal)) {
          // Si el filtro es un array de tag IDs
          if (Array.isArray(cellVal)) {
            return cellVal.some(val => filterVal.includes(val));
          }
          return filterVal.includes(cellVal);
        } else if (typeof filterVal === 'string') {
          if (Array.isArray(cellVal)) {
            return cellVal.includes(filterVal);
          }
          return String(cellVal).toLowerCase().includes(filterVal.toLowerCase());
        }
        return true;
      });
    });

    // 4. Ordenamiento
    res.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortColumnId === 'title') {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (sortColumnId === 'sop_type') {
        valA = a.sop_type;
        valB = b.sop_type;
      } else if (sortColumnId === 'updated_at') {
        valA = new Date(a.updated_at || 0).getTime();
        valB = new Date(b.updated_at || 0).getTime();
      } else {
        // Ordenar por columna personalizada
        const col = columns.find(c => c.id === sortColumnId);
        valA = a.custom_values?.[sortColumnId] || '';
        valB = b.custom_values?.[sortColumnId] || '';

        // Si es tag, buscar el nombre del tag para orden alfabético coherente
        if (col && (col.type === 'single_select' || col.type === 'multi_select')) {
          const tagId = Array.isArray(valA) ? valA[0] : valA;
          const tagObj = tags.find(t => t.id === tagId);
          valA = tagObj ? tagObj.name.toLowerCase() : '';

          const tagIdB = Array.isArray(valB) ? valB[0] : valB;
          const tagObjB = tags.find(t => t.id === tagIdB);
          valB = tagObjB ? tagObjB.name.toLowerCase() : '';
        }
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return res;
  }, [procedures, columns, tags, searchQuery, selectedSopTypeFilter, sortColumnId, sortDirection, columnFilters]);

  // Manejador del Clic en Encabezado o Clic Derecho para activar la Consola de Edición en Side Peek
  const handleHeaderInteraction = (columnId: string, e: React.MouseEvent, isRightClick: boolean = false) => {
    if (isRightClick) {
      e.preventDefault(); // Prevenir menú nativo del navegador
      setActiveSidePeekColumnId(columnId);
    } else {
      // Si la consola de edición YA está abierta, conmutar en vivo al seleccionar otra columna
      if (activeSidePeekColumnId !== null) {
        setActiveSidePeekColumnId(columnId);
      } else {
        // Alternar ordenamiento por defecto en clic normal si la consola está cerrada
        setSort(columnId);
      }
    }
  };

  return (
    <div className="flex-1 w-full bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full border-collapse text-left">
          {/* ENCABEZADOS ESTILO NOTION / AIRTABLE */}
          <thead>
            <tr className="bg-slate-50/80 dark:bg-[#161b22] border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 select-none">
              
              {/* Columna Principal: PROCEDIMIENTO (SOP) */}
              <th 
                onClick={(e) => handleHeaderInteraction('title', e)}
                onContextMenu={(e) => { e.preventDefault(); setSort('title'); }}
                className="py-2.5 px-4 min-w-[280px] max-w-[400px] border-r border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    <span>Procedimiento Estándar (POE)</span>
                  </div>
                  {sortColumnId === 'title' && (
                    <span className="text-blue-500">
                      {sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </div>
              </th>

              {/* Columna Sistema: TIPO DE SOP */}
              <th 
                onClick={(e) => handleHeaderInteraction('sop_type', e)}
                className="py-2.5 px-3 min-w-[160px] max-w-[180px] border-r border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">Tipo de Guía</span>
                  {sortColumnId === 'sop_type' && (
                    <span className="text-blue-500">
                      {sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </div>
              </th>

              {/* COLUMNAS DINÁMICAS */}
              {columns.map(col => {
                const isSidePeekActive = activeSidePeekColumnId === col.id;
                const hasActiveFilter = !!columnFilters[col.id];

                return (
                  <th
                    key={col.id}
                    style={{ minWidth: `${col.width || 180}px` }}
                    onClick={(e) => handleHeaderInteraction(col.id, e, false)}
                    onContextMenu={(e) => handleHeaderInteraction(col.id, e, true)}
                    className={`py-2.5 px-3 border-r border-slate-200/60 dark:border-slate-800/60 cursor-pointer transition-all group ${
                      isSidePeekActive 
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold' 
                        : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/50'
                    }`}
                    title="Clic derecho para abrir Consola de Edición de Propiedades"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2 truncate">
                        {getColumnIcon(col.type)}
                        <span className="truncate">{col.name}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {hasActiveFilter && (
                          <span title="Filtro activo en esta columna">
                            <Filter className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                          </span>
                        )}
                        {sortColumnId === col.id && (
                          <span className="text-blue-500">
                            {sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSidePeekColumnId(isSidePeekActive ? null : col.id);
                          }}
                          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                            isSidePeekActive ? 'opacity-100 bg-blue-100 dark:bg-blue-900/60 text-blue-600' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500'
                          }`}
                          title="Propiedades y Consola de Edición"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </th>
                );
              })}

              {/* BOTÓN + AGREGAR COLUMNA */}
              <th className="py-2 px-3 w-[140px] text-center bg-slate-50/40 dark:bg-[#161b22]/50">
                <div className="relative" ref={addColRef}>
                  <button
                    onClick={() => setIsAddingColumn(!isAddingColumn)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/60 rounded-md transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Columna
                  </button>

                  {/* Popover para Crear Columna */}
                  {isAddingColumn && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-3 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white mb-2 uppercase tracking-wider font-mono">Nueva Columna</h4>
                      <form onSubmit={handleCreateColumn} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">Nombre</label>
                          <input
                            type="text"
                            placeholder="Ej: Sector, Responsable, Estado..."
                            value={newColName}
                            onChange={(e) => setNewColName(e.target.value)}
                            required
                            autoFocus
                            className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">Tipo de Propiedad</label>
                          <div className="grid grid-cols-1 gap-1">
                            {[
                              { type: 'single_select', name: 'Seleccionar (1 Tag)', icon: <Tag className="w-3.5 h-3.5 text-blue-500" /> },
                              { type: 'multi_select', name: 'Lista de Tags (Varios)', icon: <Tags className="w-3.5 h-3.5 text-emerald-500" /> },
                              { type: 'text', name: 'Texto Libre', icon: <Type className="w-3.5 h-3.5 text-slate-400" /> },
                              { type: 'date', name: 'Fecha de Revisión', icon: <Calendar className="w-3.5 h-3.5 text-amber-500" /> }
                            ].map(opt => (
                              <label
                                key={opt.type}
                                onClick={() => setNewColType(opt.type as any)}
                                className={`flex items-center gap-2 p-1.5 rounded-md text-xs cursor-pointer border ${
                                  newColType === opt.type 
                                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 font-medium' 
                                    : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                }`}
                              >
                                {opt.icon}
                                <span className="text-slate-800 dark:text-slate-200">{opt.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setIsAddingColumn(false)}
                            className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all shadow-sm"
                          >
                            Crear
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </th>
            </tr>
          </thead>

          {/* CUERPO DE LA TABLA */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredAndSortedProcedures.length > 0 ? (
              filteredAndSortedProcedures.map((proc, idx) => {
                return (
                  <tr 
                    key={proc.id} 
                    className="hover:bg-slate-50/60 dark:hover:bg-[#111720] transition-colors group"
                  >
                    {/* CELDA PRINCIPAL: TITULO */}
                    <td 
                      onClick={() => setSelectedProcedureForModal(proc)}
                      className="py-2.5 px-4 border-r border-slate-100 dark:border-slate-800/50 cursor-pointer font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 truncate">
                          {proc.sop_type === 'A_LIST' ? (
                            <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0" title="SOP Tipo A: Lista Rápida">
                              <ListCheck className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0" title="SOP Tipo B: Árbol Sí/No">
                              <GitBranch className="w-4 h-4" />
                            </div>
                          )}
                          <span className="truncate text-sm font-semibold">{proc.title}</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Estás seguro de eliminar el procedimiento "${proc.title}"?`)) {
                              deleteProcedure(proc.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar POE"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* CELDA DE TIPO */}
                    <td 
                      onClick={() => setSelectedProcedureForModal(proc)}
                      className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/50 cursor-pointer text-xs"
                    >
                      {proc.sop_type === 'A_LIST' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                          <ListCheck className="w-3 h-3" />
                          Lista Rápida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                          <GitBranch className="w-3 h-3" />
                          Flowchart Sí/No
                        </span>
                      )}
                    </td>

                    {/* CELDAS DE COLUMNAS DINÁMICAS */}
                    {columns.map(col => (
                      <td key={col.id} className="p-0 border-r border-slate-100 dark:border-slate-800/50">
                        <POECell procedure={proc} column={col} />
                      </td>
                    ))}

                    <td className="bg-transparent"></td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={columns.length + 3} className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                  <div className="max-w-xs mx-auto flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No se encontraron procedimientos</p>
                    <p className="text-xs">Crea el primer procedimiento (POE) o ajusta los filtros de búsqueda.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PIE DE TABLA - BOTÓN NUEVA SOP */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0d1117] flex items-center justify-between text-xs text-slate-500">
        <button
          onClick={() => setIsCreatingNewProcedureModal(true, 'A_LIST')}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Nuevo Procedimiento Estándar (POE)
        </button>
        <span>Total: <strong>{filteredAndSortedProcedures.length}</strong> guías en vista</span>
      </div>
    </div>
  );
};
