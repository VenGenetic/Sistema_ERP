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
            <div className="p-2 rounded-2xl bg-primary border border-primary/30 text-primary shadow-sm">
              <BookOpen className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h1 className="text-2xl md:text-2xl font-bold text-fg tracking-tight">
              Proceso Operacional Estándar (POE)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-bold text-[11px] border border-primary/20">
              SOPs
            </span>
          </div>
          <p className="text-sm text-fg-muted mt-1 max-w-3xl">
            Organiza, clasifica por área y ejecuta las guías operativas de tu equipo. Crea listas de verificación o diagramas de flujo intuitivos con botones Sí/No.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingNewProcedureModal(true, 'A_LIST')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:from-primary hover:to-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/25 active:scale-95 transition-all text-sm group shrink-0"
        >
          <Plus className="w-5 h-5 stroke-[3] group-hover:rotate-90 transition-transform duration-300" />
          <span>Crear Nuevo SOP (POE)</span>
        </button>
      </div>

      {/* BARRA DE FILTRADO Y HERRAMIENTAS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-subtle rounded-2xl shadow-sm">
        
        {/* BUSCADOR */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
          <input
            type="text"
            placeholder="Buscar por título u objetivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-2 border border-subtle rounded-xl text-xs text-fg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-fg-muted hover:bg-danger hover:text-white transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* FILTRADO POR TIPO DE SOP */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="text-[11px] font-bold text-fg-subtle font-mono uppercase tracking-wider mr-1 hidden sm:inline-block">
            Tipo de Guía:
          </span>

          <button
            onClick={() => setSelectedSopTypeFilter('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${ selectedSopTypeFilter === 'ALL' ? 'bg-slate-900 text-white dark:bg-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800/60 text-fg-muted hover:bg-slate-200 dark:hover:bg-slate-800' }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Todos
          </button>

          <button
            onClick={() => setSelectedSopTypeFilter('A_LIST')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${ selectedSopTypeFilter === 'A_LIST' ? 'bg-primary text-white shadow-sm shadow-primary/25' : 'bg-slate-100 dark:bg-slate-800/60 text-primary hover:bg-primary-soft dark:hover:bg-primary/50' }`}
          >
            <ListCheck className="w-3.5 h-3.5" />
            Tipo A: Lista Rápida
          </button>

          <button
            onClick={() => setSelectedSopTypeFilter('B_DECISION')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${ selectedSopTypeFilter === 'B_DECISION' ? 'bg-primary text-white shadow-sm shadow-primary/25' : 'bg-slate-100 dark:bg-slate-800/60 text-primary hover:bg-primary-soft dark:hover:bg-primary/50' }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Tipo B: Flowchart Sí/No
          </button>

          {hasAnyFilter && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-danger hover:text-danger font-semibold hover:bg-danger-soft rounded-xl transition-all ml-2"
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
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-surface border border-subtle rounded-2xl text-fg-subtle">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
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
