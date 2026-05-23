-- Phase 2: close shipments with costs and audit trail.

create or replace function public.close_shipment_with_costs(
  shipment_id uuid,
  customs_cost numeric default 0,
  shipping_cost numeric default 0,
  clearance_cost numeric default 0,
  local_transport_cost numeric default 0,
  other_expenses numeric default 0,
  closing_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cost_id uuid;
  before_row jsonb;
  after_row jsonb;
begin
  if not public.can_write() then
    raise exception 'not authorized';
  end if;

  select to_jsonb(s) into before_row
  from public.shipments s
  where s.id = shipment_id
  for update;

  if before_row is null then
    raise exception 'shipment not found';
  end if;

  insert into public.shipment_costs (
    shipment_id,
    customs_cost,
    shipping_cost,
    clearance_cost,
    local_transport_cost,
    other_expenses,
    closing_notes,
    closed_by,
    closed_at
  )
  values (
    shipment_id,
    coalesce(customs_cost, 0),
    coalesce(shipping_cost, 0),
    coalesce(clearance_cost, 0),
    coalesce(local_transport_cost, 0),
    coalesce(other_expenses, 0),
    closing_notes,
    auth.uid(),
    now()
  )
  on conflict (shipment_id) do update
    set customs_cost = excluded.customs_cost,
        shipping_cost = excluded.shipping_cost,
        clearance_cost = excluded.clearance_cost,
        local_transport_cost = excluded.local_transport_cost,
        other_expenses = excluded.other_expenses,
        closing_notes = excluded.closing_notes,
        closed_by = excluded.closed_by,
        updated_at = now()
  returning id into cost_id;

  update public.shipments
  set status = 'closed',
      previous_status = case when status <> 'closed' then status else previous_status end,
      closed_at = coalesce(closed_at, now()),
      updated_at = now()
  where id = shipment_id;

  select to_jsonb(s) into after_row
  from public.shipments s
  where s.id = shipment_id;

  insert into public.shipment_timeline_events (shipment_id, event_type, title_ar, description_ar, metadata, created_by)
  values (
    shipment_id,
    'closed_with_costs',
    'إغلاق الشحنة',
    'تم حفظ المصاريف وإغلاق الشحنة',
    jsonb_build_object('cost_id', cost_id),
    auth.uid()
  );

  insert into public.audit_log (entity_type, entity_id, action, old_data, new_data, user_id)
  values ('shipment', shipment_id, 'close_with_costs', before_row, after_row, auth.uid());

  return cost_id;
end;
$$;
