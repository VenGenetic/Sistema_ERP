import { create } from 'zustand';
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

// Helper functions for offline localStorage cache fallback
const loadLocalData = () => {
  try {
    const cols = localStorage.getItem('poe_local_columns');
    const tags = localStorage.getItem('poe_local_tags');
    const procs = localStorage.getItem('poe_local_procedures');
    return {
      columns: cols ? JSON.parse(cols) : null,
      tags: tags ? JSON.parse(tags) : null,
      procedures: procs ? JSON.parse(procs) : null
    };
  } catch (e) {
    console.error("Error loading POE local data:", e);
    return { columns: null, tags: null, procedures: null };
  }
};

const saveLocalData = (key: 'columns' | 'tags' | 'procedures', data: any) => {
  try {
    localStorage.setItem(`poe_local_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving POE local ${key}:`, e);
  }
};

export const usePOEStore = create<POEStoreState>((set, get) => ({
  procedures: [],
  columns: [],
  tags: [],
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
      // 1. Obtener columnas
      const { data: colsData, error: colsErr } = await supabase
        .from('poe_columns')
        .select('*')
        .order('order_index', { ascending: true });

      if (colsErr && colsErr.code === '42P01') {
        // La tabla aún no existe en Supabase -> usamos localStorage fallback
        console.warn("[POE Module]: Tablas POE aún no creadas en Supabase. Cargando datos desde localStorage.");
        const local = loadLocalData();
        set({
          columns: local.columns || DEFAULT_LOCAL_COLUMNS,
          tags: local.tags || DEFAULT_LOCAL_TAGS,
          procedures: local.procedures || [],
          loading: false
        });
        return;
      }

      // 2. Obtener tags
      const { data: tagsData } = await supabase
        .from('poe_tags')
        .select('*')
        .order('order_index', { ascending: true });

      // 3. Obtener procedimientos
      const { data: procsData } = await supabase
        .from('poe_procedures')
        .select('*')
        .order('updated_at', { ascending: false });

      set({
        columns: colsData || DEFAULT_LOCAL_COLUMNS,
        tags: tagsData || DEFAULT_LOCAL_TAGS,
        procedures: procsData || [],
        loading: false
      });
    } catch (e: any) {
      console.warn("[POE Module]: Error conectando a base de datos. Cargando datos de respaldo local.", e);
      const local = loadLocalData();
      set({
        columns: local.columns || DEFAULT_LOCAL_COLUMNS,
        tags: local.tags || DEFAULT_LOCAL_TAGS,
        procedures: local.procedures || [],
        loading: false
      });
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

      if (error) {
        // Fallback local
        const localId = crypto.randomUUID();
        const localProc = { ...newProc, id: localId } as POEProcedure;
        set(state => {
          const nextProcs = [localProc, ...state.procedures];
          saveLocalData('procedures', nextProcs);
          return { procedures: nextProcs };
        });
        return localProc;
      }

      if (data) {
        set(state => {
          const nextProcs = [data, ...state.procedures];
          saveLocalData('procedures', nextProcs); // Sync local storage also
          return { procedures: nextProcs };
        });
        return data;
      }
    } catch (e) {
      const localProc = { ...newProc, id: crypto.randomUUID() } as POEProcedure;
      set(state => {
        const nextProcs = [localProc, ...state.procedures];
        saveLocalData('procedures', nextProcs);
        return { procedures: nextProcs };
      });
      return localProc;
    }
    return null;
  },

  updateProcedure: async (id, updates) => {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    
    // Optimistic update
    set(state => {
      const nextProcs = state.procedures.map(p => p.id === id ? { ...p, ...payload } : p);
      saveLocalData('procedures', nextProcs);
      return {
        procedures: nextProcs,
        selectedProcedureForModal: state.selectedProcedureForModal?.id === id 
          ? { ...state.selectedProcedureForModal, ...payload } 
          : state.selectedProcedureForModal
      };
    });

    try {
      await supabase
        .from('poe_procedures')
        .update(payload)
        .eq('id', id);
    } catch (e) {
      console.error("Error al actualizar procedimiento en Supabase:", e);
    }
  },

  deleteProcedure: async (id) => {
    set(state => {
      const nextProcs = state.procedures.filter(p => p.id !== id);
      saveLocalData('procedures', nextProcs);
      return {
        procedures: nextProcs,
        selectedProcedureForModal: state.selectedProcedureForModal?.id === id ? null : state.selectedProcedureForModal
      };
    });

    try {
      await supabase.from('poe_procedures').delete().eq('id', id);
    } catch (e) {
      console.error("Error al eliminar procedimiento:", e);
    }
  },

  updateCellCustomValue: async (procedureId, columnId, value) => {
    const proc = get().procedures.find(p => p.id === procedureId);
    if (!proc) return;

    const newCustomValues = {
      ...(proc.custom_values || {}),
      [columnId]: value
    };

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
      const { data, error } = await supabase
        .from('poe_columns')
        .insert(newCol)
        .select()
        .single();

      if (error) {
        const localCol = { ...newCol, id: `col-${Date.now()}` } as POEColumn;
        set(state => {
          const nextCols = [...state.columns, localCol];
          saveLocalData('columns', nextCols);
          return { columns: nextCols };
        });
        return localCol;
      }

      if (data) {
        set(state => {
          const nextCols = [...state.columns, data];
          saveLocalData('columns', nextCols);
          return { columns: nextCols };
        });
        return data;
      }
    } catch (e) {
      const localCol = { ...newCol, id: `col-${Date.now()}` } as POEColumn;
      set(state => {
        const nextCols = [...state.columns, localCol];
        saveLocalData('columns', nextCols);
        return { columns: nextCols };
      });
      return localCol;
    }
    return null;
  },

  updateColumn: async (id, updates) => {
    set(state => {
      const nextCols = state.columns.map(c => c.id === id ? { ...c, ...updates } : c);
      saveLocalData('columns', nextCols);
      return { columns: nextCols };
    });

    try {
      await supabase.from('poe_columns').update(updates).eq('id', id);
    } catch (e) {
      console.error("Error al actualizar columna en Supabase:", e);
    }
  },

  deleteColumn: async (id) => {
    set(state => {
      const nextCols = state.columns.filter(c => c.id !== id);
      const nextTags = state.tags.filter(t => t.column_id !== id);
      saveLocalData('columns', nextCols);
      saveLocalData('tags', nextTags);
      return {
        columns: nextCols,
        tags: nextTags,
        activeSidePeekColumnId: state.activeSidePeekColumnId === id ? null : state.activeSidePeekColumnId
      };
    });

    try {
      await supabase.from('poe_columns').delete().eq('id', id);
    } catch (e) {
      console.error("Error al eliminar columna en Supabase:", e);
    }
  },

  createTag: async (column_id, name, color) => {
    const existingTags = get().tags.filter(t => t.column_id === column_id);
    const assignedColor = color || DEFAULT_TAG_COLORS[existingTags.length % DEFAULT_TAG_COLORS.length];
    
    const newTag: Omit<POETag, 'id'> = {
      column_id,
      name,
      color: assignedColor,
      order_index: existingTags.length,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('poe_tags')
        .insert(newTag)
        .select()
        .single();

      if (error) {
        const localTag = { ...newTag, id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` } as POETag;
        set(state => {
          const nextTags = [...state.tags, localTag];
          saveLocalData('tags', nextTags);
          return { tags: nextTags };
        });
        return localTag;
      }

      if (data) {
        set(state => {
          const nextTags = [...state.tags, data];
          saveLocalData('tags', nextTags);
          return { tags: nextTags };
        });
        return data;
      }
    } catch (e) {
      const localTag = { ...newTag, id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` } as POETag;
      set(state => {
        const nextTags = [...state.tags, localTag];
        saveLocalData('tags', nextTags);
        return { tags: nextTags };
      });
      return localTag;
    }
    return null;
  },

  updateTag: async (id, updates) => {
    set(state => {
      const nextTags = state.tags.map(t => t.id === id ? { ...t, ...updates } : t);
      saveLocalData('tags', nextTags);
      return { tags: nextTags };
    });

    try {
      await supabase.from('poe_tags').update(updates).eq('id', id);
    } catch (e) {
      console.error("Error updating tag:", e);
    }
  },

  deleteTag: async (id) => {
    set(state => {
      const nextTags = state.tags.filter(t => t.id !== id);
      saveLocalData('tags', nextTags);
      return { tags: nextTags };
    });

    try {
      await supabase.from('poe_tags').delete().eq('id', id);
    } catch (e) {
      console.error("Error deleting tag:", e);
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedSopTypeFilter: (filter) => set({ selectedSopTypeFilter: filter }),
  setSort: (columnId, direction) => {
    const currentSort = get().sortColumnId;
    const currentDir = get().sortDirection;
    let nextDir = direction;
    if (!nextDir) {
      if (currentSort === columnId) {
        nextDir = currentDir === 'asc' ? 'desc' : 'asc';
      } else {
        nextDir = 'asc';
      }
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
}));
