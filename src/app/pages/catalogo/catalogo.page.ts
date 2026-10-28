import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { AuthService } from '../../core/services/auth.service';
import { PortadasService } from '../../core/services/portadas.service';
import { ProductosService } from '../../core/services/productos.service';
import type { Producto } from '../../core/services/productos.service';
import { ReservasService } from '../../core/services/reservas.service';

@Component({
  selector: 'app-catalogo',
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonInput,
    IonMenuButton,
    IonRow,
    IonTitle,
    IonToolbar,
  ],
})
export class CatalogoPage {
  private readonly productosService = inject(ProductosService);
  private readonly reservasService = inject(ReservasService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly auth = inject(AuthService);
  readonly portadas = inject(PortadasService);

  readonly productos = signal<Producto[]>([]);
  readonly seleccionado = signal<Producto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly reservaError = signal('');
  readonly successMessage = signal('');

  private ultimaSolicitud: {
    id: string;
    usuarioId: string;
    productoId: string;
    cantidad: number;
  } | null = null;

  readonly form = this.fb.nonNullable.group({
    cantidad: [
      1,
      [
        Validators.required,
        Validators.min(1),
        Validators.pattern(/^\d+$/),
      ],
    ],
  });

  async ionViewWillEnter(): Promise<void> {
    if (!this.saving()) {
      this.seleccionado.set(null);
      this.reservaError.set('');
      this.successMessage.set('');
      await this.cargarProductos();
    }
  }

  async cargarProductos(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.loading.set(true);
    this.loadError.set('');

    try {
      this.productos.set(await this.productosService.listar());
    } catch {
      this.loadError.set(
        'No se ha podido cargar el catálogo. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async prepararReserva(producto: Producto): Promise<void> {
    if (this.saving() || this.loading()) {
      return;
    }

    this.reservaError.set('');
    this.successMessage.set('');

    try {
      const { data, error } = await this.auth.getSession();

      if (error) {
        throw error;
      }

      if (!data.session) {
        await this.router.navigate(['/login']);
        return;
      }

      if (producto.stock <= 0) {
        this.reservaError.set('Este producto no tiene existencias.');
        return;
      }

      this.form.controls.cantidad.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(producto.stock),
        Validators.pattern(/^\d+$/),
      ]);

      this.form.reset({ cantidad: 1 });
      this.seleccionado.set(producto);
    } catch {
      this.reservaError.set('No se ha podido comprobar tu sesión.');
    }
  }

  cancelarSeleccion(): void {
    if (!this.saving()) {
      this.seleccionado.set(null);
      this.reservaError.set('');
    }
  }

  async confirmarReserva(): Promise<void> {
    const producto = this.seleccionado();

    if (!producto || this.saving() || this.loading()) {
      return;
    }

    this.reservaError.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const cantidad = Number(this.form.getRawValue().cantidad);

    this.saving.set(true);
    this.form.disable();

    try {
      const { data, error } = await this.auth.getSession();

      if (error) {
        throw error;
      }

      if (!data.session) {
        await this.router.navigate(['/login']);
        return;
      }

      const usuarioId = data.session.user.id;
      const anterior = this.ultimaSolicitud;

      if (
        !anterior ||
        anterior.usuarioId !== usuarioId ||
        anterior.productoId !== producto.id ||
        anterior.cantidad !== cantidad
      ) {
        this.ultimaSolicitud = {
          id: crypto.randomUUID(),
          usuarioId,
          productoId: producto.id,
          cantidad,
        };
      }

      const solicitud = this.ultimaSolicitud;

      if (!solicitud) {
        throw new Error('No se ha podido preparar la solicitud.');
      }

      const reserva = await this.reservasService.reservar(
        producto.id,
        cantidad,
        solicitud.id,
      );

      this.ultimaSolicitud = null;
      this.seleccionado.set(null);
      this.successMessage.set(
        `Solicitud registrada. Estado de la reserva: ${reserva.estado}.`,
      );
    } catch (error: unknown) {
      this.reservaError.set(
        error instanceof Error
          ? error.message
          : 'No se ha podido confirmar la reserva. Comprueba Mis reservas antes de reintentar.',
      );
    } finally {
      this.form.enable();
      this.saving.set(false);
    }

    await this.cargarProductos();
  }
}