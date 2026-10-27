import { CurrencyPipe } from '@angular/common';
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

import { ProductosService } from '../../core/services/productos.service';
import type { Producto } from '../../core/services/productos.service';

@Component({
  selector: 'app-catalogo',
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
  imports: [
    CurrencyPipe,
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
export class CatalogoPage {
  private readonly servicio = inject(ProductosService);

  readonly productos = signal<Producto[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  async ionViewWillEnter(): Promise<void> {
    await this.cargarProductos();
  }

  async cargarProductos(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const productos = await this.servicio.listar();
      this.productos.set(productos);
    } catch {
      this.errorMessage.set(
        'No se ha podido cargar el catálogo. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}