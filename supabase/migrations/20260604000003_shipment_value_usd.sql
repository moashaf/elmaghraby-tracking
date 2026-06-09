alter table public.shipments
  add column if not exists value_usd numeric(14, 2);

comment on column public.shipments.value_usd is 'Shipment value in US dollars';
