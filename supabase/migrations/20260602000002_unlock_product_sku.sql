-- Allow manual SKU updates (no schema changes).
-- Keep auto-generation on INSERT when sku is blank.

drop trigger if exists products_lock_sku on public.products;
drop function if exists public.lock_product_sku();

