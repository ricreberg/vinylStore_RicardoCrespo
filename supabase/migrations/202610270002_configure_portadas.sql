begin;

-- Crear el bucket o ajustar el que ya hemos creado desde el panel.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'portadas',
  'portadas',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- El administrador puede listar los archivos del bucket.
create policy "Administrador consulta portadas"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'portadas'
  and exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
);

-- El administrador puede subir archivos nuevos.
create policy "Administrador sube portadas"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'portadas'
  and exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
);

-- El administrador puede eliminar archivos.
create policy "Administrador elimina portadas"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'portadas'
  and exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
);

commit;