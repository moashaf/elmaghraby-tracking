-- Required for close_shipment_with_costs ON CONFLICT (shipment_id).
create unique index if not exists shipment_costs_shipment_id_key on public.shipment_costs (shipment_id);
