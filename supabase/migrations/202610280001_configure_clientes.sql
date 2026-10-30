begin;

-- Añadir el nombre sin eliminar ni recrear los perfiles existentes.
alter table public.profiles
add column nombre text not null default ''
check (char_length(nombre) <= 100);

-- Asignar un nombre a nuestra cuenta de prueba.
update public.profiles as p
set nombre = 'Cliente de prueba'
from auth.users as u
where p.id = u.id
  and u.email = 'cliente@vinylstore.example'
  and p.nombre = '';

-- Consulta administrativa del listado o de una ficha concreta.
create function public.admin_consultar_clientes(
  p_cliente_id uuid default null
)
returns table (
  id uuid,
  nombre text,
  correo text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- El permiso se comprueba dentro de la función.
  if auth.uid() is null or not exists (
    select 1
    from public.profiles as perfil
    where perfil.id = auth.uid()
      and perfil.role = 'admin'
  ) then
    raise exception 'Solo el administrador puede consultar clientes.'
      using errcode = '42501';
  end if;

  return query
  select
    perfil.id,
    case
      when trim(perfil.nombre) = '' then 'Sin nombre'
      else trim(perfil.nombre)
    end,
    usuario.email::text,
    usuario.created_at
  from public.profiles as perfil
  join auth.users as usuario
    on usuario.id = perfil.id
  where perfil.role = 'cliente'
    and (
      p_cliente_id is null
      or perfil.id = p_cliente_id
    )
  order by lower(perfil.nombre), perfil.id;
end;
$$;

revoke all on function public.admin_consultar_clientes(uuid)
from public, anon, authenticated;

grant execute on function public.admin_consultar_clientes(uuid)
to authenticated;

commit;