-- Stop ETA-based auto customs; vessel location sync handles transitions.

create or replace function public.auto_move_shipments_to_customs()
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  return 0;
end;
$$;
