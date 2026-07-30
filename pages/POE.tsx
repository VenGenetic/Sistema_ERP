import React, { useEffect } from 'react';
import { usePOEStore } from '../store/usePOEStore';
import { useShallow } from 'zustand/react/shallow';
import { POETable } from '../components/poe/POETable';
import { SidePeekConsole } from '../components/poe/SidePeekConsole';
import { POEModal } from '../components/poe/POEModal';
import { SOPType } from '../types/poe';
import { 
  Sparkles, 
  Search, 
  Plus, 
  ListCheck, 
  GitBranch, 
  Layers, 
  Filter, 
  RotateCcw, 
  HelpCircle,
  BookOpen
} from 'lucide-react';

const POE: React.FC = () => {
  const {
    fetchPOEData,
    loading,
    searchQuery,
    setSearchQuery,
    selectedSopTypeFilter,
    setSelectedSopTypeFilter,
    clearAllFilters,
    columnFilters,
    setIsCreatingNewProcedureModal
  } = usePOEStore(
    useShallow((state) => ({
      fetchPOEData: state.fetchPOEData,
      loading: state.loading,
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      selectedSopTypeFilter: state.selectedSopTypeFilter,
      setSelectedSopTypeFilter: state.setSelectedSopTypeFilter,
      clearAllFilters: state.clearAllFilters,
      columnFilters: state.columnFilters,
      setIsCreatingNewProcedureModal: state.setIsCreatingNewProcedureModal,
    }))
  );

  useEffect(() => {
    fetchPOEData();
  }, []);

  const hasAnyFilter = searchQuery.trim() !== '' || selectedSopTypeFilter !== 'ALL' || Object.keys(columnFilters).length > 0;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1700px] mx-auto flex flex-col gap-6 min-h-[calc(100vh-64px)]">
      
      {/* CABECERA DEL MÓDULO POE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 border border-blue-500/30 text-blue-500 dark:text-blue-400 shadow-sm">
              <BookOpen className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Proceso Operacional Estándar (POE)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-extrabold text-[11px] border border-blue-500/20">
              SOPs
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Organiza, clasifica por área y ejecuta las guías operativas de tu equipo. Crea listas de verificación o diagramas de flujo intuitivos con botones Sí/No.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingNewProcedureModal(true, 'A_LIST')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-500/25 active:scale-95 transition-all text-sm group shrink-0"
        >
          <Plus className="w-5 h-5 stroke-[3] group-hover:rotate-90 transition-transform duration-300" />
          <span>Crear Nuevo SOP (POE)</span>
        </button>
      </div>

      {/* BARRA DE FILTRADO Y HERRAMIENTAS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#111720] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        
        {/* BUSCADOR */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título u objetivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0c1117] border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* FILTRADO POR TIPO DE SOP */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider mr-1 hidden sm:inline-block">
            Tipo de Guía:
          </span>

          <button
            onClick={() => setSelectedSopTypeFilter('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedSopTypeFilter === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Todos
          </button>

          <button
            onClick={() => setSelectedSopTypeFilter('A_LIST')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedSopTypeFilter === 'A_LIST'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                : 'bg-slate-100 dark:bg-slate-800/60 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50'
            }`}
          >
            <ListCheck className="w-3.5 h-3.5" />
            Tipo A: Lista Rápida
          </button>

          <button
            onClick={() => setSelectedSopTypeFilter('B_DECISION')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedSopTypeFilter === 'B_DECISION'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
                : 'bg-slate-100 dark:bg-slate-800/60 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Tipo B: Flowchart Sí/No
          </button>

          {hasAnyFilter && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-500 hover:text-rose-600 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all ml-2"
              title="Restablecer todos los filtros y búsquedas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resetear filtros
            </button>
          )}
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL CON SIDE PEEK DESLIZABLE */}
      <div className="flex-1 flex gap-4 overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white dark:bg-[#0c1117] border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-semibold">Cargando estándares y procedimientos...</p>
          </div>
        ) : (
          <POETable />
        )}

        {/* CONSOLA DE EDICIÓN EN SIDE PEEK (PANEL LATERAL INTERACTIVO) */}
        <SidePeekConsole />
      </div>

      {/* MODAL / DRAWER PARA EDICIÓN Y DIAGNÓSTICO DE SOPS */}
      <POEModal />
    </div>
  );
};

export default POE;
