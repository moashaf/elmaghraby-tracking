-- Phase 1: explicit status transition RPC for app buttons.

create or replace function public.transition_shipment_status(
  shipment_id uuid,
  target_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if not public.can_write() then
    raise exception 'not authorized';
  end if;

  if target_status not in ('customs', 'closed') then
    raise exception 'invalid target status';
  end if;

  select status into current_status
  from public.shipments
  where id = shipment_id
  for update;

  if current_status is null then
    raise exception 'shipment not found';
  end if;

  if current_status = 'in_sea' and target_status = 'customs' then
    update public.shipments
    set status = 'customs',
        previous_status = 'in_sea',
        updated_at = now()
    where id = shipment_id;
    return 'customs';
  end if;

  if current_status = 'customs' and target_status = 'closed' then
    update public.shipments
    set status = 'closed',
        previous_status = 'customs',
        closed_at = coalesce(closed_at, now()),
        updated_at = now()
    where id = shipment_id;
    return 'closed';
  end if;

  raise exception 'invalid transition from % to %', current_status, target_status;
end;
$$;
