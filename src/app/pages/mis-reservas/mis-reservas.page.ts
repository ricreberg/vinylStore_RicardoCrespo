import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { PortadasService } from '../../core/services/portadas.service';
import { ReservasService } from '../../core/services/reservas.service';
import type {
  EstadoReserva,
  ReservaDetalle,
} from '../../core/services/reservas.service';

type VistaReservas = 'todas' | 'pendientes' | 'historial';

@Component({
  selector: 'app-mis-reservas',
  templateUrl: './mis-reservas.page.html',
  styleUrls: ['./mis-reservas.page.scss'],
  imports: [
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
})
export class MisReservasPage {
  private readonly servicio = inject(ReservasService);
  private readonly alertas = inject(AlertController);

  readonly portadas = inject(PortadasService);

  private readonly moneda = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private peticion = 0;

  readonly reservas = signal<ReservaDetalle[]>([]);
  readonly loading = signal(true);
  readonly confirmando = signal(false);
  readonly procesandoId = signal<string | null>(null);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly successMessage = signal('');
  readonly vista = signal<VistaReservas>('todas');

  readonly opciones: {
    valor: VistaReservas;
    etiqueta: string;
  }[] = [
    { valor: 'todas', etiqueta: 'Todas' },
    { valor: 'pendientes', etiqueta: 'Pendientes' },
    { valor: 'historial', etiqueta: 'Historial' },
  ];

  readonly conteos = computed(() => {
    const reservas = this.reservas();

    return {
      todas: reservas.length,
      pendientes: reservas.filter(
        (reserva) => reserva.estado === 'pendiente',
      ).length,
      historial: reservas.filter(
        (reserva) => reserva.estado !== 'pendiente',
      ).length,
    };
  });

  readonly reservasFiltradas = computed(() =>
    this.reservas()
      .filter((reserva) => {
        switch (this.vista()) {
          case 'pendientes':
            return reserva.estado === 'pendiente';
          case 'historial':
            return reserva.estado !== 'pendiente';
          default:
            return true;
        }
      })
      .sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
  );

  readonly bloqueado = computed(() =>
    this.loading() ||
    this.confirmando() ||
    this.procesandoId() !== null,
  );

  async ionViewWillEnter(): Promise<void> {
    this.actionError.set('');
    this.successMessage.set('');
    await this.cargarReservas();
  }

  ionViewWillLeave(): void {
    ++this.peticion;
  }

  async cargarReservas(): Promise<void> {
    if (this.procesandoId() || this.confirmando()) {
      return;
    }

    const peticion = ++this.peticion;

    this.loading.set(true);
    this.loadError.set('');

    try {
      const reservas = await this.servicio.listarPropias();

      if (peticion === this.peticion) {
        this.reservas.set(reservas);
      }
    } catch {
      if (peticion === this.peticion) {
        this.loadError.set(
          'No se han podido cargar tus reservas. Comprueba la conexión y vuelve a actualizar.',
        );
      }
    } finally {
      if (peticion === this.peticion) {
        this.loading.set(false);
      }
    }
  }

  cambiarVista(vista: VistaReservas): void {
    if (!this.bloqueado()) {
      this.vista.set(vista);
    }
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatearPrecio(precio: number): string {
    return this.moneda.format(precio);
  }

  formatearTotal(reserva: ReservaDetalle): string {
    const centimos =
      Math.round(reserva.precio_unitario * 100) * reserva.cantidad;

    return this.moneda.format(centimos / 100);
  }

  nombreEstado(estado: EstadoReserva): string {
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'recogida':
        return 'Recogida';
      case 'cancelada':
        return 'Cancelada';
    }
  }

  async cancelarReserva(reserva: ReservaDetalle): Promise<void> {
    if (this.bloqueado() || reserva.estado !== 'pendiente') {
      return;
    }

    this.confirmando.set(true);
    this.actionError.set('');
    this.successMessage.set('');

    let confirmado = false;

    try {
      const alerta = await this.alertas.create({
        header: '¿Cancelar esta reserva?',
        message:
          'La solicitud quedará cancelada y las unidades volverán a estar disponibles en la tienda.',
        buttons: [
          {
            text: 'Conservar reserva',
            role: 'cancel',
          },
          {
            text: 'Cancelar reserva',
            role: 'confirm',
          },
        ],
      });

      await alerta.present();

      const { role } = await alerta.onDidDismiss();
      confirmado = role === 'confirm';
    } catch {
      this.actionError.set(
        'No se ha podido abrir la confirmación. Inténtalo de nuevo.',
      );
    } finally {
      this.confirmando.set(false);
    }

    if (!confirmado) {
      return;
    }

    this.procesandoId.set(reserva.id);

    try {
      const actualizada = await this.servicio.cambiarEstado(
        reserva.id,
        'cancelada',
      );

      this.reservas.update((actuales) =>
        actuales.map((actual) =>
          actual.id === actualizada.id
            ? { ...actual, ...actualizada }
            : actual,
        ),
      );

      this.successMessage.set(
        `Reserva ${reserva.id.slice(0, 8)} cancelada. Puedes consultarla en el historial.`,
      );
    } catch (error: unknown) {
      this.actionError.set(
        error instanceof Error
          ? error.message
          : 'No se ha podido cancelar la reserva. Actualiza el listado para comprobar su estado.',
      );
    } finally {
      this.procesandoId.set(null);
    }
  }
}