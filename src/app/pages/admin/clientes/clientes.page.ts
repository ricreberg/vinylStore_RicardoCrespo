import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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

@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.page.html',
  styleUrls: ['./clientes.page.scss'],
  imports: [
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
export class ClientesPage {
  private readonly servicio = inject(ClientesService);

  readonly clientes = signal<Cliente[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  async ionViewWillEnter(): Promise<void> {
    await this.cargarClientes();
  }

  async cargarClientes(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      this.clientes.set(await this.servicio.listar());
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'No se han podido cargar los clientes.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}