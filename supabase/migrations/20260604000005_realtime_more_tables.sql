-- Enable live updates for shipment documents and costs (detail page + invoice labels).
alter publication supabase_realtime add table public.shipment_documents;
alter publication supabase_realtime add table public.shipment_costs;
