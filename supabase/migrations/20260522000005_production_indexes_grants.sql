-- Phase 6: production indexes and RPC grants.

create index if not exists shipment_containers_shipment_idx
  on public.shipment_containers (shipment_id);

create index if not exists shipment_products_shipment_idx
  on public.shipment_products (shipment_id);

create index if not exists shipment_products_product_idx
  on public.shipment_products (product_id);

create index if not exists container_files_container_idx
  on public.container_files (container_id);

create index if not exists shipment_documents_shipment_idx
  on public.shipment_documents (shipment_id);

create index if not exists shipment_costs_shipment_idx
  on public.shipment_costs (shipment_id);

create index if not exists timeline_shipment_created_idx
  on public.shipment_timeline_events (shipment_id, created_at desc);

create index if not exists products_sku_trgm
  on public.products using gin (sku gin_trgm_ops);

create index if not exists suppliers_name_ar_trgm
  on public.suppliers using gin (name_ar gin_trgm_ops);

create index if not exists companies_name_ar_trgm
  on public.companies using gin (name_ar gin_trgm_ops);

grant execute on function public.auto_move_shipments_to_customs() to authenticated;
grant execute on function public.transition_shipment_status(uuid, text) to authenticated;
grant execute on function public.close_shipment_with_costs(uuid, numeric, numeric, numeric, numeric, numeric, text) to authenticated;
