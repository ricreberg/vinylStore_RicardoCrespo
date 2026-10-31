import {
  Component,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonModal,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { PortadasService } from '../../../core/services/portadas.service';
import { ProductosService } from '../../../core/services/productos.service';
import type { Producto } from '../../../core/services/productos.service';

type FiltroPublicacion = 'todos' | 'publicados' | 'retirados';
type FiltroStock = 'todos' | 'disponibles' | 'bajo' | 'agotados';

@Component({
  selector: 'app-productos',
  templateUrl: './productos.page.html',
  styleUrls: ['./productos.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonInput,
    IonMenuButton,
    IonModal,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
})
export class ProductosPage implements OnDestroy {
  private readonly servicio = inject(ProductosService);
  private readonly alertas = inject(AlertController);
  private readonly fb = inject(FormBuilder);

  readonly portadas = inject(PortadasService);

  @ViewChild(IonModal)
  private modal?: IonModal;

  private rutaSubidaPendiente: string | null = null;
  private cierreTrasGuardar = false;

  private readonly moneda = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  readonly productos = signal<Producto[]>([]);
  readonly editando = signal<Producto | null>(null);
  readonly archivoSeleccionado = signal<File | null>(null);
  readonly vistaPrevia = signal<string | null>(null);
  readonly editorAbierto = signal(false);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly successMessage = signal('');

  readonly busqueda = signal('');
  readonly publicacion = signal<FiltroPublicacion>('todos');
  readonly filtroStock = signal<FiltroStock>('todos');
  readonly umbralStockBajo = 3;

  readonly resumen = computed(() => {
    const productos = this.productos();
    const publicados = productos.filter((producto) => producto.activo);

    return {
      total: productos.length,
      publicados: publicados.length,
      unidades: publicados.reduce(
        (total, producto) => total + producto.stock,
        0,
      ),
      stockBajo: publicados.filter(
        (producto) => producto.stock <= this.umbralStockBajo,
      ).length,
    };
  });

  readonly productosFiltrados = computed(() => {
    const consulta = this.normalizar(this.busqueda().trim());

    return this.productos().filter((producto) => {
      const coincideBusqueda =
        !consulta ||
        this.normalizar(
          `${producto.titulo} ${producto.artista} ${producto.genero}`,
        ).includes(consulta);

      const coincidePublicacion =
        this.publicacion() === 'todos' ||
        (this.publicacion() === 'publicados' && producto.activo) ||
        (this.publicacion() === 'retirados' && !producto.activo);

      const filtro = this.filtroStock();

      const coincideStock =
        filtro === 'todos' ||
        (filtro === 'disponibles' && producto.stock > 0) ||
        (filtro === 'bajo' &&
          producto.stock > 0 &&
          producto.stock <= this.umbralStockBajo) ||
        (filtro === 'agotados' && producto.stock === 0);

      return coincideBusqueda && coincidePublicacion && coincideStock;
    });
  });

  readonly hayFiltros = computed(() =>
    this.busqueda().trim() !== '' ||
    this.publicacion() !== 'todos' ||
    this.filtroStock() !== 'todos',
  );

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

  readonly puedeCerrarEditor = async (): Promise<boolean> => {
    if (this.cierreTrasGuardar) {
      return true;
    }

    if (this.saving()) {
      return false;
    }

    if (!this.form.dirty && !this.archivoSeleccionado()) {
      return true;
    }

    const alerta = await this.alertas.create({
      header: '¿Descartar los cambios?',
      message: 'Los cambios del formulario no se han guardado.',
      buttons: [
        {
          text: 'Seguir editando',
          role: 'cancel',
        },
        {
          text: 'Descartar',
          role: 'destructive',
        },
      ],
    });

    await alerta.present();

    const { role } = await alerta.onDidDismiss();

    return role === 'destructive';
  };

  async ionViewWillEnter(): Promise<void> {
    await this.cargarProductos();
  }

  ngOnDestroy(): void {
    this.liberarVistaPrevia();
  }

  async cargarProductos(): Promise<void> {
    if (this.saving() || this.editorAbierto()) {
      return;
    }

    this.loading.set(true);
    this.loadError.set('');

    try {
      this.productos.set(await this.servicio.listar(false));
    } catch {
      this.loadError.set(
        'No se han podido cargar los productos. Comprueba la conexión y vuelve a actualizar.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  actualizarBusqueda(event: Event): void {
    const campo = event.target;

    if (campo instanceof HTMLInputElement) {
      this.busqueda.set(campo.value);
    }
  }

  actualizarPublicacion(event: Event): void {
    const selector = event.target;

    if (!(selector instanceof HTMLSelectElement)) {
      return;
    }

    const valor = selector.value;

    if (
      valor === 'todos' ||
      valor === 'publicados' ||
      valor === 'retirados'
    ) {
      this.publicacion.set(valor);
    }
  }

  actualizarStock(event: Event): void {
    const selector = event.target;

    if (!(selector instanceof HTMLSelectElement)) {
      return;
    }

    const valor = selector.value;

    if (
      valor === 'todos' ||
      valor === 'disponibles' ||
      valor === 'bajo' ||
      valor === 'agotados'
    ) {
      this.filtroStock.set(valor);
    }
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.publicacion.set('todos');
    this.filtroStock.set('todos');
  }

  formatearPrecio(precio: number): string {
    return this.moneda.format(precio);
  }

  nuevoProducto(): void {
    if (this.saving() || this.loading() || this.editorAbierto()) {
      return;
    }

    this.editando.set(null);
    this.form.reset();
    this.descartarSeleccion();
    this.saveError.set('');
    this.successMessage.set('');
    this.editorAbierto.set(true);
  }

  editarProducto(producto: Producto): void {
    if (this.saving() || this.loading() || this.editorAbierto()) {
      return;
    }

    this.editando.set(producto);
    this.descartarSeleccion();
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

    this.editorAbierto.set(true);
  }

  async cerrarEditor(): Promise<void> {
    if (!this.saving()) {
      await this.modal?.dismiss();
    }
  }

  editorCerrado(): void {
    this.editorAbierto.set(false);
    this.editando.set(null);
    this.form.reset();
    this.archivoSeleccionado.set(null);
    this.rutaSubidaPendiente = null;
    this.liberarVistaPrevia();
    this.saveError.set('');
    this.cierreTrasGuardar = false;
  }

  seleccionarPortada(event: Event): void {
    const input = event.target;

    if (!(input instanceof HTMLInputElement) || this.saving()) {
      return;
    }

    const archivo = input.files?.[0];
    input.value = '';

    if (!archivo) {
      return;
    }

    const formatos = ['image/jpeg', 'image/png', 'image/webp'];

    if (!formatos.includes(archivo.type)) {
      this.saveError.set('Selecciona una imagen JPEG, PNG o WebP.');
      return;
    }

    if (archivo.size > 2097152) {
      this.saveError.set('La portada no puede superar los 2 MiB.');
      return;
    }

    this.liberarVistaPrevia();
    this.archivoSeleccionado.set(archivo);
    this.vistaPrevia.set(URL.createObjectURL(archivo));
    this.rutaSubidaPendiente = null;
    this.saveError.set('');
  }

  descartarSeleccion(): void {
    if (this.saving()) {
      return;
    }

    this.archivoSeleccionado.set(null);
    this.rutaSubidaPendiente = null;
    this.liberarVistaPrevia();
  }

  async guardarProducto(): Promise<void> {
    if (
      this.saving() ||
      this.loading() ||
      !this.editorAbierto()
    ) {
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
    const archivo = this.archivoSeleccionado();

    this.saving.set(true);
    this.form.disable();

    let fase: 'imagen' | 'producto' = 'imagen';

    try {
      let imagenPath = original?.imagen_path ?? null;

      if (archivo) {
        if (!this.rutaSubidaPendiente) {
          this.rutaSubidaPendiente = await this.portadas.subir(archivo);
        }

        imagenPath = this.rutaSubidaPendiente;
      }

      fase = 'producto';

      const datos = {
        titulo: valores.titulo.trim(),
        artista: valores.artista.trim(),
        genero: valores.genero.trim(),
        precio: Number(valores.precio),
        stock: Number(valores.stock),
        descripcion: valores.descripcion.trim(),
        activo: valores.activo,
        imagen_path: imagenPath,
      };

      const producto = original
        ? await this.servicio.actualizar(
            original.id,
            datos,
            original.stock,
          )
        : await this.servicio.crear(datos);

      this.productos.update((actuales) =>
        original
          ? actuales.map((actual) =>
              actual.id === producto.id ? producto : actual,
            )
          : [producto, ...actuales],
      );

      this.successMessage.set(
        original
          ? `Producto «${producto.titulo}» actualizado.`
          : `Producto «${producto.titulo}» creado.`,
      );

      this.cierreTrasGuardar = true;
      await this.modal?.dismiss();
    } catch (error: unknown) {
      if (fase === 'imagen') {
        this.saveError.set(
          error instanceof Error
            ? `No se ha podido subir la portada: ${error.message}`
            : 'No se ha podido subir la portada.',
        );
      } else {
        this.saveError.set(
          error instanceof Error
            ? error.message
            : 'No se ha podido guardar el producto. Revisa su estado antes de volver a intentarlo.',
        );
      }
    } finally {
      this.form.enable();
      this.saving.set(false);
      this.cierreTrasGuardar = false;
    }
  }

  private liberarVistaPrevia(): void {
    const url = this.vistaPrevia();

    if (url) {
      URL.revokeObjectURL(url);
      this.vistaPrevia.set(null);
    }
  }

  private normalizar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
  }
}