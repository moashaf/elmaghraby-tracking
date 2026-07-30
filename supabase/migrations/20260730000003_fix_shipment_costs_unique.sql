-- Fix close_shipment_with_costs ON CONFLICT: ensure unique shipment_id on shipment_costs.
-- Also safe if line_items / certificate migrations were partially applied.

alter table public.shipment_costs
  add column if not exists line_items jsonb not null default '{}'::jsonb;

alter table public.shipments
  add column if not exists customs_certificate_number text;

-- Remove duplicate cost rows (keep newest) so unique index can be created.
delete from public.shipment_costs sc
using public.shipment_costs newer
where sc.shipment_id = newer.shipment_id
  and sc.updated_at < newer.updated_at;

delete from public.shipment_costs sc
using public.shipment_costs newer
where sc.shipment_id = newer.shipment_id
  and sc.updated_at = newer.updated_at
  and sc.id < newer.id;

create unique index if not exists shipment_costs_shipment_id_key
  on public.shipment_costs (shipment_id);
