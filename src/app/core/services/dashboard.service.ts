import { Injectable, inject } from '@angular/core';

import { SupabaseService } from './supabase.service';
import type { Producto } from './productos.service';
import type { Reserva } from './reservas.service';

export type ProductoDashboard = Pick<Producto, 'id' | 'titulo' | 'artista' | 'stock' | 'activo'>;
export type ReservaDashboard = Pick<Reserva,
  'id' | 'producto_id' | 'cantidad' | 'precio_unitario' | 'estado' | 'created_at' | 'updated_at'>;

export interface DatosDashboard {
  productos: ProductoDashboard[];
  reservas: ReservaDashboard[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly tamanoPagina = 200;

  async obtenerDatos(): Promise<DatosDashboard> {
    const [productos, reservas] = await Promise.all([
      this.listarProductos(), this.listarReservas(),
    ]);
    return { productos, reservas };
  }

  private async listarProductos(): Promise<ProductoDashboard[]> {
    const resultado: ProductoDashboard[] = [];
    let total: number | null = null;

    while (total === null || resultado.length < total) {
      const desde = resultado.length;
      const { data, error, count } = await this.supabase
        .from('productos')
        .select('id, titulo, artista, stock, activo', { count: 'exact' })
        .order('id', { ascending: true })
        .range(desde, desde + this.tamanoPagina - 1)
        .overrideTypes<ProductoDashboard[], { merge: false }>();

      if (error) throw error;
      if (!data || count === null) throw new Error('No se ha recibido el listado completo de productos.');
      if (total !== null && total !== count) throw new Error('El catálogo ha cambiado durante la carga. Actualiza los datos.');
      total = count;
      if (data.length === 0 && resultado.length < total) throw new Error('La consulta de productos se ha interrumpido.');
      resultado.push(...data);
      if (resultado.length > total) throw new Error('El catálogo ha cambiado durante la carga.');
    }
    return resultado;
  }

  private async listarReservas(): Promise<ReservaDashboard[]> {
    const resultado: ReservaDashboard[] = [];
    let total: number | null = null;

    while (total === null || resultado.length < total) {
      const desde = resultado.length;
      const { data, error, count } = await this.supabase
        .from('reservas')
        .select('id, producto_id, cantidad, precio_unitario, estado, created_at, updated_at', { count: 'exact' })
        .order('id', { ascending: true })
        .range(desde, desde + this.tamanoPagina - 1)
        .overrideTypes<ReservaDashboard[], { merge: false }>();

      if (error) throw error;
      if (!data || count === null) throw new Error('No se ha recibido el listado completo de reservas.');
      if (total !== null && total !== count) throw new Error('Las reservas han cambiado durante la carga. Actualiza los datos.');
      total = count;
      // Avanzar por filas recibidas permite trabajar incluso con un límite menor a 200.
      if (data.length === 0 && resultado.length < total) throw new Error('La consulta de reservas se ha interrumpido.');
      resultado.push(...data);
      if (resultado.length > total) throw new Error('Las reservas han cambiado durante la carga.');
    }
    return resultado;
  }
}
