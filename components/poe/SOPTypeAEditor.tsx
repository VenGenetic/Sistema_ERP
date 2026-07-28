import React, { useState } from 'react';
import { SOPListStep } from '../../types/poe';
import { Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2, Circle, RotateCcw, ListCheck, Sparkles, HelpCircle } from 'lucide-react';

interface Props {
  steps: SOPListStep[];
  onUpdateSteps: (newSteps: SOPListStep[]) => void;
  isEditing: boolean;
}

export const SOPTypeAEditor: React.FC<Props> = ({ steps = [], onUpdateSteps, isEditing }) => {
  // Estado local para marcar checks terminados durante la consulta/ejecución
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const handleAddStep = () => {
    const newStep: SOPListStep = {
      id: crypto.randomUUID(),
      title: `Nuevo Paso ${steps.length + 1}`,
      description: 'Describe brevemente la instrucción...',
      order_index: steps.length
    };
    onUpdateSteps([...steps, newStep]);
  };

  const handleUpdateStep = (id: string, updates: Partial<SOPListStep>) => {
    onUpdateSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleDeleteStep = (id: string) => {
    if (steps.length <= 1) {
      alert("Una guía tipo Lista debe tener al menos 1 paso.");
      return;
    }
    onUpdateSteps(steps.filter(s => s.id !== id).map((s, idx) => ({ ...s, order_index: idx })));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= steps.length) return;

    const copy = [...steps];
    const temp = copy[index];
    copy[index] = copy[nextIdx];
    copy[nextIdx] = temp;

    onUpdateSteps(copy.map((s, i) => ({ ...s, order_index: i })));
  };

  const toggleCheck = (id: string) => {
    setCompletedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const resetChecks = () => setCompletedIds([]);

  const progress = steps.length > 0 ? Math.round((completedIds.length / steps.length) * 100) : 0;

  // MODO LECTURA / EJECUCIÓN OPERATIVA
  if (!isEditing) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto py-4">
        {/* Encabezado de Progreso */}
        <div className="p-4 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent dark:from-blue-950/60 dark:via-indigo-950/40 border border-blue-500/20 rounded-2xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ListCheck className="w-5 h-5 text-blue-500" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Guía Operativa de Ejecución Rápida</h4>
            </div>
            <p className="text-xs text-slate-500">Sigue la secuencia y marca los pasos realizados para asegurar la estandarización.</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
                {completedIds.length} / {steps.length} ({progress}%)
              </div>
              <div className="w-28 h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {completedIds.length > 0 && (
              <button
                onClick={resetChecks}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow transition-all"
                title="Reiniciar casillas"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Banner de felicitación si terminó al 100% */}
        {progress === 100 && (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 animate-in fade-in zoom-in-95 duration-200">
            <Sparkles className="w-6 h-6 shrink-0 text-emerald-500 animate-bounce" />
            <div>
              <p className="font-bold text-sm">¡Procedimiento Completado!</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Has realizado exitosamente todos los pasos estándar verificados por este POE.</p>
            </div>
          </div>
        )}

        {/* Lista interactiva de Check */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const isDone = completedIds.includes(step.id);
            return (
              <div
                key={step.id}
                onClick={() => toggleCheck(step.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  isDone 
                    ? 'bg-slate-50/50 dark:bg-slate-900/40 border-emerald-500/40 shadow-xs opacity-75' 
                    : 'bg-white dark:bg-[#161b22] border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md'
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold">
                      Paso {idx + 1}
                    </span>
                    {step.role_tag && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        👤 {step.role_tag}
                      </span>
                    )}
                  </div>
                  <h5 className={`font-semibold text-sm ${isDone ? 'line-through text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                    {step.title}
                  </h5>
                  {step.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // MODO EDICIÓN
  return (
    <div className="space-y-4 max-w-3xl mx-auto py-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <ListCheck className="w-4 h-4 text-blue-500" />
            Configuración del Checklist (Tipo A)
          </h4>
          <p className="text-xs text-slate-500">Agrega o edita los pasos secuenciales de este procedimiento.</p>
        </div>
        <button
          type="button"
          onClick={handleAddStep}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Agregar Paso
        </button>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="p-4 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 shadow-2xs relative group"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[11px] font-bold rounded">
                PASO {idx + 1}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMove(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 transition-all"
                  title="Mover arriba"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(idx, 'down')}
                  disabled={idx === steps.length - 1}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 transition-all"
                  title="Mover abajo"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteStep(step.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all ml-2"
                  title="Eliminar paso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={step.title}
                onChange={(e) => handleUpdateStep(step.id, { title: e.target.value })}
                placeholder="Título del paso (Ej. Revisar código de barra)"
                className="w-full font-semibold text-sm px-3 py-2 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <textarea
                value={step.description || ''}
                onChange={(e) => handleUpdateStep(step.id, { description: e.target.value })}
                placeholder="Instrucciones detalladas de qué revisar o hacer en este paso..."
                rows={2}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 custom-scrollbar resize-none"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 flex justify-center">
        <button
          type="button"
          onClick={handleAddStep}
          className="px-4 py-2 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-500 hover:text-blue-500 rounded-xl text-xs font-semibold transition-all w-full flex items-center justify-center gap-2 bg-slate-50/50 dark:bg-[#161b22]/40"
        >
          <Plus className="w-4 h-4" />
          Añadir otro paso a la lista
        </button>
      </div>
    </div>
  );
};
