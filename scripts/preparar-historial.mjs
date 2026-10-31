import { readFile, writeFile } from 'node:fs/promises';

// Este script solo prepara SQL local. No se conecta a Supabase.
const carpetaDatos = new URL('../datos-importacion/', import.meta.url);

async function prepararHistorial() {
  const clientes = JSON.parse(await readFile(
    new URL('clientes-demo.json', carpetaDatos), 'utf8',
  ));
  const catalogo = JSON.parse(await readFile(
    new URL('catalogo.json', carpetaDatos), 'utf8',
  ));

  const idsClientes = clientes.map((cliente) => cliente.id);
  const idsProductos = catalogo.map((producto) => producto.musicbrainz_id);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    idsClientes.length !== 15 ||
    idsProductos.length !== 60 ||
    new Set(idsClientes).size !== 15 ||
    new Set(idsProductos).size !== 60 ||
    ![...idsClientes, ...idsProductos].every((id) => uuid.test(id))
  ) {
    throw new Error('Se necesitan 15 clientes y 60 productos con UUID válidos y distintos.');
  }

  const listaClientes = idsClientes.map((id) => `'${id}'`).join(', ');
  const listaProductos = idsProductos.map((id) => `'${id}'`).join(', ');

  const sql = `-- Datos de demostración de Vinyl Store: 400 reservas y dos años de actividad.
-- Preparado a partir de los identificadores de este proyecto.
-- Una sola operación: si falla, sus cambios se revierten.

do $historial$
declare
  v_clientes uuid[] := array[${listaClientes}]::uuid[];
  v_productos uuid[] := array[${listaProductos}]::uuid[];
  v_desfases integer[] := array[0, 27, 69, 113, 156, 208, 264, 319, 378, 433, 512, 580, 642, 690, 716];
  v_inicio timestamptz := date_trunc('day', now()) - interval '2 years';
  v_ahora timestamptz := now();
  v_fecha timestamptz;
  v_actualizacion timestamptz;
  v_alta timestamptz;
  v_cliente uuid;
  v_producto_id uuid;
  v_producto public.productos%rowtype;
  v_estado text;
  v_cantidad integer;
  v_respaldo jsonb;
  i integer;
begin
  lock table public.profiles, public.productos, public.reservas
    in share row exclusive mode;

  create schema if not exists private;
  create table if not exists private.cargas_historial_demo (
    id text primary key,
    fecha timestamptz not null default now(),
    respaldo jsonb not null
  );
  revoke all on private.cargas_historial_demo
    from public, anon, authenticated;

  -- Repetir la carga no duplica reservas ni vuelve a descontar existencias.
  if exists (
    select 1 from private.cargas_historial_demo
    where id = 'vinylstore-historial-v1'
  ) then
    raise notice 'Este historial ya está cargado. No se ha repetido.';
    return;
  end if;

  if (
    select count(*) from public.profiles
    where id = any(v_clientes) and role = 'cliente'
  ) <> 15 then
    raise exception 'No se encuentran los 15 perfiles de cliente esperados.';
  end if;

  if (
    select count(*) from public.productos
    where id = any(v_productos) and imagen_path like 'catalogo/%'
  ) <> 60 then
    raise exception 'No se encuentran los 60 productos importados.';
  end if;

  -- Esta carga inicial está preparada para la tienda recién limpiada.
  if exists (select 1 from public.reservas) then
    raise exception 'Ya hay reservas. Revisarlas antes de cargar el historial inicial.';
  end if;

  select jsonb_build_object(
    'perfiles', (
      select jsonb_agg(to_jsonb(p)) from public.profiles p
      where p.id = any(v_clientes)
    ),
    'productos', (
      select jsonb_agg(to_jsonb(p)) from public.productos p
      where p.id = any(v_productos)
    )
  ) into v_respaldo;

  -- Alta de negocio de cada cliente. No modifica cuentas ni contraseñas de Auth.
  for i in 1..15 loop
    update public.profiles
    set created_at = v_inicio + make_interval(days => v_desfases[i])
    where id = v_clientes[i];
  end loop;

  -- Todos estos discos estaban disponibles al comenzar el periodo simulado.
  for i in 1..60 loop
    update public.productos
    set created_at = v_inicio - interval '1 day' + i * interval '1 minute'
    where id = v_productos[i];
  end loop;

  -- Semilla fija para obtener una distribución reproducible.
  perform setseed(0.314159);

  for i in 1..400 loop
    if i <= 320 then
      v_estado := 'recogida';
    elsif i <= 380 then
      v_estado := 'cancelada';
    else
      v_estado := 'pendiente';
    end if;

    v_cantidad := case when random() < 0.18 then 2 else 1 end;

    -- Asegurar al menos una compra para cada cliente.
    if i <= 15 then
      v_cliente := v_clientes[i];
      select created_at into v_alta
      from public.profiles where id = v_cliente;
      v_fecha := v_alta + (v_ahora - v_alta) * random();
    else
      if v_estado = 'pendiente' then
        v_fecha := v_ahora - interval '3 days' * random();
      elsif random() < 0.55 then
        v_fecha := v_ahora - interval '90 days' * random();
      else
        v_fecha := v_inicio + (v_ahora - v_inicio) * random();
      end if;

      -- Una reserva nunca es anterior al alta de su cliente.
      select id into v_cliente
      from public.profiles
      where id = any(v_clientes) and created_at <= v_fecha
      order by random()
      limit 1;
    end if;

    if v_estado = 'pendiente' then
      -- Solo las pendientes consumen unidades del stock actual de partida.
      select p.* into v_producto
      from public.productos p
      where p.id = any(v_productos) and p.stock >= v_cantidad
      order by random()
      limit 1;

      if not found then
        raise exception 'No hay suficientes existencias para las pendientes.';
      end if;

      update public.productos
      set stock = stock - v_cantidad
      where id = v_producto.id;
    else
      -- Garantizar que los 60 productos tengan historial.
      v_producto_id := v_productos[
        case when i <= 60 then i else 1 + floor(random() * 60)::integer end
      ];
      select p.* into v_producto
      from public.productos p
      where p.id = v_producto_id;
    end if;

    v_actualizacion := case
      when v_estado = 'pendiente' then v_fecha
      else least(v_ahora, v_fecha + interval '1 hour' + interval '4 days' * random())
    end;

    insert into public.reservas (
      usuario_id, producto_id, cantidad, precio_unitario,
      estado, solicitud_id, created_at, updated_at
    ) values (
      v_cliente, v_producto.id, v_cantidad, v_producto.precio,
      v_estado, gen_random_uuid(), v_fecha, v_actualizacion
    );
  end loop;

  insert into private.cargas_historial_demo (id, respaldo)
  values ('vinylstore-historial-v1', v_respaldo);
end;
$historial$;

-- Mostrar el alta de negocio del perfil, no el alta técnica de Supabase Auth.
create or replace function public.admin_consultar_clientes(
  p_cliente_id uuid default null
)
returns table (id uuid, nombre text, correo text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $clientes$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Solo el administrador puede consultar clientes.'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    case when trim(p.nombre) = '' then 'Sin nombre' else trim(p.nombre) end,
    u.email::text,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'cliente'
    and (p_cliente_id is null or p.id = p_cliente_id)
  order by lower(p.nombre), p.id;
end;
$clientes$;

select estado, count(*) as reservas, sum(cantidad) as unidades
from public.reservas
group by estado
order by estado;
`;

  await writeFile(new URL('historial-demo.sql', carpetaDatos), sql);
  console.log('Preparado: datos-importacion/historial-demo.sql');
  console.log('Este script no ha modificado Supabase.');
  console.log('Abre el SQL generado y ejecútalo completo en Supabase SQL Editor.');
}

prepararHistorial().catch((error) => {
  console.error(`No se ha preparado el historial: ${error.message}`);
  process.exitCode = 1;
});
