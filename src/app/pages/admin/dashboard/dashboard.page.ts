import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import {
  ArcElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

import { DashboardService } from '../../../core/services/dashboard.service';
import type { DatosDashboard } from '../../../core/services/dashboard.service';
import { InformesService } from '../../../core/services/informes.service';
import type { DatosInforme } from '../../../core/services/informes.service';

interface ProductoDestacado {
  id: string;
  titulo: string;
  artista: string;
  unidades: number;
}

interface ReservaReciente {
  id: string;
  titulo: string;
  cantidad: number;
  estado: string;
  fecha: string;
}

Chart.register(
  ArcElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
})
export class DashboardPage implements OnDestroy {
  private readonly servicio = inject(DashboardService);
  private readonly informes = inject(InformesService);
  private readonly detector = inject(ChangeDetectorRef);

  private readonly moneda = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  @ViewChild('canvasActividad', { static: true })
  private canvasActividad!: ElementRef<HTMLCanvasElement>;

  @ViewChild('canvasEstados', { static: true })
  private canvasEstados!: ElementRef<HTMLCanvasElement>;

  private graficoActividad: Chart<'line', number[], string> | null = null;
  private graficoEstados: Chart<'doughnut', number[], string> | null = null;

  private datos: DatosDashboard | null = null;
  private activa = false;
  private peticion = 0;

  readonly periodos = [7, 14, 30];
  readonly umbralStockBajo = 3;
  readonly coloresEstados = ['#956615', '#455b4c', '#782c40'];

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly exportando = signal(false);
  readonly exportError = signal('');
  readonly dias = signal(7);
  readonly ultimaActualizacion = signal('');

  readonly resumen = signal({
    productos: 0,
    activos: 0,
    stock: 0,
    reservas: 0,
    pendientes: 0,
    importeRecogidas: 0,
  });

  readonly actividad = signal<
    { fecha: string; cantidad: number }[]
  >([]);

  readonly estados = signal<
    { etiqueta: string; cantidad: number }[]
  >([]);

  readonly stockBajo = signal<DatosDashboard['productos']>([]);
  readonly masReservados = signal<ProductoDestacado[]>([]);
  readonly recientes = signal<ReservaReciente[]>([]);

  readonly indicadores = computed(() => {
    const resumen = this.resumen();

    return [
      {
        titulo: 'Reservas creadas',
        valor: String(resumen.reservas),
        detalle: `Últimos ${this.dias()} días, incluido hoy`,
        destacada: true,
      },
      {
        titulo: 'Todavía pendientes',
        valor: String(resumen.pendientes),
        detalle: 'De las reservas creadas en el periodo',
        destacada: false,
      },
      {
        titulo: 'Valor de recogidas',
        valor: this.moneda.format(resumen.importeRecogidas),
        detalle: 'Del periodo; no representa cobros',
        destacada: false,
      },
      {
        titulo: 'Unidades disponibles',
        valor: String(resumen.stock),
        detalle: 'Stock actual de productos publicados',
        destacada: false,
      },
      {
        titulo: 'Discos publicados',
        valor: String(resumen.activos),
        detalle: 'Productos visibles en el catálogo',
        destacada: false,
      },
      {
        titulo: 'Productos registrados',
        valor: String(resumen.productos),
        detalle: 'Incluye publicados y retirados',
        destacada: false,
      },
    ];
  });

  async ionViewDidEnter(): Promise<void> {
    this.activa = true;
    await this.cargarDashboard();
  }

  ionViewWillLeave(): void {
    this.activa = false;
    ++this.peticion;
    this.destruirGraficos();
  }

  ngOnDestroy(): void {
    this.ionViewWillLeave();
  }

  async cargarDashboard(): Promise<void> {
    if (!this.activa || this.exportando()) {
      return;
    }

    const peticion = ++this.peticion;

    this.loading.set(true);
    this.errorMessage.set('');
    this.exportError.set('');
    this.destruirGraficos();

    try {
      const datos = await this.servicio.obtenerDatos();

      if (!this.activa || peticion !== this.peticion) {
        return;
      }

      this.datos = datos;
      this.recalcular();

      this.ultimaActualizacion.set(
        new Date().toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      );

      this.loading.set(false);
      this.detector.detectChanges();
      this.dibujarGraficos();
    } catch {
      if (this.activa && peticion === this.peticion) {
        this.destruirGraficos();
        this.errorMessage.set(
          'No se han podido cargar las estadísticas. Comprueba la conexión y vuelve a actualizar.',
        );
      }
    } finally {
      if (this.activa && peticion === this.peticion) {
        this.loading.set(false);
      }
    }
  }

  cambiarPeriodo(dias: number): void {
    if (
      !this.periodos.includes(dias) ||
      this.loading() ||
      this.exportando() ||
      this.errorMessage() ||
      !this.activa ||
      !this.datos
    ) {
      return;
    }

    this.dias.set(dias);
    this.recalcular();
    this.dibujarGraficos();
  }

  porcentaje(cantidad: number): string {
    const total = this.resumen().reservas;

    return total === 0
      ? '0 %'
      : `${Math.round((cantidad / total) * 100)} %`;
  }

  nombreEstado(estado: string): string {
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'recogida':
        return 'Recogida';
      case 'cancelada':
        return 'Cancelada';
      default:
        return estado;
    }
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  descargarCsv(): void {
    if (
      this.loading() ||
      this.errorMessage() ||
      this.exportando() ||
      !this.datos
    ) {
      return;
    }

    this.exportError.set('');

    try {
      this.informes.descargarCsv(this.prepararInforme());
    } catch {
      this.exportError.set('No se ha podido generar el CSV.');
    }
  }

  async descargarPdf(): Promise<void> {
    if (
      this.loading() ||
      this.errorMessage() ||
      this.exportando() ||
      !this.datos
    ) {
      return;
    }

    this.exportError.set('');
    this.exportando.set(true);

    try {
      await this.informes.descargarPdf(this.prepararInforme());
    } catch {
      this.exportError.set('No se ha podido generar el PDF.');
    } finally {
      this.exportando.set(false);
    }
  }

  private prepararInforme(): DatosInforme {
    return {
      dias: this.dias(),
      resumen: this.resumen(),
      actividad: this.actividad(),
      estados: this.estados(),
    };
  }

  private recalcular(): void {
    const datos = this.datos;

    if (!datos) {
      return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - this.dias() + 1);

    const fin = new Date(hoy);
    fin.setDate(fin.getDate() + 1);

    const reservas = datos.reservas.filter((reserva) => {
      const fecha = new Date(reserva.created_at).getTime();

      return fecha >= inicio.getTime() && fecha < fin.getTime();
    });

    const activos = datos.productos.filter(
      (producto) => producto.activo,
    );

    const importeCentimos = reservas
      .filter((reserva) => reserva.estado === 'recogida')
      .reduce(
        (total, reserva) =>
          total +
          Math.round(reserva.precio_unitario * 100) *
            reserva.cantidad,
        0,
      );

    this.resumen.set({
      productos: datos.productos.length,
      activos: activos.length,
      stock: activos.reduce(
        (total, producto) => total + producto.stock,
        0,
      ),
      reservas: reservas.length,
      pendientes: reservas.filter(
        (reserva) => reserva.estado === 'pendiente',
      ).length,
      importeRecogidas: importeCentimos / 100,
    });

    this.estados.set([
      {
        etiqueta: 'Pendientes',
        cantidad: reservas.filter(
          (reserva) => reserva.estado === 'pendiente',
        ).length,
      },
      {
        etiqueta: 'Recogidas',
        cantidad: reservas.filter(
          (reserva) => reserva.estado === 'recogida',
        ).length,
      },
      {
        etiqueta: 'Canceladas',
        cantidad: reservas.filter(
          (reserva) => reserva.estado === 'cancelada',
        ).length,
      },
    ]);

    const cantidadesPorDia = new Map<string, number>();

    for (const reserva of reservas) {
      const clave = new Date(reserva.created_at).toDateString();

      cantidadesPorDia.set(
        clave,
        (cantidadesPorDia.get(clave) ?? 0) + 1,
      );
    }

    this.actividad.set(
      Array.from({ length: this.dias() }, (_, indice) => {
        const fecha = new Date(inicio);
        fecha.setDate(fecha.getDate() + indice);

        return {
          fecha: fecha.toLocaleDateString('es-ES'),
          cantidad: cantidadesPorDia.get(fecha.toDateString()) ?? 0,
        };
      }),
    );

    this.stockBajo.set(
      activos
        .filter((producto) => producto.stock <= this.umbralStockBajo)
        .sort(
          (a, b) =>
            a.stock - b.stock ||
            a.titulo.localeCompare(b.titulo, 'es'),
        ),
    );

    const productosPorId = new Map(
      datos.productos.map((producto) => [producto.id, producto]),
    );

    const unidadesPorProducto = new Map<string, number>();

    for (const reserva of reservas) {
      if (reserva.estado !== 'cancelada') {
        unidadesPorProducto.set(
          reserva.producto_id,
          (unidadesPorProducto.get(reserva.producto_id) ?? 0) +
            reserva.cantidad,
        );
      }
    }

    this.masReservados.set(
      [...unidadesPorProducto.entries()]
        .map(([id, unidades]) => {
          const producto = productosPorId.get(id);

          return {
            id,
            titulo: producto?.titulo ?? 'Producto no disponible',
            artista: producto?.artista ?? '',
            unidades,
          };
        })
        .sort(
          (a, b) =>
            b.unidades - a.unidades ||
            a.titulo.localeCompare(b.titulo, 'es'),
        )
        .slice(0, 5),
    );

    this.recientes.set(
      [...reservas]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5)
        .map((reserva) => ({
          id: reserva.id,
          titulo:
            productosPorId.get(reserva.producto_id)?.titulo ??
            'Producto no disponible',
          cantidad: reserva.cantidad,
          estado: reserva.estado,
          fecha: reserva.created_at,
        })),
    );
  }

  private dibujarGraficos(): void {
    this.destruirGraficos();

    const estilos = getComputedStyle(
      this.canvasActividad.nativeElement,
    );

    const colorTexto = estilos.color;
    const fuente = estilos.fontFamily;

    this.graficoActividad = new Chart<'line', number[], string>(
      this.canvasActividad.nativeElement,
      {
        type: 'line',
        data: {
          labels: this.actividad().map((dia) => dia.fecha),
          datasets: [
            {
              label: 'Reservas creadas',
              data: this.actividad().map((dia) => dia.cantidad),
              borderColor: '#782c40',
              backgroundColor: '#782c40',
              borderWidth: 3,
              pointRadius: this.dias() > 14 ? 2 : 4,
              pointHoverRadius: 6,
              pointBackgroundColor: '#fffdf9',
              pointBorderColor: '#782c40',
              pointBorderWidth: 2,
              tension: 0.25,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: {
            intersect: false,
            mode: 'index',
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: '#292622',
              titleFont: { family: fuente },
              bodyFont: { family: fuente },
              padding: 12,
              cornerRadius: 8,
              displayColors: false,
            },
          },
          scales: {
            x: {
              border: { display: false },
              grid: { display: false },
              ticks: {
                color: colorTexto,
                maxTicksLimit: 7,
                maxRotation: 0,
                font: { family: fuente, size: 11 },
              },
            },
            y: {
              beginAtZero: true,
              border: { display: false },
              grid: {
                color: '#e9e1d5',
              },
              ticks: {
                color: colorTexto,
                precision: 0,
                font: { family: fuente, size: 11 },
              },
            },
          },
        },
      },
    );

    this.graficoEstados = new Chart<
      'doughnut',
      number[],
      string
    >(
      this.canvasEstados.nativeElement,
      {
        type: 'doughnut',
        data: {
          labels: this.estados().map((estado) => estado.etiqueta),
          datasets: [
            {
              data: this.estados().map((estado) => estado.cantidad),
              backgroundColor: this.coloresEstados,
              borderColor: '#fffdf9',
              borderWidth: 5,
              hoverOffset: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          cutout: '76%',
          layout: {
            padding: 8,
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              backgroundColor: '#292622',
              titleFont: { family: fuente },
              bodyFont: { family: fuente },
              padding: 12,
              cornerRadius: 8,
            },
          },
        },
      },
    );
  }

  private destruirGraficos(): void {
    this.graficoActividad?.destroy();
    this.graficoEstados?.destroy();

    this.graficoActividad = null;
    this.graficoEstados = null;
  }
}