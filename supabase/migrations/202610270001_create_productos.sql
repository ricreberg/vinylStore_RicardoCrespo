begin;

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  artista text not null check (length(trim(artista)) > 0),
  genero text not null check (length(trim(genero)) > 0),
  precio numeric(10, 2) not null
    check (precio >= 0 and precio <> 'NaN'::numeric),
  stock integer not null default 0 check (stock >= 0),
  descripcion text not null default '',
  imagen_path text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.productos enable row level security;

-- Permisos generales de acceso mediante la API.
revoke all on table public.productos
from public, anon, authenticated;

grant select on table public.productos to anon, authenticated;
grant insert, update on table public.productos to authenticated;

-- Cualquier visitante puede consultar el catálogo activo.
create policy "Consultar productos activos"
on public.productos
for select
to anon, authenticated
using (activo = true);

-- El administrador puede consultar también los inactivos.
create policy "Administrador consulta todos los productos"
on public.productos
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
);

-- Solo el administrador puede crear productos.
create policy "Administrador crea productos"
on public.productos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
);

-- Solo el administrador puede modificar productos.
create policy "Administrador modifica productos"
on public.productos
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
);

commit;