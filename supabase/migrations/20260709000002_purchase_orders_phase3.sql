-- Phase 3: PO item quantities like shipment products, supplier accept/confirm,
-- delivery batches (planned schedule), per-item receipt flow, status recompute.

-- =============================
-- Purchase order items: unit/flags + accepted qty + item status
-- =============================

alter table public.purchase_order_items
  add column if not exists accepted_quantity numeric(12, 2),
  add column if not exists accepted_cartons int,
  add column if not exists is_disassembled boolean not null default false,
  add column if not exists is_new_incoming_product boolean not null default false,
  add column if not exists confirmed_at timestamptz,
  add column if not exists item_status text not null default 'draft';

alter table public.purchase_order_items drop constraint if exists purchase_order_items_item_status_check;
alter table public.purchase_order_items
  add constraint purchase_order_items_item_status_check
  check (item_status in ('draft', 'awaiting_receipt', 'received', 'cancelled'));

-- =============================
-- Delivery batches (planned schedule set by supplier at confirm time)
-- =============================

create table if not exists public.purchase_order_delivery_batches (
  id uuid primary key default gen_random_uuid(),
  purchase_order_item_id uuid not null references public.purchase_order_items (id) on delete cascade,
  planned_quantity numeric(12, 2) not null check (planned_quantity > 0),
  planned_cartons int,
  planned_date date,
  status text not null default 'scheduled' check (status in ('scheduled', 'received', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists po_delivery_batches_item_idx
  on public.purchase_order_delivery_batches (purchase_order_item_id);

drop trigger if exists set_updated_at on public.purchase_order_delivery_batches;
create trigger set_updated_at before update on public.purchase_order_delivery_batches
for each row execute function public.set_updated_at();

alter table public.purchase_order_delivery_batches enable row level security;

drop policy if exists po_delivery_batches_select on public.purchase_order_delivery_batches;
create policy po_delivery_batches_select on public.purchase_order_delivery_batches
for select to authenticated using (
  exists (
    select 1
    from public.purchase_order_items i
    join public.purchase_orders po on po.id = i.purchase_order_id
    where i.id = purchase_order_item_id
      and (
        public.current_user_role() in ('admin', 'manager', 'viewer')
        or (public.is_supplier() and po.supplier_id = public.current_supplier_id())
      )
  )
);

drop policy if exists po_delivery_batches_staff_write on public.purchase_order_delivery_batches;
create policy po_delivery_batches_staff_write on public.purchase_order_delivery_batches
for all to authenticated
  using (public.can_write()) with check (public.can_write());

drop policy if exists po_delivery_batches_supplier_write on public.purchase_order_delivery_batches;
create policy po_delivery_batches_supplier_write on public.purchase_order_delivery_batches
for all to authenticated
  using (
    exists (
      select 1
      from public.purchase_order_items i
      join public.purchase_orders po on po.id = i.purchase_order_id
      where i.id = purchase_order_item_id
        and public.is_supplier()
        and po.supplier_id = public.current_supplier_id()
    )
  )
  with check (
    exists (
      select 1
      from public.purchase_order_items i
      join public.purchase_orders po on po.id = i.purchase_order_id
      where i.id = purchase_order_item_id
        and public.is_supplier()
        and po.supplier_id = public.current_supplier_id()
    )
  );

grant all on table public.purchase_order_delivery_batches to authenticated;
grant all on table public.purchase_order_delivery_batches to service_role;

-- =============================
-- Receipts: link to delivery batch + allow supplier insert
-- =============================

alter table public.purchase_order_receipts
  add column if not exists delivery_batch_id uuid references public.purchase_order_delivery_batches (id) on delete set null;

create index if not exists purchase_order_receipts_batch_idx
  on public.purchase_order_receipts (delivery_batch_id);

drop policy if exists purchase_order_receipts_supplier_insert on public.purchase_order_receipts;
create policy purchase_order_receipts_supplier_insert on public.purchase_order_receipts
for insert to authenticated
  with check (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and public.is_supplier()
        and po.supplier_id = public.current_supplier_id()
    )
  );

-- Suppliers may update accepted qty / confirm their own PO items.
drop policy if exists purchase_order_items_supplier_update on public.purchase_order_items;
create policy purchase_order_items_supplier_update on public.purchase_order_items
for update to authenticated
  using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and public.is_supplier()
        and po.supplier_id = public.current_supplier_id()
    )
  )
  with check (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_id
        and public.is_supplier()
        and po.supplier_id = public.current_supplier_id()
    )
  );

-- =============================
-- Status recompute (item-level + PO-level)
-- =============================

create or replace function public.recompute_po_item_status(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target numeric(12, 2);
  v_confirmed timestamptz;
  v_status text;
  v_received numeric(12, 2);
  v_next text;
begin
  select coalesce(accepted_quantity, order_quantity), confirmed_at, item_status
  into v_target, v_confirmed, v_status
  from public.purchase_order_items
  where id = p_item_id;

  if v_status is null or v_status = 'cancelled' then
    return;
  end if;

  select coalesce(sum(received_quantity), 0)
  into v_received
  from public.purchase_order_receipts
  where purchase_order_item_id = p_item_id;

  v_next := case
    when v_target > 0 and v_received >= v_target then 'received'
    when v_confirmed is not null then 'awaiting_receipt'
    else 'draft'
  end;

  update public.purchase_order_items
  set item_status = v_next, updated_at = now()
  where id = p_item_id and item_status <> v_next;
end;
$$;

create or replace function public.recompute_purchase_order_status(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_received int;
  v_any_received int;
  v_confirmed int;
  v_over int;
begin
  with agg as (
    select
      i.confirmed_at,
      coalesce(i.accepted_quantity, i.order_quantity) as target,
      coalesce((
        select sum(r.received_quantity)
        from public.purchase_order_receipts r
        where r.purchase_order_item_id = i.id
      ), 0) as received
    from public.purchase_order_items i
    where i.purchase_order_id = p_purchase_order_id
      and i.item_status <> 'cancelled'
  )
  select
    count(*),
    count(*) filter (where target > 0 and received >= target),
    count(*) filter (where received > 0),
    count(*) filter (where confirmed_at is not null),
    count(*) filter (where received > target)
  into v_total, v_received, v_any_received, v_confirmed, v_over
  from agg;

  update public.purchase_orders
  set
    status = case
      when v_total = 0 then status
      when v_over > 0 then 'over_received'
      when v_received = v_total then 'received'
      when v_any_received > 0 then 'partially_received'
      when v_confirmed > 0 then 'confirmed'
      else 'draft'
    end,
    received_at = case
      when v_total > 0 and (v_over > 0 or v_received = v_total) then coalesce(received_at, now())
      else received_at
    end,
    updated_at = now()
  where id = p_purchase_order_id
    and status <> 'cancelled';
end;
$$;

-- Receipts trigger: update batch status + item status + PO status.
create or replace function public.trg_purchase_order_receipts_recompute_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item uuid;
  v_po uuid;
  v_batch uuid;
begin
  if tg_op = 'DELETE' then
    v_item := old.purchase_order_item_id;
    v_po := old.purchase_order_id;
    v_batch := old.delivery_batch_id;
  else
    v_item := new.purchase_order_item_id;
    v_po := new.purchase_order_id;
    v_batch := new.delivery_batch_id;
  end if;

  if v_batch is not null and tg_op <> 'DELETE' then
    update public.purchase_order_delivery_batches
    set status = 'received', updated_at = now()
    where id = v_batch and status <> 'cancelled';
  end if;

  perform public.recompute_po_item_status(v_item);
  perform public.recompute_purchase_order_status(v_po);
  return null;
end;
$$;

drop trigger if exists trg_purchase_order_receipts_recompute_status on public.purchase_order_receipts;
create trigger trg_purchase_order_receipts_recompute_status
after insert or update or delete on public.purchase_order_receipts
for each row execute function public.trg_purchase_order_receipts_recompute_status();

create or replace function public.trg_po_item_confirmed_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.confirmed_at is distinct from new.confirmed_at then
    perform public.recompute_po_item_status(new.id);
    perform public.recompute_purchase_order_status(new.purchase_order_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_po_item_confirmed_recompute on public.purchase_order_items;
create trigger trg_po_item_confirmed_recompute
after update on public.purchase_order_items
for each row execute function public.trg_po_item_confirmed_recompute();
