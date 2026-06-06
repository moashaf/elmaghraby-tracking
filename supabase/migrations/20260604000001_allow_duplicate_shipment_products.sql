-- Allow the same product on multiple lines in one shipment (different qty/cartons/notes).
alter table public.shipment_products
  drop constraint if exists shipment_products_shipment_id_product_id_key;
