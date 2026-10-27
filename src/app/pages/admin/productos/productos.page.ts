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
  readonly editando = signal<Producto | null>(null);
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
      this.productos.set(await this.servicio.listar(false));
    } catch {
      this.loadError.set(
        'No se han podido cargar los productos. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  editarProducto(producto: Producto): void {
    if (this.saving() || this.loading()) {
      return;
    }

    this.editando.set(producto);
    this.saveError.set('');
    this.successMessage.set('');

    this.form.reset({
      titulo: producto.titulo,
      artista: producto.artista,
      genero: producto.genero,
      precio: producto.precio,
      stock: producto.stock,
      descripcion: producto.descripcion,
      activo: producto.activo,
    });
  }

  cancelarEdicion(): void {
    if (this.saving()) {
      return;
    }

    this.editando.set(null);
    this.form.reset();
    this.saveError.set('');
    this.successMessage.set('');
  }

  async guardarProducto(): Promise<void> {
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
    const original = this.editando();

    const datos = {
      titulo: valores.titulo.trim(),
      artista: valores.artista.trim(),
      genero: valores.genero.trim(),
      precio: Number(valores.precio),
      stock: Number(valores.stock),
      descripcion: valores.descripcion.trim(),
      activo: valores.activo,
      imagen_path: original?.imagen_path ?? null,
    };

    this.saving.set(true);
    this.form.disable();

    try {
      const producto = original
        ? await this.servicio.actualizar(original.id, datos)
        : await this.servicio.crear(datos);

      this.productos.update((actuales) =>
        original
          ? actuales.map((actual) =>
              actual.id === producto.id ? producto : actual,
            )
          : [producto, ...actuales],
      );

      this.editando.set(null);
      this.form.reset();

      this.successMessage.set(
        original
          ? `Producto «${producto.titulo}» actualizado.`
          : `Producto «${producto.titulo}» creado.`,
      );
    } catch {
      this.saveError.set(
        'No se ha podido guardar el producto. Comprueba tu sesión y los datos.',
      );
    } finally {
      this.form.enable();
      this.saving.set(false);
    }
  }
}