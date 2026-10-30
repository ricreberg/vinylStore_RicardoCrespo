import { Injectable, inject } from '@angular/core';

import { SupabaseService } from './supabase.service';

export interface Producto {
  id: string;
  titulo: string;
  artista: string;
  genero: string;
  precio: number;
  stock: number;
  descripcion: string;
  imagen_path: string | null;
  activo: boolean;
  created_at: string;
}

export type NuevoProducto = Omit<Producto, 'id' | 'created_at'>;

export type CambiosProducto = Partial<NuevoProducto>;

@Injectable({
  providedIn: 'root',
})
export class ProductosService {
  private readonly supabase = inject(SupabaseService).client;

  async listar(soloActivos = true): Promise<Producto[]> {
    let consulta = this.supabase
      .from('productos')
      .select('*')
      .order('created_at', { ascending: false });

    if (soloActivos) {
      consulta = consulta.eq('activo', true);
    }

    const { data, error } = await consulta
      .overrideTypes<Producto[], { merge: false }>();

    if (error) {
      throw error;
    }

    return data;
  }

      async crear(producto: NuevoProducto): Promise<Producto> {
    const { data, error } = await this.supabase
      .from('productos')
      .insert({ ...producto })
      .select()
      .overrideTypes<Producto[], { merge: false }>();

    if (error) {
      throw error;
    }

    const creado = data?.[0];

    if (!creado || data.length !== 1) {
      throw new Error('No se ha recibido un único producto creado.');
    }

    return creado;
  }

    async actualizar(
    id: string,
    cambios: CambiosProducto,
    stockEsperado: number,
  ): Promise<Producto> {
    const { stock, ...otrosCambios } = cambios;

    const cambiaStock =
      stock !== undefined && stock !== stockEsperado;

    const valores = cambiaStock
      ? { ...otrosCambios, stock }
      : otrosCambios;

    let consulta = this.supabase
      .from('productos')
      .update(valores)
      .eq('id', id);

    if (cambiaStock) {
      consulta = consulta.eq('stock', stockEsperado);
    }

    const { data, error } = await consulta
      .select()
      .overrideTypes<Producto[], { merge: false }>();

    if (error) {
      throw error;
    }

    const actualizado = data?.[0];

    if (!actualizado) {
      throw new Error(
        cambiaStock
          ? 'No se han guardado los cambios. Las existencias pueden haber cambiado. Actualiza el listado y vuelve a abrir la edición para revisarlas.'
          : 'No se ha podido actualizar el producto. Comprueba que existe y que tienes permisos.',
      );
    }

    if (data.length !== 1) {
      throw new Error('No se ha recibido un único producto actualizado.');
    }

    return actualizado;
  }
}