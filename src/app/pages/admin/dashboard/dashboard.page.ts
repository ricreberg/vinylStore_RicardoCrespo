import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import {
  calcularDashboard,
  crearPeriodo,
  etiquetaPeriodo,
  fechaLocal,
  periodoRapido,
  validarPeriodo,
} from '../../../core/utils/dashboard-calculos';
import type {
  ActividadPeriodo,
  PeriodoInforme,
  PeriodoRapido,
  ResumenDashboard,
} from '../../../core/utils/dashboard-calculos';

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
    FormsModule,
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

  readonly periodos: { valor: PeriodoRapido; etiqueta: string }[] = [
    { valor: 7, etiqueta: '7 días' },
    { valor: 30, etiqueta: '30 días' },
    { valor: 90, etiqueta: '90 días' },
    { valor: 365, etiqueta: 'Último año' },
    { valor: 'todo', etiqueta: 'Todo el historial' },
  ];
  readonly seleccionPeriodo = signal<PeriodoRapido | 'personalizado'>(7);
  readonly periodo = signal<PeriodoInforme>(periodoRapido(7, []));
  readonly errorPeriodo = signal('');
  readonly textoPeriodo = computed(() => etiquetaPeriodo(this.periodo()));
  readonly agrupacion = computed(() => this.periodo().agrupacion);
  desde = this.periodo().desde;
  hasta = this.periodo().hasta;

  get fechaHoy(): string {
    return fechaLocal(new Date());
  }
  readonly umbralStockBajo = 3;
  get coloresEstados(): string[] {
    return [
      this.colorTema('--store-chart-pending', '#956615'),
      this.colorTema('--store-chart-collected', '#455b4c'),
      this.colorTema('--store-chart-cancelled', '#782c40'),
    ];
  }

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly exportando = signal(false);
  readonly exportError = signal('');
  readonly ultimaActualizacion = signal('');

  readonly resumen = signal<ResumenDashboard>({
    productos: 0,
    activos: 0,
    stock: 0,
    reservas: 0,
    pendientes: 0,
    importeRecogidas: 0,
    compras: 0,
    cancelaciones: 0,
  });

  readonly actividad = signal<ActividadPeriodo[]>([]);

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
        detalle: this.textoPeriodo(),
        destacada: true,
      },
      {
        titulo: 'Todavía pendientes',
        valor: String(resumen.pendientes),
        detalle: 'De las reservas creadas en el periodo',
        destacada: false,
      },
      {
        titulo: 'Ventas',
        valor: this.moneda.format(resumen.importeRecogidas),
        detalle: `${resumen.compras} compras por fecha de recogida`,
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
      const seleccion = this.seleccionPeriodo();
      if (seleccion !== 'personalizado') {
        this.establecerPeriodo(periodoRapido(seleccion, datos.reservas));
      }
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

  cambiarPeriodo(opcion: PeriodoRapido): void {
    if (!this.puedeActualizarPeriodo()) return;
    this.seleccionPeriodo.set(opcion);
    this.establecerPeriodo(periodoRapido(opcion, this.datos!.reservas));
    this.recalcular();
    this.dibujarGraficos();
  }

  aplicarFechas(): void {
    if (!this.puedeActualizarPeriodo()) return;
    const error = validarPeriodo(this.desde, this.hasta);
    this.errorPeriodo.set(error);
    if (error) return;
    this.seleccionPeriodo.set('personalizado');
    this.establecerPeriodo(crearPeriodo(this.desde, this.hasta));
    this.recalcular();
    this.dibujarGraficos();
  }

  private puedeActualizarPeriodo(): boolean {
    return this.activa && !!this.datos && !this.loading()
      && !this.exportando() && !this.errorMessage();
  }

  private establecerPeriodo(periodo: PeriodoInforme): void {
    this.periodo.set(periodo);
    this.desde = periodo.desde;
    this.hasta = periodo.hasta;
    this.errorPeriodo.set('');
    this.exportError.set('');
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

  formatearPrecio(importe: number): string {
    return this.moneda.format(importe);
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
      !this.datos ||
      this.errorPeriodo() !== ''
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
      !this.datos ||
      this.errorPeriodo() !== ''
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
      periodo: { ...this.periodo() },
      actualizado: this.ultimaActualizacion(),
      resumen: { ...this.resumen() },
      actividad: this.actividad().map((fila) => ({ ...fila })),
      estados: this.estados().map((fila) => ({ ...fila })),
    };
  }

  private recalcular(): void {
    if (!this.datos) return;
    const calculo = calcularDashboard(this.datos, this.periodo(), this.umbralStockBajo);
    this.resumen.set(calculo.resumen);
    this.actividad.set(calculo.actividad);
    this.estados.set(calculo.estados);
    this.stockBajo.set(calculo.stockBajo);
    this.masReservados.set(calculo.masReservados);
    this.recientes.set(calculo.recientes);
  }

  @HostListener('document:vinylstore:tema')
  actualizarTema(): void {
    if (this.activa && this.datos && !this.loading() && !this.errorMessage()) {
      this.detector.detectChanges();
      this.dibujarGraficos();
    }
  }

  private colorTema(variable: string, alternativa: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim() || alternativa;
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
              borderColor: this.colorTema('--store-chart-primary', '#782c40'),
              backgroundColor: this.colorTema('--store-chart-primary', '#782c40'),
              borderWidth: 3,
              pointRadius: this.actividad().length > 31 ? 1.5 : 3,
              pointHoverRadius: 6,
              pointBackgroundColor: this.colorTema('--store-surface', '#fffdf9'),
              pointBorderColor: this.colorTema('--store-chart-primary', '#782c40'),
              pointBorderWidth: 2,
              tension: 0.25,
            },
            {
              label: 'Compras completadas',
              data: this.actividad().map((fila) => fila.compras),
              borderColor: this.colorTema('--store-chart-collected', '#455b4c'),
              backgroundColor: this.colorTema('--store-chart-collected', '#455b4c'),
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: this.actividad().length > 31 ? 1.5 : 3,
              pointHoverRadius: 6,
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
              display: true,
              labels: {
                color: colorTexto,
                font: { family: fuente, size: 11 },
                boxWidth: 20,
                padding: 16,
              },
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
                color: this.colorTema('--store-border', '#ded5c9'),
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
              borderColor: this.colorTema('--store-surface', '#fffdf9'),
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
