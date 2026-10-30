import { Injectable, inject } from '@angular/core';
import type { AsyncValidatorFn } from '@angular/forms';
import { catchError, map, of, switchMap, timeout, timer } from 'rxjs';

import { ProductosService } from './productos.service';

@Injectable({
  providedIn: 'root',
})
export class DisponibilidadService {
  private readonly productos = inject(ProductosService);

  crearValidador(
    obtenerProductoId: () => string | null,
  ): AsyncValidatorFn {
    return (control) => {
      const productoId = obtenerProductoId();
      const cantidad = Number(control.value);

      if (
        !productoId ||
        !Number.isInteger(cantidad) ||
        cantidad <= 0
      ) {
        return of(null);
      }

      return timer(350).pipe(
        switchMap(() =>
          this.productos.comprobarDisponibilidad(productoId, cantidad),
        ),
        map((disponible) => disponible ? null : { sinStock: true }),
        timeout(10000),
        catchError(() => of({ errorDisponibilidad: true })),
      );
    };
  }
}