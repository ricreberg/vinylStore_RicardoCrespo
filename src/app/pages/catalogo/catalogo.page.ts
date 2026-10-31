import { Component, computed, inject, signal } from '@angular/core';
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
  IonContent,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { AuthService } from '../../core/services/auth.service';
import { DisponibilidadService } from '../../core/services/disponibilidad.service';
import { PortadasService } from '../../core/services/portadas.service';
import { ProductosService } from '../../core/services/productos.service';
import type { Producto } from '../../core/services/productos.service';
import { ReservasService } from '../../core/services/reservas.service';

type OrdenCatalogo = 'recientes' | 'titulo' | 'precio-asc' | 'precio-desc';

@Component({
  selector: 'app-catalogo',
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonInput,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
})
export class CatalogoPage {
  private readonly productosService = inject(ProductosService);
  private readonly reservasService = inject(ReservasService);
  private readonly disponibilidad = inject(DisponibilidadService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  private readonly formatoPrecio = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  readonly auth = inject(AuthService);
  readonly portadas = inject(PortadasService);

  readonly productos = signal<Producto[]>([]);
  readonly seleccionado = signal<Producto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly reservaError = signal('');
  readonly successMessage = signal('');

  readonly busqueda = signal('');
  readonly genero = signal('');
  readonly soloDisponibles = signal(false);
  readonly orden = signal<OrdenCatalogo>('recientes');

  readonly generos = computed(() =>
    [...new Set(this.productos().map((producto) => producto.genero))]
      .sort((a, b) => a.localeCompare(b, 'es')),
  );

  readonly productosFiltrados = computed(() => {
    const consulta = this.normalizar(this.busqueda().trim());
    const genero = this.genero();

    const resultado = this.productos().filter((producto) => {
      const coincideBusqueda =
        !consulta ||
        this.normalizar(`${producto.titulo} ${producto.artista}`)
          .includes(consulta);

      const coincideGenero =
        !genero || producto.genero === genero;

      const coincideDisponibilidad =
        !this.soloDisponibles() || producto.stock > 0;

      return (
        coincideBusqueda &&
        coincideGenero &&
        coincideDisponibilidad
      );
    });

    switch (this.orden()) {
      case 'titulo':
        return resultado.sort((a, b) =>
          a.titulo.localeCompare(b.titulo, 'es'),
        );

      case 'precio-asc':
        return resultado.sort((a, b) => a.precio - b.precio);

      case 'precio-desc':
        return resultado.sort((a, b) => b.precio - a.precio);

      default:
        return resultado.sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        );
    }
  });

  readonly hayFiltros = computed(() =>
    this.busqueda().trim() !== '' ||
    this.genero() !== '' ||
    this.soloDisponibles() ||
    this.orden() !== 'recientes',
  );

  private ultimaSolicitud: {
    id: string;
    usuarioId: string;
    productoId: string;
    cantidad: number;
  } | null = null;

  readonly form = this.fb.nonNullable.group({
    cantidad: this.fb.nonNullable.control(1, {
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.pattern(/^\d+$/),
      ],
      asyncValidators: [
        this.disponibilidad.crearValidador(
          () => this.seleccionado()?.id ?? null,
        ),
      ],
      updateOn: 'blur',
    }),
  });

  get errorCantidad(): string {
    const cantidad = this.form.controls.cantidad;

    if (cantidad.hasError('errorDisponibilidad')) {
      return 'No se ha podido comprobar la disponibilidad. Cancela la selección y vuelve a intentarlo.';
    }

    if (cantidad.hasError('sinStock')) {
      return 'El producto no está disponible o no tiene suficientes unidades.';
    }

    return 'Introduce una cantidad entera mayor que cero.';
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.saving()) {
      this.seleccionado.set(null);
      this.reservaError.set('');
      this.successMessage.set('');
      await this.cargarProductos();
    }
  }

  actualizarBusqueda(event: Event): void {
    const campo = event.target;

    if (campo instanceof HTMLInputElement) {
      this.busqueda.set(campo.value);
    }
  }

  actualizarGenero(event: Event): void {
    const selector = event.target;

    if (selector instanceof HTMLSelectElement) {
      this.genero.set(selector.value);
    }
  }

  actualizarDisponibilidad(event: Event): void {
    const campo = event.target;

    if (campo instanceof HTMLInputElement) {
      this.soloDisponibles.set(campo.checked);
    }
  }

  actualizarOrden(event: Event): void {
    const selector = event.target;

    if (!(selector instanceof HTMLSelectElement)) {
      return;
    }

    const valor = selector.value;

    if (
      valor === 'recientes' ||
      valor === 'titulo' ||
      valor === 'precio-asc' ||
      valor === 'precio-desc'
    ) {
      this.orden.set(valor);
    }
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.genero.set('');
    this.soloDisponibles.set(false);
    this.orden.set('recientes');
  }

  formatearPrecio(precio: number): string {
    return this.formatoPrecio.format(precio);
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

      this.seleccionado.set(producto);
      this.form.reset({ cantidad: 1 });
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

    if (
      !producto ||
      this.saving() ||
      this.loading() ||
      this.form.pending
    ) {
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

  private normalizar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
  }
}