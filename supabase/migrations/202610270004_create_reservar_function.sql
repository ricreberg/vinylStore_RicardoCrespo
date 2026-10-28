begin;

create function public.crear_reserva(
  p_producto_id uuid,
  p_cantidad integer,
  p_solicitud_id uuid
)
returns public.reservas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_producto public.productos%rowtype;
  v_reserva public.reservas%rowtype;
begin
  -- La identidad procede de la sesión, no del navegador.
  if v_usuario is null then
    raise exception 'Debes iniciar sesión para reservar.';
  end if;

  if p_producto_id is null or p_solicitud_id is null then
    raise exception 'Faltan datos de la solicitud.';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;

  -- Ordenar las solicitudes de una misma cuenta.
  -- También comprueba que tenga un perfil.
  perform 1
  from public.profiles
  where id = v_usuario
  for update;

  if not found then
    raise exception 'No se ha encontrado tu perfil.';
  end if;

  -- Un reintento de la misma solicitud devuelve la reserva existente.
  select *
  into v_reserva
  from public.reservas
  where usuario_id = v_usuario
    and solicitud_id = p_solicitud_id;

  if found then
    if v_reserva.producto_id <> p_producto_id
      or v_reserva.cantidad <> p_cantidad then
      raise exception 'La solicitud ya existe con otros datos.';
    end if;

    return v_reserva;
  end if;

  -- Bloquear el producto mientras comprobamos y descontamos stock.
  select *
  into v_producto
  from public.productos
  where id = p_producto_id
  for update;

  if not found then
    raise exception 'El producto no existe.';
  end if;

  if not v_producto.activo then
    raise exception 'El producto no está disponible para reservar.';
  end if;

  if v_producto.stock < p_cantidad then
    raise exception 'No hay suficientes unidades disponibles.';
  end if;

  update public.productos
  set stock = stock - p_cantidad
  where id = p_producto_id;

  insert into public.reservas (
    usuario_id,
    producto_id,
    cantidad,
    precio_unitario,
    solicitud_id
  )
  values (
    v_usuario,
    p_producto_id,
    p_cantidad,
    v_producto.precio,
    p_solicitud_id
  )
  returning * into v_reserva;

  return v_reserva;
end;
$$;

-- Solo las cuentas autenticadas pueden llamar a esta función.
revoke all on function public.crear_reserva(uuid, integer, uuid)
from public, anon, authenticated;

grant execute on function public.crear_reserva(uuid, integer, uuid)
to authenticated;

commit;