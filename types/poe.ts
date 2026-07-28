// Core Types for Proceso Operacional Estándar (POE / SOPs)

export type POEColumnType = 'text' | 'single_select' | 'multi_select' | 'date' | 'status' | 'number';

export type SOPType = 'A_LIST' | 'B_DECISION';

export interface POETag {
  id: string;
  column_id: string;
  name: string;
  color: string;
  order_index: number;
  created_at?: string;
}

export interface POEColumn {
  id: string;
  name: string;
  type: POEColumnType;
  order_index: number;
  width: number;
  is_system: boolean;
  created_at?: string;
}

// Tipo A: Lista / Checklist Step
export interface SOPListStep {
  id: string;
  title: string;
  description?: string;
  order_index: number;
  is_completed?: boolean; // Usado temporalmente o en tiempo de ejecución de guía
  role_tag?: string;      // Opcional etiqueta de rol para el paso
}

// Tipo B: Flowchart / Decisión Sí o No Node
export type SOPNodeType = 'QUESTION' | 'ACTION';

export interface SOPDecisionNode {
  id: string;
  node_type: SOPNodeType;
  question_or_action: string;
  detail_text?: string;
  yes_next_id?: string | null; // ID del nodo al responder SÍ (solo si node_type === 'QUESTION')
  no_next_id?: string | null;  // ID del nodo al responder NO (solo si node_type === 'QUESTION')
  color_tag?: string;          // Color visual para la tarjeta: 'blue' | 'emerald' | 'rose' | 'amber' | 'purple'
}

export interface POEProcedure {
  id: string;
  title: string;
  description?: string;
  sop_type: SOPType;
  content_json: SOPListStep[] | SOPDecisionNode[];
  custom_values: Record<string, any>; // Mappeo de column_id -> string (id de tag o texto) ó string[] (ids de tags)
  status: 'active' | 'draft' | 'archived';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_TAG_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#64748B', // Slate
  '#1E293B'  // Dark
];
