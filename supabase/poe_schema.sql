-- =================================================================
-- MÓDULO POE (PROCESO OPERACIONAL ESTÁNDAR / SOPs)
-- Script de Migración SQL para Supabase
-- =================================================================

-- 1. Tabla de Columnas Dinámicas para la tabla POE
CREATE TABLE IF NOT EXISTS public.poe_columns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('text', 'single_select', 'multi_select', 'date', 'status', 'number')),
    order_index integer NOT NULL DEFAULT 0,
    width integer NOT NULL DEFAULT 200,
    is_system boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Tabla de Etiquetas (Tags) pertenecientes a columnas tag (single_select o multi_select)
-- Al cambiar nombre o color de un tag en esta tabla, todo el sistema actualiza inmediatamente sus vistas
CREATE TABLE IF NOT EXISTS public.poe_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id uuid NOT NULL REFERENCES public.poe_columns(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL DEFAULT '#3B82F6',
    order_index integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Tabla Principal de Procedimientos Operacionales Estándar (POEs / SOPs)
CREATE TABLE IF NOT EXISTS public.poe_procedures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL DEFAULT '',
    description text DEFAULT '',
    sop_type text NOT NULL CHECK (sop_type IN ('A_LIST', 'B_DECISION')),
    content_json jsonb NOT NULL DEFAULT '[]'::jsonb, -- Estructura de pasos (Tipo A) o Árbol de decisiones (Tipo B)
    custom_values jsonb NOT NULL DEFAULT '{}'::jsonb, -- Mapeo dinámico: column_id -> valor texto o array de tag_ids
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Índices para optimizar búsquedas y filtrados
CREATE INDEX IF NOT EXISTS idx_poe_tags_column_id ON public.poe_tags(column_id);
CREATE INDEX IF NOT EXISTS idx_poe_procedures_sop_type ON public.poe_procedures(sop_type);
CREATE INDEX IF NOT EXISTS idx_poe_procedures_updated_at ON public.poe_procedures(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_poe_procedures_custom_values ON public.poe_procedures USING gin (custom_values);

-- Habilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE public.poe_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poe_procedures ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para que todos los usuarios autenticados tengan acceso completo (CRUD) por ahora
DROP POLICY IF EXISTS "Full access to poe_columns for authenticated users" ON public.poe_columns;
CREATE POLICY "Full access to poe_columns for authenticated users"
    ON public.poe_columns FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access to poe_tags for authenticated users" ON public.poe_tags;
CREATE POLICY "Full access to poe_tags for authenticated users"
    ON public.poe_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access to poe_procedures for authenticated users" ON public.poe_procedures;
CREATE POLICY "Full access to poe_procedures for authenticated users"
    ON public.poe_procedures FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insertar Columna Inicial por Defecto: "Área" (Objeto tag tipo selección única) y "Roles involucrados" (Lista tipo selección múltiple)
INSERT INTO public.poe_columns (name, type, order_index, width, is_system)
SELECT 'Área', 'single_select', 0, 180, true
WHERE NOT EXISTS (SELECT 1 FROM public.poe_columns WHERE name = 'Área');

INSERT INTO public.poe_columns (name, type, order_index, width, is_system)
SELECT 'Etiquetas / Roles', 'multi_select', 1, 240, false
WHERE NOT EXISTS (SELECT 1 FROM public.poe_columns WHERE name = 'Etiquetas / Roles');
