-- Phase 4: China warehouse stock + auto allocations into shipments.

-- =============================
-- China warehouse stock (from PO receipts minus allocations)
-- =============================

create or replace view public.china_warehouse_stock as
select
  po.supplier_id,
  poi.product_id,
  sum(coalesce(r.received_quantity, 0)) as received_quantity,
  sum(coalesce(r.received_cartons, 0)) as received_cartons,
  sum(coalesce(sa.allocated_quantity, 0)) as allocated_quantity,
  sum(coalesce(sa.allocated_cartons, 0)) as allocated_cartons,
  sum(coalesce(r.received_quantity, 0)) - sum(coalesce(sa.allocated_quantity, 0)) as available_quantity,
  sum(coalesce(r.received_cartons, 0)) - sum(coalesce(sa.allocated_cartons, 0)) as available_cartons
from public.purchase_order_receipts r
join public.purchase_orders po on po.id = r.purchase_order_id
join public.purchase_order_items poi on poi.id = r.purchase_order_item_id
left join public.shipment_allocations sa on sa.purchase_order_receipt_id = r.id
group by po.supplier_id, poi.product_id;

grant select on public.china_warehouse_stock to authenticated;
grant select on public.china_warehouse_stock to service_role;

-- =============================
-- Auto allocate receipts into shipment lines
-- =============================

create or replace function public.auto_allocate_shipment_from_china_warehouse(p_shipment_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_allocated int := 0;
  v_line record;
  v_need numeric(12, 2);
  v_receipt record;
  v_receipt_remaining numeric(12, 2);
  v_take numeric(12, 2);
  v_unit_per_carton numeric(12, 6);
  v_cartons int;
begin
  if not public.can_write() then
    raise exception 'not authorized';
  end if;

  select supplier_id into v_supplier_id
  from public.shipments
  where id = p_shipment_id;

  if v_supplier_id is null then
    raise exception 'shipment not found';
  end if;

  for v_line in
    select sp.id as shipment_product_id, sp.product_id, sp.quantity
    from public.shipment_products sp
    where sp.shipment_id = p_shipment_id
    order by sp.created_at
  loop
    v_need := coalesce(v_line.quantity, 0);
    if v_need <= 0 then
      continue;
    end if;

    -- subtract already allocated to this shipment line
    select v_need - coalesce(sum(sa.allocated_quantity), 0)
    into v_need
    from public.shipment_allocations sa
    where sa.shipment_product_id = v_line.shipment_product_id;

    if v_need <= 0 then
      continue;
    end if;

    for v_receipt in
      select
        r.id as receipt_id,
        r.received_quantity,
        r.received_cartons
      from public.purchase_order_receipts r
      join public.purchase_orders po on po.id = r.purchase_order_id
      join public.purchase_order_items poi on poi.id = r.purchase_order_item_id
      where po.supplier_id = v_supplier_id
        and poi.product_id = v_line.product_id
      order by r.received_date asc, r.created_at asc
    loop
      -- remaining quantity on receipt
      select
        coalesce(v_receipt.received_quantity, 0) - coalesce(sum(sa.allocated_quantity), 0)
      into v_receipt_remaining
      from public.shipment_allocations sa
      where sa.purchase_order_receipt_id = v_receipt.receipt_id;

      if v_receipt_remaining <= 0 then
        continue;
      end if;

      v_take := least(v_need, v_receipt_remaining);
      v_cartons := null;
      if v_receipt.received_cartons is not null and v_receipt.received_cartons > 0 and v_receipt.received_quantity is not null and v_receipt.received_quantity > 0 then
        v_unit_per_carton := v_receipt.received_quantity / v_receipt.received_cartons;
        if v_unit_per_carton > 0 then
          v_cartons := ceil(v_take / v_unit_per_carton)::int;
        end if;
      end if;

      insert into public.shipment_allocations (
        purchase_order_receipt_id,
        shipment_id,
        shipment_product_id,
        allocated_quantity,
        allocated_cartons,
        created_by
      )
      values (
        v_receipt.receipt_id,
        p_shipment_id,
        v_line.shipment_product_id,
        v_take,
        v_cartons,
        auth.uid()
      );

      v_allocated := v_allocated + 1;
      v_need := v_need - v_take;
      if v_need <= 0 then
        exit;
      end if;
    end loop;
  end loop;

  return v_allocated;
end;
$$;

grant execute on function public.auto_allocate_shipment_from_china_warehouse(uuid) to authenticated;

