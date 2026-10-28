import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
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

import { ClientesService } from '../../../core/services/clientes.service';
import type { Cliente } from '../../../core/services/clientes.service';
import { ReservasService } from '../../../core/services/reservas.service';
import type { ReservaDetalle } from '../../../core/services/reservas.service';

@Component({
  selector: 'app-cliente-detalle',
  templateUrl: './cliente-detalle.page.html',
  styleUrls: ['./cliente-detalle.page.scss'],
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
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
export class ClienteDetallePage {
  private readonly ruta = inject(ActivatedRoute);
  private readonly clientesService = inject(ClientesService);
  private readonly reservasService = inject(ReservasService);

  readonly cliente = signal<Cliente | null>(null);
  readonly reservas = signal<ReservaDetalle[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  async ionViewWillEnter(): Promise<void> {
    await this.cargarFicha();
  }

  async cargarFicha(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    this.cliente.set(null);
    this.reservas.set([]);

    const clienteId = this.ruta.snapshot.paramMap.get('id');

    if (
      !clienteId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(clienteId)
    ) {
      this.errorMessage.set('La dirección del cliente no es válida.');
      this.loading.set(false);
      return;
    }

    try {
      const [cliente, reservas] = await Promise.all([
        this.clientesService.obtener(clienteId),
        this.reservasService.listarDeCliente(clienteId),
      ]);

      this.cliente.set(cliente);
      this.reservas.set(reservas);
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No se ha podido cargar la ficha del cliente.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}