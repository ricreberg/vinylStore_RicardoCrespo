import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
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
    CurrencyPipe,
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
export class DashboardPage implements OnDestroy {
  private readonly servicio = inject(DashboardService);
  private readonly detector = inject(ChangeDetectorRef);

  @ViewChild('canvasActividad', { static: true })
  private canvasActividad!: ElementRef<HTMLCanvasElement>;

  @ViewChild('canvasEstados', { static: true })
  private canvasEstados!: ElementRef<HTMLCanvasElement>;

  private graficoActividad: Chart<'line', number[], string> | null = null;
  private graficoEstados: Chart<'doughnut', number[], string> | null = null;

  private datos: DatosDashboard | null = null;
  private activa = false;
  private peticion = 0;

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly dias = signal(7);

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
    if (!this.activa) {
      return;
    }

    const peticion = ++this.peticion;

    this.loading.set(true);
    this.errorMessage.set('');
    this.destruirGraficos();

    try {
      const datos = await this.servicio.obtenerDatos();

      if (!this.activa || peticion !== this.peticion) {
        return;
      }

      this.datos = datos;
      this.recalcular();
      this.loading.set(false);

      // Actualizar la vista antes de medir los contenedores de los gráficos.
      this.detector.detectChanges();
      this.dibujarGraficos();
    } catch {
      if (this.activa && peticion === this.peticion) {
        this.destruirGraficos();
        this.errorMessage.set(
          'No se ha podido cargar el dashboard. Inténtalo de nuevo.',
        );
      }
    } finally {
      if (this.activa && peticion === this.peticion) {
        this.loading.set(false);
      }
    }
  }

  cambiarPeriodo(event: Event): void {
    const selector = event.target;

    if (
      !(selector instanceof HTMLSelectElement) ||
      this.loading() ||
      !this.activa ||
      !this.datos
    ) {
      return;
    }

    const dias = Number(selector.value);

    if (![7, 14, 30].includes(dias)) {
      return;
    }

    this.dias.set(dias);
    this.recalcular();
    this.dibujarGraficos();
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

    const activos = datos.productos.filter((producto) => producto.activo);

    const importeCentimos = reservas
      .filter((reserva) => reserva.estado === 'recogida')
      .reduce(
        (total, reserva) =>
          total +
          Math.round(reserva.precio_unitario * 100) * reserva.cantidad,
        0,
      );

    this.resumen.set({
      productos: datos.productos.length,
      activos: activos.length,
      stock: activos.reduce((total, producto) => total + producto.stock, 0),
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

    this.actividad.set(
      Array.from({ length: this.dias() }, (_, indice) => {
        const fecha = new Date(inicio);
        fecha.setDate(fecha.getDate() + indice);

        return {
          fecha: fecha.toLocaleDateString('es-ES'),
          cantidad: reservas.filter(
            (reserva) =>
              new Date(reserva.created_at).toDateString() ===
              fecha.toDateString(),
          ).length,
        };
      }),
    );
  }

  private dibujarGraficos(): void {
    this.destruirGraficos();

    const colorTexto = getComputedStyle(
      this.canvasActividad.nativeElement,
    ).color;

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
              borderColor: '#3880ff',
              backgroundColor: '#3880ff',
              tension: 0.2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { labels: { color: colorTexto } },
          },
          scales: {
            x: {
              ticks: { color: colorTexto, maxTicksLimit: 7 },
            },
            y: {
              beginAtZero: true,
              ticks: { color: colorTexto, precision: 0 },
            },
          },
        },
      },
    );

    this.graficoEstados = new Chart<'doughnut', number[], string>(
      this.canvasEstados.nativeElement,
      {
        type: 'doughnut',
        data: {
          labels: this.estados().map((estado) => estado.etiqueta),
          datasets: [
            {
              data: this.estados().map((estado) => estado.cantidad),
              backgroundColor: ['#d99a00', '#198754', '#cf3c4f'],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { labels: { color: colorTexto } },
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