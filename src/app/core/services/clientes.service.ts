import { Injectable, inject } from '@angular/core';

import { SupabaseService } from './supabase.service';

export interface Cliente {
  id: string;
  nombre: string;
  correo: string | null;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class ClientesService {
  private readonly supabase = inject(SupabaseService).client;

  async listar(): Promise<Cliente[]> {
    return this.consultar(null);
  }

  async obtener(clienteId: string): Promise<Cliente> {
    const clientes = await this.consultar(clienteId);
    const cliente = clientes[0];

    if (!cliente || clientes.length !== 1) {
      throw new Error('No se ha encontrado el cliente.');
    }

    return cliente;
  }

  private async consultar(
    clienteId: string | null,
  ): Promise<Cliente[]> {
    const { data, error } = await this.supabase.rpc(
      'admin_consultar_clientes',
      {
        p_cliente_id: clienteId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    const resultado: unknown = data;

    if (!Array.isArray(resultado)) {
      throw new Error('La respuesta del listado no tiene el formato esperado.');
    }

    return resultado.map((fila: unknown) => this.leerCliente(fila));
  }

  private leerCliente(valor: unknown): Cliente {
    if (
      typeof valor !== 'object' ||
      valor === null ||
      !('id' in valor) ||
      typeof valor.id !== 'string' ||
      !('nombre' in valor) ||
      typeof valor.nombre !== 'string' ||
      !('correo' in valor) ||
      (valor.correo !== null && typeof valor.correo !== 'string') ||
      !('created_at' in valor) ||
      typeof valor.created_at !== 'string'
    ) {
      throw new Error('Los datos de un cliente no tienen el formato esperado.');
    }

    return {
      id: valor.id,
      nombre: valor.nombre,
      correo: valor.correo,
      created_at: valor.created_at,
    };
  }
}