-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_embedding vector(512);

-- Create HNSW index for cosine distance similarity searches
CREATE INDEX IF NOT EXISTS products_image_embedding_hnsw_idx 
ON public.products 
USING hnsw (image_embedding vector_cosine_ops);

-- Create match function for RPC
CREATE OR REPLACE FUNCTION public.match_products_by_image (
  query_embedding vector(512),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id integer,
  sku text,
  name text,
  category text,
  price numeric,
  image_url text,
  similarity float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.sku,
    p.name,
    p.category,
    p.price,
    p.image_url,
    1 - (p.image_embedding <=> query_embedding) AS similarity
  FROM public.products p
  WHERE p.is_active = true
    AND p.image_embedding IS NOT NULL
    AND 1 - (p.image_embedding <=> query_embedding) > match_threshold
  ORDER BY p.image_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
