-- Storage: private bucket container-files
-- Create bucket in Supabase Dashboard if insert fails:
-- Storage > New bucket > container-files (private)

insert into storage.buckets (id, name, public)
values ('container-files', 'container-files', false)
on conflict (id) do nothing;

create policy "container_files_authenticated_read"
on storage.objects for select to authenticated
using (bucket_id = 'container-files');

create policy "container_files_authenticated_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'container-files');

create policy "container_files_authenticated_update"
on storage.objects for update to authenticated
using (bucket_id = 'container-files');

create policy "container_files_authenticated_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'container-files');
