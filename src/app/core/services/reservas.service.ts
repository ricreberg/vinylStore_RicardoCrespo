import { Injectable, inject } from '@angular/core';

import { SupabaseService } from './supabase.service';

export type EstadoReserva = 'pendiente' | 'recogida' | 'cancelada';

export interface Reserva {
  id: string;
  usuario_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  estado: EstadoReserva;
  solicitud_id: string;
  created_at: string;
  updated_at: string;
}

export interface ReservaDetalle extends Reserva {
  producto: {
    titulo: string;
    artista: string;
    imagen_path: string | null;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class ReservasService {
  private readonly supabase = inject(SupabaseService).client;

  async listarPropias(): Promise<ReservaDetalle[]> {
    const { data, error } = await this.supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!data.session) {
      throw new Error('Debes iniciar sesión para consultar tus reservas.');
    }

    return this.consultarReservas(data.session.user.id);
  }

  async listarTodas(): Promise<ReservaDetalle[]> {
    return this.consultarReservas();
  }

    async reservar(
    productoId: string,
    cantidad: number,
    solicitudId: string,
  ): Promise<Reserva> {
    const { data, error } = await this.supabase.rpc('crear_reserva', {
      p_producto_id: productoId,
      p_cantidad: cantidad,
      p_solicitud_id: solicitudId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.extraerReserva(data);
  }

  async cambiarEstado(
    reservaId: string,
    estado: 'cancelada' | 'recogida',
  ): Promise<Reserva> {
    const { data, error } = await this.supabase.rpc(
      'cambiar_estado_reserva',
      {
        p_reserva_id: reservaId,
        p_estado: estado,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return this.extraerReserva(data);
  }

  private async consultarReservas(
    usuarioId?: string,
  ): Promise<ReservaDetalle[]> {
    let consulta = this.supabase
      .from('reservas')
      .select(`
        *,
        producto:productos (
          titulo,
          artista,
          imagen_path
        )
      `)
      .order('created_at', { ascending: false });

    if (usuarioId) {
      consulta = consulta.eq('usuario_id', usuarioId);
    }

    const { data, error } = await consulta
      .overrideTypes<ReservaDetalle[], { merge: false }>();

    if (error) {
      throw error;
    }

    return data;
  }

    private extraerReserva(datos: unknown): Reserva {
    const fila: unknown = Array.isArray(datos)
      ? datos.length === 1
        ? datos[0]
        : null
      : datos;

    if (!this.esReserva(fila)) {
      throw new Error(
        'La respuesta de la reserva no tiene el formato esperado. Comprueba el listado antes de repetir la operación.',
      );
    }

    return fila;
  }

  private esReserva(valor: unknown): valor is Reserva {
    return (
      typeof valor === 'object' &&
      valor !== null &&
      'id' in valor &&
      typeof valor.id === 'string' &&
      'usuario_id' in valor &&
      typeof valor.usuario_id === 'string' &&
      'producto_id' in valor &&
      typeof valor.producto_id === 'string' &&
      'cantidad' in valor &&
      typeof valor.cantidad === 'number' &&
      'precio_unitario' in valor &&
      typeof valor.precio_unitario === 'number' &&
      'estado' in valor &&
      (
        valor.estado === 'pendiente' ||
        valor.estado === 'recogida' ||
        valor.estado === 'cancelada'
      ) &&
      'solicitud_id' in valor &&
      typeof valor.solicitud_id === 'string' &&
      'created_at' in valor &&
      typeof valor.created_at === 'string' &&
      'updated_at' in valor &&
      typeof valor.updated_at === 'string'
    );
  }
}