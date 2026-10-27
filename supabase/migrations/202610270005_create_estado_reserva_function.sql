begin;

create function public.cambiar_estado_reserva(
  p_reserva_id uuid,
  p_estado text
)
returns public.reservas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_admin boolean;
  v_reserva public.reservas%rowtype;
begin
  if v_usuario is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if p_reserva_id is null then
    raise exception 'Falta el identificador de la reserva.';
  end if;

  if p_estado is null
    or p_estado not in ('cancelada', 'recogida') then
    raise exception 'El estado solicitado no es válido.';
  end if;

  select exists (
    select 1
    from public.profiles
    where id = v_usuario
      and role = 'admin'
  )
  into v_admin;

  -- Solo localizar reservas que el usuario puede gestionar.
  select *
  into v_reserva
  from public.reservas
  where id = p_reserva_id
    and (usuario_id = v_usuario or v_admin);

  if not found then
    raise exception 'La reserva no existe o no tienes permiso.';
  end if;

  if p_estado = 'recogida' and not v_admin then
    raise exception 'Solo el administrador puede confirmar la recogida.';
  end if;

  -- Mantener el mismo orden de bloqueo que al crear una reserva:
  -- primero el perfil de su propietario.
  perform 1
  from public.profiles
  where id = v_reserva.usuario_id
  for update;

  if not found then
    raise exception 'No se ha encontrado el perfil del propietario.';
  end if;

  -- Volver a leer el estado y bloquear la reserva.
  select *
  into v_reserva
  from public.reservas
  where id = p_reserva_id
  for update;

  if not found then
    raise exception 'La reserva ya no existe.';
  end if;

  -- Repetir una operación completada no vuelve a afectar al stock.
  if v_reserva.estado = p_estado then
    return v_reserva;
  end if;

  if v_reserva.estado <> 'pendiente' then
    raise exception 'La reserva ya está finalizada y no puede cambiarse.';
  end if;

  -- UPDATE bloquea también la fila del producto mientras la modifica.
  if p_estado = 'cancelada' then
    update public.productos
    set stock = stock + v_reserva.cantidad
    where id = v_reserva.producto_id;
  end if;

  update public.reservas
  set
    estado = p_estado,
    updated_at = now()
  where id = p_reserva_id
  returning * into v_reserva;

  return v_reserva;
end;
$$;

revoke all on function public.cambiar_estado_reserva(uuid, text)
from public, anon, authenticated;

grant execute on function public.cambiar_estado_reserva(uuid, text)
to authenticated;

commit;