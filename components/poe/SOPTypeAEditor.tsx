import React, { useState, useEffect, useRef } from 'react';
import { SOPListStep } from '../../types/poe';
import { Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2, Circle, RotateCcw, ListCheck, Sparkles } from 'lucide-react';

interface Props {
  steps: SOPListStep[];
  onUpdateSteps: (newSteps: SOPListStep[]) => void;
  isEditing: boolean;
}

export const SOPTypeAEditor: React.FC<Props> = ({ steps: externalSteps = [], onUpdateSteps, isEditing }) => {
  // Estado LOCAL de los pasos - protegido de re-renders externos mientras el usuario edita
  const [localSteps, setLocalSteps] = useState<SOPListStep[]>([]);
  const isFirstMount = useRef(true);

  // Sync only on initial load or when steps structure changes (different IDs, not content)
  useEffect(() => {
    const externalIds = externalSteps.map(s => s.id).join(',');
    const localIds = localSteps.map(s => s.id).join(',');
    if (isFirstMount.current || externalIds !== localIds) {
      setLocalSteps(externalSteps);
      isFirstMount.current = false;
    }
  }, [externalSteps]);

  // Estado local para marcar checks terminados durante la ejecución
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  // Actualizar localmente e inmediatamente, guardar al perder foco (onBlur)
  const handleLocalUpdate = (id: string, updates: Partial<SOPListStep>) => {
    setLocalSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Persistir al store al perder foco en un campo
  const handleBlurSave = () => {
    onUpdateSteps(localSteps);
  };

  const handleAddStep = () => {
    const newStep: SOPListStep = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      order_index: localSteps.length
    };
    const next = [...localSteps, newStep];
    setLocalSteps(next);
    onUpdateSteps(next);
  };

  const handleDeleteStep = (id: string) => {
    if (localSteps.length <= 1) {
      alert("Una guía tipo Lista debe tener al menos 1 paso.");
      return;
    }
    const next = localSteps.filter(s => s.id !== id).map((s, idx) => ({ ...s, order_index: idx }));
    setLocalSteps(next);
    onUpdateSteps(next);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const nextIdx = direction === 'up' ? index - 1 : index + 1;
    if (nextIdx < 0 || nextIdx >= localSteps.length) return;

    const copy = [...localSteps];
    const temp = copy[index];
    copy[index] = copy[nextIdx];
    copy[nextIdx] = temp;

    const next = copy.map((s, i) => ({ ...s, order_index: i }));
    setLocalSteps(next);
    onUpdateSteps(next);
  };

  const toggleCheck = (id: string) => {
    setCompletedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const resetChecks = () => setCompletedIds([]);

  const steps = localSteps;
  const progress = steps.length > 0 ? Math.round((completedIds.length / steps.length) * 100) : 0;

  // ── MODO LECTURA / EJECUCIÓN OPERATIVA ──────────────────────────────────
  if (!isEditing) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto py-4">
        {/* Encabezado de Progreso */}
        <div className="p-4 bg-primary border border-primary/20 rounded-2xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ListCheck className="w-5 h-5 text-primary" />
              <h4 className="font-bold text-fg text-sm">Guía Operativa de Ejecución Rápida</h4>
            </div>
            <p className="text-xs text-fg-muted">Sigue la secuencia y marca los pasos realizados para asegurar la estandarización.</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs font-bold font-mono text-primary">
                {completedIds.length} / {steps.length} ({progress}%)
              </div>
              <div className="w-28 h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {completedIds.length > 0 && (
              <button
                onClick={resetChecks}
                className="p-2 text-fg-subtle hover:text-slate-700 dark:hover:text-slate-200 bg-surface border border-subtle rounded-xl hover:shadow transition-all"
                title="Reiniciar casillas"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {progress === 100 && (
          <div className="p-4 bg-success/15 border border-success/30 rounded-2xl flex items-center gap-3 text-success animate-in fade-in zoom-in-95 duration-200">
            <Sparkles className="w-6 h-6 shrink-0 text-success animate-bounce" />
            <div>
              <p className="font-bold text-sm">¡Procedimiento Completado!</p>
              <p className="text-xs text-fg-muted">Has realizado exitosamente todos los pasos estándar verificados por este POE.</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {steps.map((step, idx) => {
            const isDone = completedIds.includes(step.id);
            return (
              <div
                key={step.id}
                onClick={() => toggleCheck(step.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${ isDone ? 'bg-slate-50/50 dark:bg-slate-900/40 border-success/40 shadow-xs opacity-75' : 'bg-white dark:bg-[#161b22] border-subtle hover:border-primary hover:shadow-md' }`}
              >
                <div className="pt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-success fill-emerald-500/10" />
                  ) : (
                    <Circle className="w-5 h-5 text-fg-subtle" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-fg-subtle uppercase tracking-widest font-bold">
                      Paso {idx + 1}
                    </span>
                    {step.role_tag && (
                      <span className="px-2 py-0.5 rounded text-2xs font-bold bg-surface-3 text-fg-muted border border-subtle">
                        👤 {step.role_tag}
                      </span>
                    )}
                  </div>
                  <h5 className={`font-semibold text-sm ${isDone ? 'line-through text-fg-muted dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                    {step.title || <span className="italic text-fg-subtle">Sin título</span>}
                  </h5>
                  {step.description && (
                    <p className="text-xs text-fg-muted whitespace-pre-wrap leading-relaxed">
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

  // ── MODO EDICIÓN ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-3xl mx-auto py-4">
      <div className="flex items-center justify-between border-b border-subtle pb-3">
        <div>
          <h4 className="font-bold text-fg text-sm flex items-center gap-2">
            <ListCheck className="w-4 h-4 text-primary" />
            Configuración del Checklist (Tipo A)
          </h4>
          <p className="text-xs text-fg-muted">Agrega o edita los pasos secuenciales de este procedimiento.</p>
        </div>
        <button
          type="button"
          onClick={handleAddStep}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs bg-primary hover:bg-primary text-white rounded-lg transition-all shadow-xs"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Agregar Paso
        </button>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="p-4 bg-surface border border-subtle rounded-xl space-y-3 shadow-2xs relative group"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 bg-primary/10 text-primary font-mono text-[11px] font-bold rounded">
                PASO {idx + 1}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMove(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 rounded-lg text-fg-subtle hover:text-slate-700 dark:hover:text-white hover:bg-surface-hover disabled:opacity-20 transition-all"
                  title="Mover arriba"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(idx, 'down')}
                  disabled={idx === steps.length - 1}
                  className="p-1.5 rounded-lg text-fg-subtle hover:text-slate-700 dark:hover:text-white hover:bg-surface-hover disabled:opacity-20 transition-all"
                  title="Mover abajo"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteStep(step.id)}
                  className="p-1.5 rounded-lg text-fg-subtle hover:text-danger hover:bg-danger-soft transition-all ml-2"
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
                onChange={(e) => handleLocalUpdate(step.id, { title: e.target.value })}
                onBlur={handleBlurSave}
                placeholder="Título del paso (Ej. Revisar código de barra)"
                className="w-full font-semibold text-sm px-3 py-2 bg-surface-2 border border-subtle rounded-lg text-fg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <textarea
                value={step.description || ''}
                onChange={(e) => handleLocalUpdate(step.id, { description: e.target.value })}
                onBlur={handleBlurSave}
                placeholder="Instrucciones detalladas de qué revisar o hacer en este paso..."
                rows={2}
                className="w-full text-xs px-3 py-2 bg-surface-2 border border-subtle rounded-lg text-fg focus:outline-none focus:ring-1 focus:ring-primary custom-scrollbar resize-none"
              />
            </div>
          </div>
        ))}
      </div>

      {steps.length === 0 && (
        <div className="text-center py-10 text-fg-subtle">
          <ListCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No hay pasos aún.</p>
          <p className="text-xs">Usa el botón "Agregar Paso" para comenzar a construir tu checklist.</p>
        </div>
      )}

      <div className="pt-3 flex justify-center">
        <button
          type="button"
          onClick={handleAddStep}
          className="px-4 py-2 border border-dashed border-strong hover:border-primary text-fg-muted hover:text-primary rounded-xl text-xs font-semibold transition-all w-full flex items-center justify-center gap-2 bg-slate-50/50 dark:bg-[#161b22]/40"
        >
          <Plus className="w-4 h-4" />
          Añadir otro paso a la lista
        </button>
      </div>
    </div>
  );
};
