-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accounts (
  id integer NOT NULL DEFAULT nextval('accounts_id_seq'::regclass),
  code text UNIQUE,
  name text NOT NULL,
  category text,
  is_nominal boolean DEFAULT false,
  currency text DEFAULT 'USD'::text,
  position integer DEFAULT 0,
  CONSTRAINT accounts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.brands (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT brands_pkey PRIMARY KEY (id)
);
CREATE TABLE public.customers (
  id integer NOT NULL DEFAULT nextval('customers_id_seq'::regclass),
  identification_number text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  phone text,
  is_final_consumer boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inventory_levels (
  id integer NOT NULL DEFAULT nextval('inventory_levels_id_seq'::regclass),
  product_id integer,
  warehouse_id integer,
  current_stock integer DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_levels_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_levels_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT inventory_levels_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id)
);
CREATE TABLE public.inventory_logs (
  id integer NOT NULL DEFAULT nextval('inventory_logs_id_seq'::regclass),
  product_id integer,
  warehouse_id integer,
  quantity_change integer NOT NULL,
  reason text,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  reference_type character varying,
  reference_id character varying,
  CONSTRAINT inventory_logs_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT inventory_logs_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id),
  CONSTRAINT inventory_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.lost_demand (
  id integer NOT NULL DEFAULT nextval('lost_demand_id_seq'::regclass),
  search_term text NOT NULL,
  product_id integer,
  reason text CHECK (reason = ANY (ARRAY['out_of_stock'::text, 'not_in_catalog'::text])),
  channel text CHECK (channel = ANY (ARRAY['POS'::text, 'ONLINE'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  user_id uuid DEFAULT auth.uid(),
  CONSTRAINT lost_demand_pkey PRIMARY KEY (id),
  CONSTRAINT lost_demand_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT lost_demand_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.order_items (
  id integer NOT NULL DEFAULT nextval('order_items_id_seq'::regclass),
  order_id integer,
  product_id integer,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.orders (
  id integer NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
  partner_id integer,
  warehouse_id integer,
  status text DEFAULT 'pending'::text,
  total_amount numeric DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  customer_id integer,
  channel text CHECK (channel = ANY (ARRAY['POS'::text, 'ONLINE'::text])),
  payment_status text CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text])),
  created_by uuid,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id),
  CONSTRAINT orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id),
  CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.partners (
  id integer NOT NULL DEFAULT nextval('partners_id_seq'::regclass),
  name text NOT NULL,
  type text CHECK (type = ANY (ARRAY['supplier'::text, 'reseller'::text])),
  status text DEFAULT 'active'::text,
  CONSTRAINT partners_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_entries_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint,
  sku text,
  cost_without_vat numeric NOT NULL,
  discounted_cost numeric,
  discount_percentage numeric,
  vat_percentage numeric NOT NULL,
  final_cost_with_vat numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  CONSTRAINT product_entries_history_pkey PRIMARY KEY (id),
  CONSTRAINT product_entries_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_entries_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.products (
  id integer NOT NULL DEFAULT nextval('products_id_seq'::regclass),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text,
  min_stock_threshold integer DEFAULT 10,
  created_at timestamp with time zone DEFAULT now(),
  cost_without_vat numeric DEFAULT 0,
  vat_percentage numeric DEFAULT 12.0,
  strike_price_candidate numeric DEFAULT NULL::numeric,
  strike_count integer DEFAULT 0,
  profit_margin numeric DEFAULT 0.30,
  brand_id bigint,
  price numeric DEFAULT 0,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  email text,
  is_active boolean DEFAULT true,
  role_id integer,
  nickname text,
  bio text,
  avatar_url text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);
CREATE TABLE public.roles (
  id integer NOT NULL DEFAULT nextval('roles_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  permissions jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.system_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type character varying NOT NULL,
  payload jsonb NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'processed'::character varying, 'failed'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  processed_at timestamp with time zone,
  CONSTRAINT system_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transaction_lines (
  id integer NOT NULL DEFAULT nextval('transaction_lines_id_seq'::regclass),
  transaction_id integer,
  account_id integer,
  debit numeric DEFAULT 0.00,
  credit numeric DEFAULT 0.00,
  CONSTRAINT transaction_lines_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_lines_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT transaction_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.transactions (
  id integer NOT NULL DEFAULT nextval('transactions_id_seq'::regclass),
  order_id integer,
  reference_type text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.warehouses (
  id integer NOT NULL DEFAULT nextval('warehouses_id_seq'::regclass),
  name text NOT NULL,
  type text CHECK (type = ANY (ARRAY['physical'::text, 'digital_partner'::text])),
  location text,
  partner_id integer,
  is_active boolean DEFAULT true,
  CONSTRAINT warehouses_pkey PRIMARY KEY (id),
  CONSTRAINT warehouses_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id)
);