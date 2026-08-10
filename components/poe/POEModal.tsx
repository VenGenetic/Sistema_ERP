import React, { useState, useEffect } from 'react';
import { usePOEStore } from '../../store/usePOEStore';
import { useShallow } from 'zustand/react/shallow';
import { SOPTypeAEditor } from './SOPTypeAEditor';
import { SOPTypeBEditor } from './SOPTypeBEditor';
import { SOPType } from '../../types/poe';
import { 
  X, 
  ListCheck, 
  GitBranch, 
  Eye, 
  Edit3, 
  Sparkles, 
  Check, 
  Save, 
  FileText,
  Tag as TagIcon
} from 'lucide-react';

export const POEModal: React.FC = () => {
  const {
    selectedProcedureForModal,
    setSelectedProcedureForModal,
    isCreatingNewProcedureModal,
    setIsCreatingNewProcedureModal,
    newProcedureTypePreset,
    createProcedure,
    updateProcedure,
    columns,
    tags
  } = usePOEStore(
    useShallow((state) => ({
      selectedProcedureForModal: state.selectedProcedureForModal,
      setSelectedProcedureForModal: state.setSelectedProcedureForModal,
      isCreatingNewProcedureModal: state.isCreatingNewProcedureModal,
      setIsCreatingNewProcedureModal: state.setIsCreatingNewProcedureModal,
      newProcedureTypePreset: state.newProcedureTypePreset,
      createProcedure: state.createProcedure,
      updateProcedure: state.updateProcedure,
      columns: state.columns,
      tags: state.tags,
    }))
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<SOPType>('A_LIST');
  const [isEditing, setIsEditing] = useState(false);
  // Track which proc ID is currently open so we only reset state when it truly changes
  const [openProcId, setOpenProcId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProcedureForModal) {
      // Only reset state when opening a *different* procedure
      if (selectedProcedureForModal.id !== openProcId) {
        setTitle(selectedProcedureForModal.title || '');
        setDescription(selectedProcedureForModal.description || '');
        setIsEditing(false);
        setOpenProcId(selectedProcedureForModal.id);
      }
    } else if (isCreatingNewProcedureModal) {
      setTitle('');
      setDescription('');
      setSelectedType(newProcedureTypePreset || 'A_LIST');
      setOpenProcId(null);
    } else {
      // Modal closed
      setOpenProcId(null);
      setIsEditing(false);
    }
  }, [selectedProcedureForModal?.id, isCreatingNewProcedureModal, newProcedureTypePreset]);

  if (!selectedProcedureForModal && !isCreatingNewProcedureModal) return null;

  // MODO CREACIÓN DE NUEVA SOP / POE
  if (isCreatingNewProcedureModal) {
    const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      const created = await createProcedure(title.trim(), selectedType, description.trim());
      setIsCreatingNewProcedureModal(false);
      if (created) {
        // Abrir inmediatamente la guía creada para comenzar a cargarle pasos en modo edición
        setSelectedProcedureForModal(created);
        setIsEditing(true);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-[#111720] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
          
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                Nuevo Procedimiento Estándar (POE)
              </h3>
              <p className="text-xs text-slate-500 mt-1">Elige la estructura de tu guía o protocolo operativo.</p>
            </div>
            <button
              onClick={() => setIsCreatingNewProcedureModal(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            {/* SELECTOR DE TIPO DE SOP */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 font-mono">
                1. Selecciona el Tipo de Procedimiento
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* OPCIÓN TIPO A: LISTA */}
                <div
                  onClick={() => setSelectedType('A_LIST')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between group ${
                    selectedType === 'A_LIST'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] hover:border-blue-400/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 group-hover:scale-110 transition-transform">
                        <ListCheck className="w-6 h-6" />
                      </div>
                      {selectedType === 'A_LIST' && <span className="text-blue-500 font-bold text-sm">✔ Elegido</span>}
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">Tipo A: Lista Rápida</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Ideal para tareas cortas, checklists rutinarios, apertura/cierre o auditorías sin bifurcaciones ni desvíos.
                    </p>
                  </div>
                </div>

                {/* OPCIÓN TIPO B: FLOWCHART SÍ/NO */}
                <div
                  onClick={() => setSelectedType('B_DECISION')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between group ${
                    selectedType === 'B_DECISION'
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/40 shadow-md ring-2 ring-purple-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] hover:border-purple-400/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 group-hover:scale-110 transition-transform">
                        <GitBranch className="w-6 h-6" />
                      </div>
                      {selectedType === 'B_DECISION' && <span className="text-purple-500 font-bold text-sm">✔ Elegido</span>}
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">Tipo B: Flowchart Sí/No</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Crea árboles de decisión visuales y guía al trabajador paso a paso con botones Sí/No hasta resolver la tarea.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CAMPOS DE DATOS */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  2. Título de la Guía o Procedimiento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Recepción y Verificación de Repuestos en Almacén"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0c1117] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  3. Descripción u Objetivo del Procedimiento (Opcional)
                </label>
                <textarea
                  placeholder="Describe el propósito de esta guía operativa para el equipo..."
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#0c1117] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreatingNewProcedureModal(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Crear y Comenzar Diseño
              </button>
            </div>
          </form>

        </div>
      </div>
    );
  }

  // MODO VISUALIZACIÓN / EDICIÓN DE SOP EXISTENTE
  const proc = selectedProcedureForModal!;

  const handleSaveTitleDescription = () => {
    updateProcedure(proc.id, { title, description });
  };

  const handleUpdateContent = (newContent: any) => {
    updateProcedure(proc.id, { content_json: newContent });
  };

  const handleToggleSopType = (newType: SOPType) => {
    if (newType === proc.sop_type) return;

    if (!confirm(`¿Estás seguro de cambiar el tipo de SOP a ${newType === 'A_LIST' ? 'Lista Rápida' : 'Flowchart'}? Intentaremos convertir tu contenido actual para que no lo pierdas.`)) {
      return;
    }

    let newContent: any[] = [];
    if (newType === 'B_DECISION') {
      // Convert A_LIST (SOPListStep[]) to B_DECISION (SOPDecisionNode[])
      const listSteps = (proc.content_json || []) as any[];
      if (listSteps.length === 0) {
        newContent = [{
          id: crypto.randomUUID(),
          node_type: 'QUESTION',
          question_or_action: '¿Se cumple la condición principal?',
          detail_text: '',
          yes_next_id: null,
          no_next_id: null,
          color_tag: 'blue'
        }];
      } else {
        // Convert list to a linear decision flow
        newContent = listSteps.map((step, idx) => {
          const isLast = idx === listSteps.length - 1;
          const nextId = isLast ? null : (listSteps[idx + 1].id || crypto.randomUUID());
          return {
            id: step.id || crypto.randomUUID(),
            node_type: isLast ? 'ACTION' : 'QUESTION',
            question_or_action: step.title || `Paso ${idx + 1}`,
            detail_text: step.description || '',
            yes_next_id: nextId,
            no_next_id: null,
            color_tag: 'blue'
          };
        });
      }
    } else {
      // Convert B_DECISION (SOPDecisionNode[]) to A_LIST (SOPListStep[])
      const decisionNodes = (proc.content_json || []) as any[];
      if (decisionNodes.length === 0) {
        newContent = [{
          id: crypto.randomUUID(),
          title: 'Paso 1: Procedimiento iniciado',
          description: '',
          order_index: 0
        }];
      } else {
        // Just flatten all nodes sequentially
        newContent = decisionNodes.map((node, idx) => ({
          id: node.id || crypto.randomUUID(),
          title: node.question_or_action || `Paso ${idx + 1}`,
          description: node.detail_text || '',
          order_index: idx
        }));
      }
    }

    // Update procedure with new type and converted content
    updateProcedure(proc.id, {
      sop_type: newType,
      content_json: newContent
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-2 md:p-6 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* BARRA SUPERIOR DEL MODAL */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70 dark:bg-[#111720]/80">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            {isEditing ? (
              <select
                value={proc.sop_type}
                onChange={(e) => handleToggleSopType(e.target.value as SOPType)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              >
                <option value="A_LIST">📋 Lista Rápida (Tipo A)</option>
                <option value="B_DECISION">🌿 Flowchart Sí/No (Tipo B)</option>
              </select>
            ) : (
              proc.sop_type === 'A_LIST' ? (
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-extrabold rounded-xl text-xs flex items-center gap-1.5 border border-blue-200 dark:border-blue-800/60 shadow-xs shrink-0">
                  <ListCheck className="w-4 h-4 text-blue-500" />
                  Lista Rápida (Tipo A)
                </span>
              ) : (
                <span className="px-3 py-1 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-extrabold rounded-xl text-xs flex items-center gap-1.5 border border-purple-200 dark:border-purple-800/60 shadow-xs shrink-0">
                  <GitBranch className="w-4 h-4 text-purple-500" />
                  Flowchart Sí/No (Tipo B)
                </span>
              )
            )}

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitleDescription}
                  className="w-full font-extrabold text-lg bg-white dark:bg-slate-900 px-3 py-1 border border-blue-500 rounded-xl text-slate-900 dark:text-white focus:outline-none"
                />
              ) : (
                <h2 className="font-extrabold text-lg md:text-xl text-slate-900 dark:text-white truncate" title={proc.title}>
                  {proc.title}
                </h2>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* SWITCH MODO LECTURA / EDICIÓN */}
            <button
              onClick={() => {
                if (isEditing) handleSaveTitleDescription();
                setIsEditing(!isEditing);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                isEditing
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 animate-pulse'
                  : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            >
              {isEditing ? (
                <>
                  <Save className="w-4 h-4" />
                  Guardar y Ver Guía
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 text-blue-500" />
                  Editar Procedimiento
                </>
              )}
            </button>

            <button
              onClick={() => setSelectedProcedureForModal(null)}
              className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
              title="Cerrar ventana"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* SUB-BARRA DE DESCRIPCIÓN Y TAGS ASOCIADOS */}
        <div className="px-6 py-2.5 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#0c1117] flex items-center justify-between text-xs text-slate-500">
          {isEditing ? (
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveTitleDescription}
              placeholder="Descripción u objetivo del procedimiento..."
              className="w-full text-xs px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
            />
          ) : (
            <p className="truncate italic max-w-2xl">{proc.description || 'Sin descripción adicional programada para este estándar.'}</p>
          )}

          <div className="flex items-center gap-2 shrink-0 ml-4 font-mono text-[11px]">
            <span>Actualizado: {new Date(proc.updated_at || Date.now()).toLocaleDateString()}</span>
          </div>
        </div>

        {/* CUERPO PRINCIPAL DEL MODAL */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50/40 dark:bg-[#0a0e13]/50">
          {proc.sop_type === 'A_LIST' ? (
            <SOPTypeAEditor
              steps={proc.content_json as any}
              onUpdateSteps={handleUpdateContent}
              isEditing={isEditing}
            />
          ) : (
            <SOPTypeBEditor
              nodes={proc.content_json as any}
              onUpdateNodes={handleUpdateContent}
              isEditing={isEditing}
            />
          )}
        </div>

        {/* PIE CON RECORDATORIO RÁPIDO */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#111720] flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <TagIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Los tags de clasificación (Área, Roles, etc.) se editan en tiempo real directamente sobre las celdas y en la Consola de Edición (Side Peek).</span>
          </div>
          <button
            onClick={() => setSelectedProcedureForModal(null)}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg transition-all"
          >
            Cerrar Vista
          </button>
        </div>

      </div>
    </div>
  );
};
