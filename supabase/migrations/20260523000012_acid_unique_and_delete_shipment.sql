-- ACID globally unique; admin-only shipment delete.

create unique index if not exists shipments_acid_unique_idx
  on public.shipments (lower(trim(acid)));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.delete_shipment(p_shipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.shipments
  where id = p_shipment_id;

  if not found then
    raise exception 'shipment not found';
  end if;
end;
$$;

grant execute on function public.delete_shipment(uuid) to authenticated;
