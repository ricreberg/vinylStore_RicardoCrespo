import { Injectable, inject } from '@angular/core';

import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class PortadasService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly bucket = 'portadas';
  private readonly limiteBytes = 2 * 1024 * 1024;

  private readonly extensiones: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  async subir(archivo: File): Promise<string> {
    const extension = this.extensiones[archivo.type];

    if (!extension) {
      throw new Error('Selecciona una imagen JPEG, PNG o WebP.');
    }

    if (archivo.size === 0) {
      throw new Error('El archivo está vacío.');
    }

    if (archivo.size > this.limiteBytes) {
      throw new Error('La imagen no puede superar los 2 MiB.');
    }

    const ruta = `${crypto.randomUUID()}.${extension}`;

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(ruta, archivo, {
        contentType: archivo.type,
        upsert: false,
      });

    if (error) {
      throw error;
    }

    return data.path;
  }

  obtenerUrl(ruta: string): string {
    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(ruta);

    return data.publicUrl;
  }

  async eliminar(ruta: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([ruta]);

    if (error) {
      throw error;
    }
  }
}