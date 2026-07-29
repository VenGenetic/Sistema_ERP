-- schema_print_queue.sql
-- Creates the print_queue_items table to store the print queue for each user in Supabase

CREATE TABLE IF NOT EXISTS public.print_queue_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id integer REFERENCES public.products(id) ON DELETE CASCADE,
    quantity integer NOT NULL CHECK (quantity > 0),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, product_id)
);

-- Enable RLS
ALTER TABLE public.print_queue_items ENABLE ROW LEVEL SECURITY;

-- Create Policies
DROP POLICY IF EXISTS "Users can view their own print queue items" ON public.print_queue_items;
CREATE POLICY "Users can view their own print queue items" 
ON public.print_queue_items FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own print queue items" ON public.print_queue_items;
CREATE POLICY "Users can insert their own print queue items" 
ON public.print_queue_items FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own print queue items" ON public.print_queue_items;
CREATE POLICY "Users can update their own print queue items" 
ON public.print_queue_items FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own print queue items" ON public.print_queue_items;
CREATE POLICY "Users can delete their own print queue items" 
ON public.print_queue_items FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS print_queue_items_user_id_idx ON public.print_queue_items(user_id);

-- Optional: update trigger for updated_at
CREATE OR REPLACE FUNCTION update_print_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_print_queue_updated_at ON public.print_queue_items;
CREATE TRIGGER trigger_update_print_queue_updated_at
BEFORE UPDATE ON public.print_queue_items
FOR EACH ROW
EXECUTE FUNCTION update_print_queue_updated_at();
