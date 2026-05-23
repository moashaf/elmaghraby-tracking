-- Fix: generate_shipment_number must bypass RLS on shipment_number_sequences

alter table public.shipment_number_sequences enable row level security;

drop policy if exists shipment_number_sequences_service on public.shipment_number_sequences;
create policy shipment_number_sequences_service on public.shipment_number_sequences
for all to service_role using (true) with check (true);

create or replace function public.generate_shipment_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from now())::int;
  n int;
begin
  if new.shipment_number is not null and new.shipment_number <> '' then
    return new;
  end if;

  insert into public.shipment_number_sequences (year, last_value)
  values (y, 1)
  on conflict (year) do update
    set last_value = public.shipment_number_sequences.last_value + 1
  returning last_value into n;

  new.shipment_number := 'SH-' || y::text || '-' || lpad(n::text, 4, '0');
  return new;
end;
$$;
