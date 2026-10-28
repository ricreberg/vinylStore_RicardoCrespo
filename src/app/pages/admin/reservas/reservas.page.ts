import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

import { ReservasService } from '../../../core/services/reservas.service';
import type {
  EstadoReserva,
  ReservaDetalle,
} from '../../../core/services/reservas.service';

@Component({
  selector: 'app-reservas',
  templateUrl: './reservas.page.html',
  styleUrls: ['./reservas.page.scss'],
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
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
export class ReservasPage {
  private readonly servicio = inject(ReservasService);

  readonly reservas = signal<ReservaDetalle[]>([]);
  readonly loading = signal(true);
  readonly procesandoId = signal<string | null>(null);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly successMessage = signal('');

  filtro: 'todas' | EstadoReserva = 'todas';

  get reservasFiltradas(): ReservaDetalle[] {
    const reservas = this.reservas();

    return this.filtro === 'todas'
      ? reservas
      : reservas.filter((reserva) => reserva.estado === this.filtro);
  }

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
      this.reservas.set(await this.servicio.listarTodas());
    } catch {
      this.loadError.set(
        'No se han podido cargar las reservas. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async cambiarEstado(
    reserva: ReservaDetalle,
    estado: 'cancelada' | 'recogida',
  ): Promise<void> {
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
        estado,
      );

      this.reservas.update((actuales) =>
        actuales.map((actual) =>
          actual.id === actualizada.id
            ? { ...actual, ...actualizada }
            : actual,
        ),
      );

      this.successMessage.set(
        actualizada.estado === 'recogida'
          ? 'Reserva marcada como recogida.'
          : 'Reserva cancelada. Las unidades se han devuelto a las existencias.',
      );
    } catch (error: unknown) {
      this.actionError.set(
        error instanceof Error
          ? error.message
          : 'No se ha podido cambiar el estado. Actualiza el listado para comprobarlo.',
      );
    } finally {
      this.procesandoId.set(null);
    }
  }
}