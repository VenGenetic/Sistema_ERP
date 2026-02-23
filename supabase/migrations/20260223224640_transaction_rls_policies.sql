-- Paso A: Función de validación de permisos
CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSON;
BEGIN
  -- Obtener los permisos del rol asociado al perfil del usuario autenticado
  SELECT r.permissions INTO user_permissions
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = auth.uid();

  -- Verificar si el permiso existe y es verdadero dentro del JSON
  -- Se asume una estructura plana: {"can_view_finance": true, "can_edit_finance": true}
  RETURN COALESCE((user_permissions->>required_permission)::BOOLEAN, FALSE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso B: Aplicar RLS a la tabla transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Remove previous permissive policies
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.transactions;

DROP POLICY IF EXISTS "Solo usuarios con permisos financieros pueden ver transacciones" ON public.transactions;
CREATE POLICY "Solo usuarios con permisos financieros pueden ver transacciones"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.has_permission('can_view_finance') = true
);

DROP POLICY IF EXISTS "Solo usuarios con permisos de edición financiera pueden crear transacciones" ON public.transactions;
CREATE POLICY "Solo usuarios con permisos de edición financiera pueden crear transacciones"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission('can_edit_finance') = true
);

-- UPDATE y DELETE en transactions
DROP POLICY IF EXISTS "Solo usuarios con permisos de edición financiera pueden actualizar transacciones" ON public.transactions;
CREATE POLICY "Solo usuarios con permisos de edición financiera pueden actualizar transacciones"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  public.has_permission('can_edit_finance') = true
)
WITH CHECK (
  public.has_permission('can_edit_finance') = true
);

DROP POLICY IF EXISTS "Solo usuarios con permisos de edición financiera pueden eliminar transacciones" ON public.transactions;
CREATE POLICY "Solo usuarios con permisos de edición financiera pueden eliminar transacciones"
ON public.transactions
FOR DELETE
TO authenticated
USING (
  public.has_permission('can_edit_finance') = true
);

-- Paso C: Aplicar RLS a la tabla transaction_lines
ALTER TABLE public.transaction_lines ENABLE ROW LEVEL SECURITY;

-- Remove previous permissive policies
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.transaction_lines;

DROP POLICY IF EXISTS "Solo usuarios con permisos financieros pueden ver lineas de transaccion" ON public.transaction_lines;
CREATE POLICY "Solo usuarios con permisos financieros pueden ver lineas de transaccion"
ON public.transaction_lines
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_lines.transaction_id
  )
);

DROP POLICY IF EXISTS "Solo usuarios con permisos de edición financiera pueden crear lineas de transaccion" ON public.transaction_lines;
CREATE POLICY "Solo usuarios con permisos de edición financiera pueden crear lineas de transaccion"
ON public.transaction_lines
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_lines.transaction_id
  )
);

DROP POLICY IF EXISTS "Solo usuarios con permisos de edición financiera pueden actualizar lineas de transaccion" ON public.transaction_lines;
CREATE POLICY "Solo usuarios con permisos de edición financiera pueden actualizar lineas de transaccion"
ON public.transaction_lines
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_lines.transaction_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_lines.transaction_id
  )
);

DROP POLICY IF EXISTS "Solo usuarios con permisos de edición financiera pueden eliminar lineas de transaccion" ON public.transaction_lines;
CREATE POLICY "Solo usuarios con permisos de edición financiera pueden eliminar lineas de transaccion"
ON public.transaction_lines
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_lines.transaction_id
  )
);
