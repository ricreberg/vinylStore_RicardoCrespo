import type { DatosDashboard } from '../services/dashboard.service';

export type PeriodoRapido = 7 | 30 | 90 | 365 | 'todo';

export interface PeriodoInforme {
  desde: string;
  hasta: string;
  agrupacion: 'diaria' | 'mensual';
}

export interface ActividadPeriodo {
  fecha: string;
  cantidad: number;
  compras: number;
  ventas: number;
}

export interface ResumenDashboard {
  productos: number;
  activos: number;
  stock: number;
  reservas: number;
  pendientes: number;
  compras: number;
  cancelaciones: number;
  importeRecogidas: number;
}

// Las fechas de los calendarios se interpretan en hora local, sin pasar por UTC.
export function fechaLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export function leerFechaLocal(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(0);
  fecha.setFullYear(anio, mes - 1, dia);
  fecha.setHours(0, 0, 0, 0);
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia
    ? fecha : null;
}

export function validarPeriodo(desde: string, hasta: string, hoy = new Date()): string {
  if (!desde || !hasta) return 'Selecciona la fecha inicial y la final.';
  const inicio = leerFechaLocal(desde);
  const final = leerFechaLocal(hasta);
  if (!inicio || !final) return 'Introduce fechas válidas.';
  if (desde > hasta) return 'La fecha inicial no puede ser posterior a la final.';
  if (hasta > fechaLocal(hoy)) return 'No puedes seleccionar fechas futuras.';
  return '';
}

export function crearPeriodo(desde: string, hasta: string): PeriodoInforme {
  const inicio = leerFechaLocal(desde);
  const final = leerFechaLocal(hasta);
  if (!inicio || !final || desde > hasta) throw new Error('Intervalo no válido.');
  // Contamos días del calendario; los cambios de hora no alteran el resultado.
  const dias = (Date.UTC(final.getFullYear(), final.getMonth(), final.getDate())
    - Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) / 86400000 + 1;
  return { desde, hasta, agrupacion: dias <= 90 ? 'diaria' : 'mensual' };
}

export function periodoRapido(
  opcion: PeriodoRapido,
  reservas: DatosDashboard['reservas'],
  hoy = new Date(),
): PeriodoInforme {
  const inicio = new Date(hoy);
  if (opcion === 'todo') {
    for (const reserva of reservas) {
      const fecha = new Date(reserva.created_at);
      if (fecha < inicio) inicio.setTime(fecha.getTime());
    }
  } else {
    inicio.setDate(inicio.getDate() - opcion + 1);
  }
  return crearPeriodo(fechaLocal(inicio), fechaLocal(hoy));
}

export function etiquetaPeriodo(periodo: PeriodoInforme): string {
  const mostrar = (valor: string) => valor.split('-').reverse().join('/');
  return `${mostrar(periodo.desde)} - ${mostrar(periodo.hasta)}`;
}

export function calcularDashboard(datos: DatosDashboard, periodo: PeriodoInforme, umbralStockBajo = 3) {
  const inicio = leerFechaLocal(periodo.desde);
  const fin = leerFechaLocal(periodo.hasta);
  if (!inicio || !fin) throw new Error('Intervalo no válido.');
  // El límite superior es el comienzo del día siguiente, también en hora local.
  fin.setDate(fin.getDate() + 1);
  const dentro = (valor: string) => {
    const instante = new Date(valor).getTime();
    return instante >= inicio.getTime() && instante < fin.getTime();
  };

  const creadas = datos.reservas.filter((reserva) => dentro(reserva.created_at));
  const compras = datos.reservas.filter((reserva) =>
    reserva.estado === 'recogida' && dentro(reserva.updated_at));
  const cancelaciones = datos.reservas.filter((reserva) =>
    reserva.estado === 'cancelada' && dentro(reserva.updated_at));
  const activos = datos.productos.filter((producto) => producto.activo);
  const centimos = (precio: number, cantidad: number) => Math.round(precio * 100) * cantidad;

  const resumen: ResumenDashboard = {
    productos: datos.productos.length,
    activos: activos.length,
    stock: activos.reduce((total, producto) => total + producto.stock, 0),
    reservas: creadas.length,
    pendientes: creadas.filter((reserva) => reserva.estado === 'pendiente').length,
    compras: compras.length,
    cancelaciones: cancelaciones.length,
    importeRecogidas: compras.reduce((total, reserva) =>
      total + centimos(reserva.precio_unitario, reserva.cantidad), 0) / 100,
  };

  // El anillo describe el estado ACTUAL de las reservas creadas en el intervalo.
  const estados = [
    { etiqueta: 'Pendientes', cantidad: resumen.pendientes },
    { etiqueta: 'Recogidas', cantidad: creadas.filter((r) => r.estado === 'recogida').length },
    { etiqueta: 'Canceladas', cantidad: creadas.filter((r) => r.estado === 'cancelada').length },
  ];

  const clave = (fecha: Date) => periodo.agrupacion === 'mensual'
    ? fechaLocal(fecha).slice(0, 7) : fechaLocal(fecha);
  const grupos = new Map<string, ActividadPeriodo>();
  const cursor = new Date(inicio);
  if (periodo.agrupacion === 'mensual') cursor.setDate(1);
  while (cursor < fin) {
    grupos.set(clave(cursor), {
      fecha: cursor.toLocaleDateString('es-ES', periodo.agrupacion === 'mensual'
        ? { month: 'short', year: 'numeric' }
        : { day: '2-digit', month: '2-digit', year: 'numeric' }),
      cantidad: 0, compras: 0, ventas: 0,
    });
    if (periodo.agrupacion === 'mensual') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  for (const reserva of creadas) {
    const grupo = grupos.get(clave(new Date(reserva.created_at)));
    if (grupo) grupo.cantidad++;
  }
  // Acumular dinero en céntimos para evitar errores de coma flotante.
  for (const reserva of compras) {
    const grupo = grupos.get(clave(new Date(reserva.updated_at)));
    if (grupo) {
      grupo.compras++;
      grupo.ventas += centimos(reserva.precio_unitario, reserva.cantidad);
    }
  }
  const actividad = [...grupos.values()].map((grupo) => ({
    ...grupo, ventas: grupo.ventas / 100,
  }));

  const productosPorId = new Map(datos.productos.map((producto) => [producto.id, producto]));
  const unidades = new Map<string, number>();
  for (const reserva of creadas) {
    if (reserva.estado !== 'cancelada') {
      unidades.set(reserva.producto_id, (unidades.get(reserva.producto_id) ?? 0) + reserva.cantidad);
    }
  }
  const masReservados = [...unidades.entries()]
    .map(([id, cantidad]) => ({
      id, titulo: productosPorId.get(id)?.titulo ?? 'Producto no disponible',
      artista: productosPorId.get(id)?.artista ?? '', unidades: cantidad,
    }))
    .sort((a, b) => b.unidades - a.unidades || a.titulo.localeCompare(b.titulo, 'es'))
    .slice(0, 5);
  const recientes = [...creadas]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((reserva) => ({
      id: reserva.id,
      titulo: productosPorId.get(reserva.producto_id)?.titulo ?? 'Producto no disponible',
      cantidad: reserva.cantidad, estado: reserva.estado, fecha: reserva.created_at,
    }));

  return {
    resumen, estados, actividad, masReservados, recientes,
    stockBajo: activos.filter((producto) => producto.stock <= umbralStockBajo)
      .sort((a, b) => a.stock - b.stock || a.titulo.localeCompare(b.titulo, 'es')),
  };
}
