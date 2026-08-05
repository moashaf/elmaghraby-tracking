-- Fix: ON CONFLICT (shipment_id) failed because PL/pgSQL param name shadowed the column
-- under #variable_conflict use_variable. Use update-then-insert instead.

drop function if exists public.close_shipment_with_costs(uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb);
drop function if exists public.close_shipment_with_costs(uuid, numeric, numeric, numeric, numeric, numeric, text);

create or replace function public.close_shipment_with_costs(
  shipment_id uuid,
  customs_cost numeric default 0,
  shipping_cost numeric default 0,
  clearance_cost numeric default 0,
  local_transport_cost numeric default 0,
  other_expenses numeric default 0,
  closing_notes text default null,
  line_items jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment_id uuid := shipment_id;
  v_customs_cost numeric := coalesce(customs_cost, 0);
  v_shipping_cost numeric := coalesce(shipping_cost, 0);
  v_clearance_cost numeric := coalesce(clearance_cost, 0);
  v_local_transport_cost numeric := coalesce(local_transport_cost, 0);
  v_other_expenses numeric := coalesce(other_expenses, 0);
  v_closing_notes text := closing_notes;
  v_line_items jsonb := coalesce(line_items, '{}'::jsonb);
  cost_id uuid;
  before_row jsonb;
  after_row jsonb;
  sys_settings jsonb;
  require_costs boolean;
  require_customs_doc boolean;
  total_cost numeric;
  shipment_status text;
begin
  if not public.can_write() then
    raise exception 'not authorized';
  end if;

  select value into sys_settings
  from public.app_settings
  where key = 'system';

  require_costs := coalesce((sys_settings->>'require_costs_before_close')::boolean, true);
  require_customs_doc := coalesce((sys_settings->>'require_customs_document')::boolean, false);

  select to_jsonb(s) into before_row
  from public.shipments s
  where s.id = v_shipment_id
  for update;

  if before_row is null then
    raise exception 'shipment not found';
  end if;

  shipment_status := before_row->>'status';

  total_cost :=
    v_customs_cost +
    v_shipping_cost +
    v_clearance_cost +
    v_local_transport_cost +
    v_other_expenses;

  if shipment_status <> 'closed' and require_costs and total_cost <= 0 then
    raise exception 'يجب إدخال المصاريف قبل إغلاق الشحنة';
  end if;

  if shipment_status <> 'closed' and require_customs_doc then
    if not exists (
      select 1
      from public.shipment_documents d
      where d.shipment_id = v_shipment_id
        and upper(d.doc_type) not in ('INV')
    ) then
      raise exception 'يجب رفع مستند جمارك (غير ملف INV) قبل الإغلاق';
    end if;
  end if;

  update public.shipment_costs sc
  set
    customs_cost = v_customs_cost,
    shipping_cost = v_shipping_cost,
    clearance_cost = v_clearance_cost,
    local_transport_cost = v_local_transport_cost,
    other_expenses = v_other_expenses,
    closing_notes = v_closing_notes,
    line_items = v_line_items,
    closed_by = auth.uid(),
    updated_at = now()
  where sc.shipment_id = v_shipment_id
  returning sc.id into cost_id;

  if cost_id is null then
    insert into public.shipment_costs (
      shipment_id,
      customs_cost,
      shipping_cost,
      clearance_cost,
      local_transport_cost,
      other_expenses,
      closing_notes,
      line_items,
      closed_by,
      closed_at
    )
    values (
      v_shipment_id,
      v_customs_cost,
      v_shipping_cost,
      v_clearance_cost,
      v_local_transport_cost,
      v_other_expenses,
      v_closing_notes,
      v_line_items,
      auth.uid(),
      now()
    )
    returning id into cost_id;
  end if;

  update public.shipments s
  set status = 'closed',
      previous_status = case when s.status <> 'closed' then s.status else s.previous_status end,
      closed_at = coalesce(s.closed_at, now()),
      updated_at = now()
  where s.id = v_shipment_id;

  select to_jsonb(s) into after_row
  from public.shipments s
  where s.id = v_shipment_id;

  insert into public.shipment_timeline_events (shipment_id, event_type, title_ar, description_ar, metadata, created_by)
  values (
    v_shipment_id,
    'closed_with_costs',
    'إغلاق الشحنة',
    'تم حفظ المصاريف وإغلاق الشحنة',
    jsonb_build_object('cost_id', cost_id),
    auth.uid()
  );

  insert into public.audit_log (entity_type, entity_id, action, old_data, new_data, user_id)
  values ('shipment', v_shipment_id, 'close_with_costs', before_row, after_row, auth.uid());

  return cost_id;
end;
$$;

grant execute on function public.close_shipment_with_costs(uuid, numeric, numeric, numeric, numeric, numeric, text, jsonb) to authenticated;
