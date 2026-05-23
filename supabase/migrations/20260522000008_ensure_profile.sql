-- Allow users to bootstrap their own profile if the signup trigger did not run
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
  user_email text;
begin
  select * into result from public.profiles where id = auth.uid();
  if found then
    return result;
  end if;

  select email into user_email from auth.users where id = auth.uid();

  insert into public.profiles (id, full_name, role, locale)
  values (
    auth.uid(),
    coalesce(user_email, 'مستخدم'),
    'viewer',
    'ar'
  )
  returning * into result;

  return result;
end;
$$;

grant execute on function public.ensure_my_profile() to authenticated;
