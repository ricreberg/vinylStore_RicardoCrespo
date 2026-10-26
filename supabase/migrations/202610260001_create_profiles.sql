begin;

-- Perfil asociado a cada usuario de Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'cliente'
    check (role in ('cliente', 'admin')),
  created_at timestamptz not null default now()
);

-- La aplicación solo podrá leer perfiles.
alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;

-- Cada usuario autenticado puede consultar únicamente su perfil.
create policy "Leer perfil propio"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

-- Función interna para crear perfiles de nuevos usuarios.
create schema if not exists private;

create function private.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'cliente');

  return new;
end;
$$;

revoke all on function private.create_user_profile()
from public, anon, authenticated;

-- Cada nueva cuenta recibirá el rol cliente automáticamente.
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function private.create_user_profile();

-- Crear perfiles para las cuentas que ya existen.
insert into public.profiles (id, role)
select id, 'cliente'
from auth.users
on conflict (id) do nothing;

commit;