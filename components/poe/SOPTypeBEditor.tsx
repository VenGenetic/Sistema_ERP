import React, { useState } from 'react';
import { SOPDecisionNode, SOPNodeType } from '../../types/poe';
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  ArrowRight, 
  RotateCcw, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Map, 
  Compass, 
  ArrowLeft, 
  CornerDownRight,
  Sparkles
} from 'lucide-react';

interface Props {
  nodes: SOPDecisionNode[];
  onUpdateNodes: (newNodes: SOPDecisionNode[]) => void;
  isEditing: boolean;
}

export const SOPTypeBEditor: React.FC<Props> = ({ nodes = [], onUpdateNodes, isEditing }) => {
  const [viewMode, setViewMode] = useState<'WIZARD' | 'MAP'>('WIZARD');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(nodes[0]?.id || null);
  const [history, setHistory] = useState<{ nodeId: string; answer: 'YES' | 'NO' | 'START' }[]>([]);

  // Si no hay nodos precargados o está vacío, creamos nodo raíz inicial
  const ensureRootNode = () => {
    if (nodes.length === 0) {
      const root: SOPDecisionNode = {
        id: crypto.randomUUID(),
        node_type: 'QUESTION',
        question_or_action: '¿Se cumple la condición principal del procedimiento?',
        detail_text: 'Describe aquí cómo verificar la condición antes de tomar una decisión.',
        yes_next_id: null,
        no_next_id: null,
        color_tag: 'blue'
      };
      onUpdateNodes([root]);
      setCurrentNodeId(root.id);
    }
  };

  React.useEffect(() => {
    ensureRootNode();
  }, []);

  const getNodeById = (id: string | null | undefined) => nodes.find(n => n.id === id);
  const rootNode = nodes[0];

  // ACCIONES EN MODO EDICIÓN
  const handleUpdateNode = (id: string, updates: Partial<SOPDecisionNode>) => {
    onUpdateNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const handleCreateAndLinkNode = (parentId: string, branch: 'YES' | 'NO', type: SOPNodeType) => {
    const newNode: SOPDecisionNode = {
      id: crypto.randomUUID(),
      node_type: type,
      question_or_action: type === 'QUESTION' 
        ? `Nueva pregunta tras responder ${branch === 'YES' ? 'SÍ' : 'NO'}...` 
        : `Acción resolutiva o instrucción final...`,
      detail_text: '',
      yes_next_id: null,
      no_next_id: null,
      color_tag: branch === 'YES' ? 'emerald' : 'rose'
    };

    const updatedParent = nodes.map(n => {
      if (n.id === parentId) {
        if (branch === 'YES') return { ...n, yes_next_id: newNode.id };
        return { ...n, no_next_id: newNode.id };
      }
      return n;
    });

    onUpdateNodes([...updatedParent, newNode]);
  };

  const handleDeleteNode = (id: string) => {
    if (nodes.length <= 1) {
      alert("El diagrama de flujo debe mantener al menos 1 nodo principal.");
      return;
    }
    // Desvincular de padres
    const updated = nodes
      .filter(n => n.id !== id)
      .map(n => ({
        ...n,
        yes_next_id: n.yes_next_id === id ? null : n.yes_next_id,
        no_next_id: n.no_next_id === id ? null : n.no_next_id,
      }));
    onUpdateNodes(updated);
  };

  // ACCIONES EN MODO GUÍA (WIZARD)
  const handleWizardAnswer = (answer: 'YES' | 'NO') => {
    const current = getNodeById(currentNodeId || rootNode?.id);
    if (!current) return;

    const nextId = answer === 'YES' ? current.yes_next_id : current.no_next_id;
    if (nextId) {
      setHistory(prev => [...prev, { nodeId: current.id, answer }]);
      setCurrentNodeId(nextId);
    } else {
      alert(`Aún no hay un nodo vinculado para la respuesta: ${answer === 'YES' ? 'SÍ' : 'NO'}`);
    }
  };

  const handleWizardBack = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentNodeId(last.nodeId);
  };

  const handleWizardReset = () => {
    setHistory([]);
    setCurrentNodeId(rootNode?.id || null);
  };

  // MODO LECTURA / EJECUCIÓN (WIZARD O MAPA VISTA)
  if (!isEditing) {
    const activeNode = getNodeById(currentNodeId || rootNode?.id) || rootNode;

    return (
      <div className="space-y-6 max-w-3xl mx-auto py-4">
        {/* Selector de modo de consulta: Guía Paso a Paso vs Mapa */}
        <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80">
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('WIZARD')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'WIZARD'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Compass className="w-4 h-4" />
              Guía Paso a Paso (Diagnóstico)
            </button>
            <button
              onClick={() => setViewMode('MAP')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'MAP'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Map className="w-4 h-4" />
              Mapa Visual del Flujo
            </button>
          </div>

          {history.length > 0 && viewMode === 'WIZARD' && (
            <button
              onClick={handleWizardReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-[#111720] border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow transition-all mr-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar guía
            </button>
          )}
        </div>

        {/* MODO 1: WIZARD INTERACTIVO */}
        {viewMode === 'WIZARD' && activeNode && (
          <div className="space-y-6">
            {/* Tarjeta del Nodo Actual */}
            <div className={`p-6 md:p-8 rounded-3xl border shadow-lg transition-all ${
              activeNode.node_type === 'QUESTION'
                ? 'bg-white dark:bg-[#161b22] border-blue-500/30 dark:border-blue-500/40 shadow-blue-500/5'
                : 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/50 dark:to-transparent border border-emerald-500/40 shadow-emerald-500/10'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide font-mono uppercase flex items-center gap-1.5 ${
                  activeNode.node_type === 'QUESTION' ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                }`}>
                  {activeNode.node_type === 'QUESTION' ? (
                    <>
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                      Pregunta de Decisión
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      Acción / Conclusión
                    </>
                  )}
                </span>

                {history.length > 0 && (
                  <button
                    onClick={handleWizardBack}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Paso Anterior
                  </button>
                )}
              </div>

              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                {activeNode.question_or_action}
              </h3>

              {activeNode.detail_text && (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#0d1117]/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  {activeNode.detail_text}
                </p>
              )}

              {/* Botones Sí / No si es una pregunta */}
              {activeNode.node_type === 'QUESTION' && (
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleWizardAnswer('YES')}
                    disabled={!activeNode.yes_next_id}
                    className="group relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-lg flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Check className="w-5 h-5 stroke-[3]" />
                    </div>
                    <span>SÍ</span>
                  </button>

                  <button
                    onClick={() => handleWizardAnswer('NO')}
                    disabled={!activeNode.no_next_id}
                    className="group relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-extrabold text-lg flex items-center justify-center gap-3 shadow-lg shadow-rose-500/25 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <X className="w-5 h-5 stroke-[3]" />
                    </div>
                    <span>NO</span>
                  </button>
                </div>
              )}

              {/* Si es una Acción confluente */}
              {activeNode.node_type === 'ACTION' && (
                <div className="mt-8 p-4 bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                    <span>Estás en la resolución final del proceso estándar.</span>
                  </div>
                  <button
                    onClick={handleWizardReset}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                  >
                    Finalizar / Nuevo Diagnóstico
                  </button>
                </div>
              )}
            </div>

            {/* Historial de Decisiones Tomadas */}
            {history.length > 0 && (
              <div className="p-4 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <h5 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  Ruta de Decisiones Tomadas ({history.length})
                </h5>
                <div className="space-y-1.5">
                  {history.map((step, idx) => {
                    const n = getNodeById(step.nodeId);
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50 dark:bg-[#0d1117]/80 rounded-lg border border-slate-100 dark:border-slate-800/60">
                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate pr-2">
                          {idx + 1}. {n?.question_or_action || 'Pregunta anterior'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] shrink-0 ${
                          step.answer === 'YES' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        }`}>
                          {step.answer === 'YES' ? '✔ SÍ' : '✖ NO'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODO 2: MAPA VISUAL COMPLETO */}
        {viewMode === 'MAP' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-600 dark:text-slate-400 flex items-center gap-3">
              <Map className="w-5 h-5 text-blue-500 shrink-0" />
              <span>Vista de todos los nodos del diagrama. Puedes rastrear qué acción se ejecuta según cada respuesta del flujo.</span>
            </div>

            <div className="space-y-3">
              {nodes.map((node, idx) => {
                const yesNode = getNodeById(node.yes_next_id);
                const noNode = getNodeById(node.no_next_id);

                return (
                  <div key={node.id} className="p-4 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 font-mono text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        NODO #{idx + 1}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        node.node_type === 'QUESTION' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400'
                      }`}>
                        {node.node_type === 'QUESTION' ? '❓ Pregunta' : '✅ Acción Conclusiva'}
                      </span>
                    </div>

                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                      {node.question_or_action}
                    </p>
                    {node.detail_text && <p className="text-xs text-slate-500">{node.detail_text}</p>}

                    {node.node_type === 'QUESTION' && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                        <div className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-slate-700 dark:text-slate-300">
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block mb-0.5">➡ Si responde SÍ:</span>
                          <span className="line-clamp-1 italic text-[11px]">{yesNode ? yesNode.question_or_action : 'Sin asignar'}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40 text-slate-700 dark:text-slate-300">
                          <span className="font-extrabold text-rose-600 dark:text-rose-400 block mb-0.5">➡ Si responde NO:</span>
                          <span className="line-clamp-1 italic text-[11px]">{noNode ? noNode.question_or_action : 'Sin asignar'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // MODO EDICIÓN VISUAL (CONSTRUCTOR NATIVO DE ÁRBOL)
  // ==========================================
  return (
    <div className="space-y-4 max-w-4xl mx-auto py-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-500" />
            Constructor de Diagrama de Flujo (Tipo B)
          </h4>
          <p className="text-xs text-slate-500">Define las preguntas de decisión, conecta las ramas de Sí/No y establece las acciones conclusivas.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            const newNode: SOPDecisionNode = {
              id: crypto.randomUUID(),
              node_type: 'QUESTION',
              question_or_action: 'Nueva Pregunta de Decisión...',
              detail_text: '',
              yes_next_id: null,
              no_next_id: null,
              color_tag: 'blue'
            };
            onUpdateNodes([...nodes, newNode]);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Agregar Nodo Libre
        </button>
      </div>

      <div className="space-y-4">
        {nodes.map((node, idx) => {
          const isRoot = idx === 0;

          return (
            <div
              key={node.id}
              className={`p-5 bg-white dark:bg-[#161b22] border rounded-2xl space-y-4 transition-all relative ${
                isRoot 
                  ? 'border-purple-500/50 dark:border-purple-500/50 shadow-md shadow-purple-500/5 ring-1 ring-purple-500/20' 
                  : 'border-slate-200 dark:border-slate-700 shadow-2xs'
              }`}
            >
              {/* CABECERA DEL NODO */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                    isRoot ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}>
                    {isRoot ? '★ NODO INICIAL (RAÍZ)' : `NODO #${idx + 1}`}
                  </span>

                  <select
                    value={node.node_type}
                    onChange={(e) => handleUpdateNode(node.id, { node_type: e.target.value as SOPNodeType })}
                    className="text-xs font-bold px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="QUESTION">❓ Pregunta de Decisión (Sí/No)</option>
                    <option value="ACTION">✅ Acción Conclusiva (Fin)</option>
                  </select>
                </div>

                {!isRoot && (
                  <button
                    type="button"
                    onClick={() => handleDeleteNode(node.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                    title="Eliminar este nodo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* CONTENIDO DEL NODO */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {node.node_type === 'QUESTION' ? 'Pregunta a realizar (Ej. "¿Tiene factura original?")' : 'Instrucción / Resolución Conclusiva:'}
                  </label>
                  <input
                    type="text"
                    value={node.question_or_action}
                    onChange={(e) => handleUpdateNode(node.id, { question_or_action: e.target.value })}
                    placeholder="Escribe la pregunta o acción aquí..."
                    className="w-full font-bold text-sm px-3 py-2 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>

                <div>
                  <textarea
                    value={node.detail_text || ''}
                    onChange={(e) => handleUpdateNode(node.id, { detail_text: e.target.value })}
                    placeholder="Explicación adicional de apoyo al trabajador (opcional)..."
                    rows={2}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500 custom-scrollbar resize-none"
                  />
                </div>
              </div>

              {/* RAMAS DE CONEXIÓN SÍ / NO (SOLO PARA PREGUNTAS) */}
              {node.node_type === 'QUESTION' && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* RAMA SÍ (VERDE) */}
                  <div className="p-3.5 bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4 stroke-[3]" />
                        Si responde SÍ ➔
                      </span>
                    </div>

                    <select
                      value={node.yes_next_id || ''}
                      onChange={(e) => handleUpdateNode(node.id, { yes_next_id: e.target.value ? e.target.value : null })}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#0d1117] border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 truncate"
                    >
                      <option value="">-- Seleccionar Nodo de Destino --</option>
                      {nodes.filter(n => n.id !== node.id).map(n => (
                        <option key={n.id} value={n.id}>
                          {n.node_type === 'QUESTION' ? '❓' : '✅'} {n.question_or_action}
                        </option>
                      ))}
                    </select>

                    {!node.yes_next_id && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCreateAndLinkNode(node.id, 'YES', 'QUESTION')}
                          className="flex-1 py-1 px-2 text-[11px] font-bold bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white dark:text-emerald-400 rounded-lg transition-all border border-emerald-500/30 flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Nueva Pregunta
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreateAndLinkNode(node.id, 'YES', 'ACTION')}
                          className="flex-1 py-1 px-2 text-[11px] font-bold bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white dark:text-emerald-400 rounded-lg transition-all border border-emerald-500/30 flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Nueva Acción
                        </button>
                      </div>
                    )}
                  </div>

                  {/* RAMA NO (ROJO/ROSE) */}
                  <div className="p-3.5 bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <X className="w-4 h-4 stroke-[3]" />
                        Si responde NO ➔
                      </span>
                    </div>

                    <select
                      value={node.no_next_id || ''}
                      onChange={(e) => handleUpdateNode(node.id, { no_next_id: e.target.value ? e.target.value : null })}
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#0d1117] border border-rose-200 dark:border-rose-800/60 rounded-lg text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-rose-500 truncate"
                    >
                      <option value="">-- Seleccionar Nodo de Destino --</option>
                      {nodes.filter(n => n.id !== node.id).map(n => (
                        <option key={n.id} value={n.id}>
                          {n.node_type === 'QUESTION' ? '❓' : '✅'} {n.question_or_action}
                        </option>
                      ))}
                    </select>

                    {!node.no_next_id && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCreateAndLinkNode(node.id, 'NO', 'QUESTION')}
                          className="flex-1 py-1 px-2 text-[11px] font-bold bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white dark:text-rose-400 rounded-lg transition-all border border-rose-500/30 flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Nueva Pregunta
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreateAndLinkNode(node.id, 'NO', 'ACTION')}
                          className="flex-1 py-1 px-2 text-[11px] font-bold bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white dark:text-rose-400 rounded-lg transition-all border border-rose-500/30 flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Nueva Acción
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Pie de Nodo con Conectores */}
              {node.node_type === 'QUESTION' && (node.yes_next_id || node.no_next_id) && (
                <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-4 font-mono">
                  <span>🔗 Conexiones activas: {node.yes_next_id ? '✓ Sí vinculado' : '⚠️ Sí vacío'} | {node.no_next_id ? '✓ No vinculado' : '⚠️ No vacío'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
