import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCheckbox,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonRow,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { ProductosService } from '../../../core/services/productos.service';
import type { Producto } from '../../../core/services/productos.service';

@Component({
  selector: 'app-productos',
  templateUrl: './productos.page.html',
  styleUrls: ['./productos.page.scss'],
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
    IonCheckbox,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonInput,
    IonMenuButton,
    IonRow,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
})
export class ProductosPage {
  private readonly servicio = inject(ProductosService);
  private readonly fb = inject(FormBuilder);

  readonly productos = signal<Producto[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly successMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.pattern(/\S/)]],
    artista: ['', [Validators.required, Validators.pattern(/\S/)]],
    genero: ['', [Validators.required, Validators.pattern(/\S/)]],
    precio: [
      0,
      [
        Validators.required,
        Validators.min(0),
        Validators.max(99999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    ],
    stock: [
      0,
      [
        Validators.required,
        Validators.min(0),
        Validators.max(2147483647),
        Validators.pattern(/^\d+$/),
      ],
    ],
    descripcion: [''],
    activo: [true],
  });

  async ionViewWillEnter(): Promise<void> {
    await this.cargarProductos();
  }

  async cargarProductos(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.loading.set(true);
    this.loadError.set('');

    try {
      const productos = await this.servicio.listar(false);
      this.productos.set(productos);
    } catch {
      this.loadError.set(
        'No se han podido cargar los productos. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async crearProducto(): Promise<void> {
    if (this.saving() || this.loading()) {
      return;
    }

    this.saveError.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();

    this.saving.set(true);
    this.form.disable();

    try {
      const producto = await this.servicio.crear({
        titulo: valores.titulo.trim(),
        artista: valores.artista.trim(),
        genero: valores.genero.trim(),
        precio: Number(valores.precio),
        stock: Number(valores.stock),
        descripcion: valores.descripcion.trim(),
        activo: valores.activo,
        imagen_path: null,
      });

      this.productos.update((actuales) => [producto, ...actuales]);
      this.form.reset();
      this.successMessage.set(`Producto «${producto.titulo}» creado.`);
    } catch {
      this.saveError.set(
        'No se ha podido crear el producto. Comprueba tu sesión y los datos.',
      );
    } finally {
      this.form.enable();
      this.saving.set(false);
    }
  }
}