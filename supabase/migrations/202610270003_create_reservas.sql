begin;

create table public.reservas (
  id uuid primary key default gen_random_uuid(),

  usuario_id uuid not null
    references auth.users(id) on delete restrict,

  producto_id uuid not null
    references public.productos(id) on delete restrict,

  cantidad integer not null
    check (cantidad > 0),

  precio_unitario numeric(10, 2) not null
    check (
      precio_unitario >= 0
      and precio_unitario <> 'NaN'::numeric
    ),

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'recogida', 'cancelada')),

  solicitud_id uuid not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (usuario_id, solicitud_id)
);

create index reservas_usuario_idx
on public.reservas (usuario_id);

create index reservas_producto_idx
on public.reservas (producto_id);

alter table public.reservas enable row level security;

-- Desde la API solo se permite consultar directamente la tabla.
revoke all on table public.reservas
from public, anon, authenticated;

grant select on table public.reservas to authenticated;

create policy "Consultar reservas propias"
on public.reservas
for select
to authenticated
using (usuario_id = (select auth.uid()));

create policy "Administrador consulta todas las reservas"
on public.reservas
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

commit;