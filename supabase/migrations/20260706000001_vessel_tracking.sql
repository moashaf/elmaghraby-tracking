-- Vessel tracking fields (Weiyun / future providers)
alter table public.shipments
  add column if not exists vessel_name text,
  add column if not exists vessel_imo text,
  add column if not exists vessel_mmsi text,
  add column if not exists weiyun_ship_id text,
  add column if not exists vessel_location_text text,
  add column if not exists vessel_tracked_at timestamptz,
  add column if not exists vessel_tracking_status text not null default 'pending'
    check (vessel_tracking_status in ('pending', 'ok', 'not_found', 'error'));

create index if not exists shipments_vessel_tracking_status_idx
  on public.shipments (vessel_tracking_status);

create index if not exists shipments_vessel_name_idx
  on public.shipments (vessel_name);
