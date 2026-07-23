CREATE TABLE public.inventory_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  warehouse_id integer,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  last_counted_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT inventory_groups_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_groups_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id),
  CONSTRAINT inventory_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

CREATE TABLE public.inventory_group_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  product_id integer NOT NULL,
  counted_stock integer DEFAULT 0,
  is_manually_added boolean DEFAULT false,
  CONSTRAINT inventory_group_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_group_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.inventory_groups(id) ON DELETE CASCADE,
  CONSTRAINT inventory_group_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- RLS policies for the new tables
ALTER TABLE public.inventory_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_group_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read inventory groups" ON public.inventory_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert inventory groups" ON public.inventory_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update inventory groups" ON public.inventory_groups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete inventory groups" ON public.inventory_groups FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read inventory group items" ON public.inventory_group_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert inventory group items" ON public.inventory_group_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update inventory group items" ON public.inventory_group_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete inventory group items" ON public.inventory_group_items FOR DELETE TO authenticated USING (true);
