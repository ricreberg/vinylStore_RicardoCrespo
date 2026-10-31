begin;

-- Usar la fecha de alta del perfil como fecha de negocio.
-- La fecha técnica de creación de Auth se conserva sin modificar.
create or replace function public.admin_consultar_clientes(
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
    perfil.created_at
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
