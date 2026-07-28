import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../supabaseClient';
import { 
  POEProcedure, 
  POEColumn, 
  POETag, 
  POEColumnType, 
  SOPType, 
  DEFAULT_TAG_COLORS 
} from '../types/poe';

interface POEStoreState {
  procedures: POEProcedure[];
  columns: POEColumn[];
  tags: POETag[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedSopTypeFilter: SOPType | 'ALL';
  sortColumnId: string;
  sortDirection: 'asc' | 'desc';
  activeSidePeekColumnId: string | null;
  columnFilters: Record<string, any>;
  selectedProcedureForModal: POEProcedure | null;
  isCreatingNewProcedureModal: boolean;
  newProcedureTypePreset: SOPType;

  // Actions
  fetchPOEData: () => Promise<void>;
  createProcedure: (title: string, sop_type: SOPType, description?: string) => Promise<POEProcedure | null>;
  updateProcedure: (id: string, updates: Partial<POEProcedure>) => Promise<void>;
  deleteProcedure: (id: string) => Promise<void>;
  updateCellCustomValue: (procedureId: string, columnId: string, value: any) => Promise<void>;

  createColumn: (name: string, type: POEColumnType) => Promise<POEColumn | null>;
  updateColumn: (id: string, updates: Partial<POEColumn>) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;

  createTag: (column_id: string, name: string, color?: string) => Promise<POETag | null>;
  updateTag: (id: string, updates: Partial<POETag>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;

  setSearchQuery: (query: string) => void;
  setSelectedSopTypeFilter: (filter: SOPType | 'ALL') => void;
  setSort: (columnId: string, direction?: 'asc' | 'desc') => void;
  setActiveSidePeekColumnId: (columnId: string | null) => void;
  setColumnFilter: (columnId: string, value: any) => void;
  clearAllFilters: () => void;
  setSelectedProcedureForModal: (proc: POEProcedure | null) => void;
  setIsCreatingNewProcedureModal: (isOpen: boolean, presetType?: SOPType) => void;
}

const DEFAULT_LOCAL_COLUMNS: POEColumn[] = [
  { id: 'col-area', name: 'Área', type: 'single_select', order_index: 0, width: 180, is_system: true },
  { id: 'col-roles', name: 'Etiquetas / Roles', type: 'multi_select', order_index: 1, width: 240, is_system: false },
  { id: 'col-estado', name: 'Estado Operativo', type: 'single_select', order_index: 2, width: 160, is_system: false },
];

const DEFAULT_LOCAL_TAGS: POETag[] = [
  { id: 'tag-almacen', column_id: 'col-area', name: 'Almacén y Logística', color: '#3B82F6', order_index: 0 },
  { id: 'tag-ventas', column_id: 'col-area', name: 'Ventas y Mostrador', color: '#10B981', order_index: 1 },
  { id: 'tag-admin', column_id: 'col-area', name: 'Administración y Finanzas', color: '#8B5CF6', order_index: 2 },
  { id: 'tag-supervisor', column_id: 'col-roles', name: 'Supervisor', color: '#F59E0B', order_index: 0 },
  { id: 'tag-operario', column_id: 'col-roles', name: 'Operario', color: '#06B6D4', order_index: 1 },
  { id: 'tag-activo', column_id: 'col-estado', name: 'Vigente', color: '#10B981', order_index: 0 },
  { id: 'tag-revision', column_id: 'col-estado', name: 'En Revisión', color: '#F97316', order_index: 1 }
];

export const usePOEStore = create<POEStoreState>()(
  persist(
    (set, get) => ({
      procedures: [],
      columns: DEFAULT_LOCAL_COLUMNS,
      tags: DEFAULT_LOCAL_TAGS,
      loading: false,
      error: null,
      searchQuery: '',
      selectedSopTypeFilter: 'ALL',
      sortColumnId: 'title',
      sortDirection: 'asc',
      activeSidePeekColumnId: null,
      columnFilters: {},
      selectedProcedureForModal: null,
      isCreatingNewProcedureModal: false,
      newProcedureTypePreset: 'A_LIST',

      fetchPOEData: async () => {
        set({ loading: true, error: null });
        try {
          const { data: colsData, error: colsErr } = await supabase
            .from('poe_columns')
            .select('*')
            .order('order_index', { ascending: true });

          if (colsErr) {
            // Any Supabase error (table missing, network, etc.) -> keep existing persisted state
            console.warn("[POE]: Supabase unavailable, keeping local persisted data.", colsErr.message);
            set({ loading: false });
            return;
          }

          const { data: tagsData } = await supabase
            .from('poe_tags')
            .select('*')
            .order('order_index', { ascending: true });

          const { data: procsData } = await supabase
            .from('poe_procedures')
            .select('*')
            .order('updated_at', { ascending: false });

          // Only update from Supabase if it actually has data OR if we have no local data
          const currentProcs = get().procedures;
          set({
            columns: (colsData && colsData.length > 0) ? colsData : get().columns,
            tags: (tagsData && tagsData.length > 0) ? tagsData : get().tags,
            // If Supabase has procedures, use them. If empty but we have local ones, keep local
            procedures: (procsData && procsData.length > 0) 
              ? procsData 
              : (currentProcs.length > 0 ? currentProcs : []),
            loading: false
          });
        } catch (e: any) {
          console.warn("[POE]: Network error, keeping local persisted data.", e?.message);
          set({ loading: false });
        }
      },

      createProcedure: async (title, sop_type, description = '') => {
        const defaultContent = sop_type === 'A_LIST'
          ? [{ id: crypto.randomUUID(), title: 'Paso inicial 1: Verificar requerimientos', order_index: 0 }]
          : [{ id: crypto.randomUUID(), node_type: 'QUESTION', question_or_action: '¿Se cumplen las condiciones básicas del proceso?', yes_next_id: null, no_next_id: null, color_tag: 'blue' }];

        const newProc: Omit<POEProcedure, 'id'> = {
          title: title || 'Nuevo Procedimiento Estándar (SOP)',
          description,
          sop_type,
          content_json: defaultContent as any,
          custom_values: {},
          status: 'active',
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        try {
          const { data, error } = await supabase
            .from('poe_procedures')
            .insert(newProc)
            .select()
            .single();

          if (error || !data) {
            // Supabase unavailable → save locally with a local ID
            const localProc = { ...newProc, id: crypto.randomUUID() } as POEProcedure;
            set(state => ({ procedures: [localProc, ...state.procedures] }));
            return localProc;
          }

          set(state => ({ procedures: [data, ...state.procedures] }));
          return data;
        } catch (e) {
          const localProc = { ...newProc, id: crypto.randomUUID() } as POEProcedure;
          set(state => ({ procedures: [localProc, ...state.procedures] }));
          return localProc;
        }
      },

      updateProcedure: async (id, updates) => {
        const payload = { ...updates, updated_at: new Date().toISOString() };

        // Optimistic update — persisted immediately by zustand/persist
        set(state => ({
          procedures: state.procedures.map(p => p.id === id ? { ...p, ...payload } : p),
          selectedProcedureForModal: state.selectedProcedureForModal?.id === id
            ? { ...state.selectedProcedureForModal, ...payload }
            : state.selectedProcedureForModal
        }));

        try {
          await supabase.from('poe_procedures').update(payload).eq('id', id);
        } catch (e) {
          console.warn("Supabase update failed, changes saved locally.", e);
        }
      },

      deleteProcedure: async (id) => {
        set(state => ({
          procedures: state.procedures.filter(p => p.id !== id),
          selectedProcedureForModal: state.selectedProcedureForModal?.id === id ? null : state.selectedProcedureForModal
        }));

        try {
          await supabase.from('poe_procedures').delete().eq('id', id);
        } catch (e) {
          console.warn("Supabase delete failed, removed locally.", e);
        }
      },

      updateCellCustomValue: async (procedureId, columnId, value) => {
        const proc = get().procedures.find(p => p.id === procedureId);
        if (!proc) return;
        const newCustomValues = { ...(proc.custom_values || {}), [columnId]: value };
        await get().updateProcedure(procedureId, { custom_values: newCustomValues });
      },

      createColumn: async (name, type) => {
        const columns = get().columns;
        const newCol: Omit<POEColumn, 'id'> = {
          name: name || 'Nueva Columna',
          type,
          order_index: columns.length,
          width: type === 'text' ? 220 : 180,
          is_system: false,
          created_at: new Date().toISOString()
        };

        try {
          const { data, error } = await supabase.from('poe_columns').insert(newCol).select().single();
          if (error || !data) {
            const localCol = { ...newCol, id: `col-${Date.now()}` } as POEColumn;
            set(state => ({ columns: [...state.columns, localCol] }));
            return localCol;
          }
          set(state => ({ columns: [...state.columns, data] }));
          return data;
        } catch (e) {
          const localCol = { ...newCol, id: `col-${Date.now()}` } as POEColumn;
          set(state => ({ columns: [...state.columns, localCol] }));
          return localCol;
        }
      },

      updateColumn: async (id, updates) => {
        set(state => ({ columns: state.columns.map(c => c.id === id ? { ...c, ...updates } : c) }));
        try { await supabase.from('poe_columns').update(updates).eq('id', id); } catch (e) {}
      },

      deleteColumn: async (id) => {
        set(state => ({
          columns: state.columns.filter(c => c.id !== id),
          tags: state.tags.filter(t => t.column_id !== id),
          activeSidePeekColumnId: state.activeSidePeekColumnId === id ? null : state.activeSidePeekColumnId
        }));
        try { await supabase.from('poe_columns').delete().eq('id', id); } catch (e) {}
      },

      createTag: async (column_id, name, color) => {
        const existingTags = get().tags.filter(t => t.column_id === column_id);
        const assignedColor = color || DEFAULT_TAG_COLORS[existingTags.length % DEFAULT_TAG_COLORS.length];
        const newTag: Omit<POETag, 'id'> = {
          column_id, name, color: assignedColor,
          order_index: existingTags.length,
          created_at: new Date().toISOString()
        };

        try {
          const { data, error } = await supabase.from('poe_tags').insert(newTag).select().single();
          if (error || !data) {
            const localTag = { ...newTag, id: `tag-${Date.now()}` } as POETag;
            set(state => ({ tags: [...state.tags, localTag] }));
            return localTag;
          }
          set(state => ({ tags: [...state.tags, data] }));
          return data;
        } catch (e) {
          const localTag = { ...newTag, id: `tag-${Date.now()}` } as POETag;
          set(state => ({ tags: [...state.tags, localTag] }));
          return localTag;
        }
      },

      updateTag: async (id, updates) => {
        set(state => ({ tags: state.tags.map(t => t.id === id ? { ...t, ...updates } : t) }));
        try { await supabase.from('poe_tags').update(updates).eq('id', id); } catch (e) {}
      },

      deleteTag: async (id) => {
        set(state => ({ tags: state.tags.filter(t => t.id !== id) }));
        try { await supabase.from('poe_tags').delete().eq('id', id); } catch (e) {}
      },

      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedSopTypeFilter: (filter) => set({ selectedSopTypeFilter: filter }),
      setSort: (columnId, direction) => {
        const { sortColumnId, sortDirection } = get();
        let nextDir = direction;
        if (!nextDir) {
          nextDir = sortColumnId === columnId
            ? (sortDirection === 'asc' ? 'desc' : 'asc')
            : 'asc';
        }
        set({ sortColumnId: columnId, sortDirection: nextDir });
      },
      setActiveSidePeekColumnId: (columnId) => set({ activeSidePeekColumnId: columnId }),
      setColumnFilter: (columnId, value) => set(state => {
        const nextFilters = { ...state.columnFilters };
        if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
          delete nextFilters[columnId];
        } else {
          nextFilters[columnId] = value;
        }
        return { columnFilters: nextFilters };
      }),
      clearAllFilters: () => set({ columnFilters: {}, selectedSopTypeFilter: 'ALL', searchQuery: '' }),
      setSelectedProcedureForModal: (proc) => set({ selectedProcedureForModal: proc }),
      setIsCreatingNewProcedureModal: (isOpen, presetType = 'A_LIST') => set({
        isCreatingNewProcedureModal: isOpen,
        newProcedureTypePreset: presetType
      })
    }),
    {
      name: 'poe-store-v1', // localStorage key
      storage: createJSONStorage(() => localStorage),
      // Only persist the data that must survive page refreshes
      partialize: (state) => ({
        procedures: state.procedures,
        columns: state.columns,
        tags: state.tags,
      }),
    }
  )
);
