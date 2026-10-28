import { Injectable, inject } from '@angular/core';

import { ProductosService } from './productos.service';
import type { Producto } from './productos.service';
import { ReservasService } from './reservas.service';
import type { ReservaDetalle } from './reservas.service';

export interface DatosDashboard {
  productos: Producto[];
  reservas: ReservaDetalle[];
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly productosService = inject(ProductosService);
  private readonly reservasService = inject(ReservasService);

  async obtenerDatos(): Promise<DatosDashboard> {
    const [productos, reservas] = await Promise.all([
      this.productosService.listar(false),
      this.reservasService.listarTodas(),
    ]);

    return {
      productos,
      reservas,
    };
  }
}