-- Guard customs transition: prevent early customs + allow admin revert.

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
  current_eta date;
begin
  if not public.can_write() then
    raise exception 'not authorized';
  end if;

  if target_status not in ('customs', 'closed') then
    raise exception 'invalid target status';
  end if;

  select status, eta into current_status, current_eta
  from public.shipments
  where id = shipment_id
  for update;

  if current_status is null then
    raise exception 'shipment not found';
  end if;

  if current_status = 'in_sea' and target_status = 'customs' then
    if current_eta is not null and current_date < current_eta then
      raise exception 'cannot move to customs before ETA';
    end if;

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

create or replace function public.revert_shipment_to_in_sea(p_shipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_eta date;
  current_status text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select status, eta into current_status, current_eta
  from public.shipments
  where id = p_shipment_id
  for update;

  if current_status is null then
    raise exception 'shipment not found';
  end if;

  if current_status <> 'customs' then
    raise exception 'shipment not in customs';
  end if;

  if current_eta is not null and current_date >= current_eta then
    raise exception 'cannot revert after ETA';
  end if;

  update public.shipments
  set status = 'in_sea',
      previous_status = null,
      auto_moved_to_customs_at = null,
      updated_at = now()
  where id = p_shipment_id;
end;
$$;

grant execute on function public.revert_shipment_to_in_sea(uuid) to authenticated;

