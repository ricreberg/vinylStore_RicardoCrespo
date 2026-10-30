import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
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
  IonMenuButton,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { PortadasService } from '../../core/services/portadas.service';
import { ReservasService } from '../../core/services/reservas.service';
import type { ReservaDetalle } from '../../core/services/reservas.service';

@Component({
  selector: 'app-mis-reservas',
  templateUrl: './mis-reservas.page.html',
  styleUrls: ['./mis-reservas.page.scss'],
  imports: [
    CurrencyPipe,
    DatePipe,
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
    IonMenuButton,
    IonRow,
    IonTitle,
    IonToolbar,
  ],
})
export class MisReservasPage {
  private readonly servicio = inject(ReservasService);
  readonly portadas = inject(PortadasService);

  readonly reservas = signal<ReservaDetalle[]>([]);
  readonly loading = signal(true);
  readonly procesandoId = signal<string | null>(null);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly successMessage = signal('');

  async ionViewWillEnter(): Promise<void> {
    this.actionError.set('');
    this.successMessage.set('');
    await this.cargarReservas();
  }

  async cargarReservas(): Promise<void> {
    if (this.procesandoId()) {
      return;
    }

    this.loading.set(true);
    this.loadError.set('');

    try {
      this.reservas.set(await this.servicio.listarPropias());
    } catch {
      this.loadError.set(
        'No se han podido cargar tus reservas. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async cancelarReserva(reserva: ReservaDetalle): Promise<void> {
    if (
      this.procesandoId() ||
      this.loading() ||
      reserva.estado !== 'pendiente'
    ) {
      return;
    }

    this.procesandoId.set(reserva.id);
    this.actionError.set('');
    this.successMessage.set('');

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
        'Reserva cancelada. Las unidades se han devuelto a las existencias.',
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