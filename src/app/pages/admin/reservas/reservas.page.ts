import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { ReservasService } from '../../../core/services/reservas.service';
import type {
  EstadoReserva,
  ReservaDetalle,
} from '../../../core/services/reservas.service';
import { ClientesService } from '../../../core/services/clientes.service';
import type { Cliente } from '../../../core/services/clientes.service';
import { PortadasService } from '../../../core/services/portadas.service';

type FiltroEstado = 'todas' | EstadoReserva;

@Component({
  selector: 'app-reservas',
  templateUrl: './reservas.page.html',
  styleUrls: ['./reservas.page.scss'],
  imports: [
    FormsModule,
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
})
export class ReservasPage {
  private readonly servicio = inject(ReservasService);
  private readonly clientesService = inject(ClientesService);
  private readonly alertas = inject(AlertController);

  readonly portadas = inject(PortadasService);

  private readonly moneda = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  readonly clientesPorId =
    signal<Partial<Record<string, Cliente>>>({});

  readonly reservas = signal<ReservaDetalle[]>([]);
  readonly loading = signal(true);
  readonly confirmando = signal(false);
  readonly procesandoId = signal<string | null>(null);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly successMessage = signal('');

  readonly opcionesEstado: {
    valor: FiltroEstado;
    etiqueta: string;
  }[] = [
    { valor: 'todas', etiqueta: 'Todas' },
    { valor: 'pendiente', etiqueta: 'Pendientes' },
    { valor: 'recogida', etiqueta: 'Recogidas' },
    { valor: 'cancelada', etiqueta: 'Canceladas' },
  ];

  readonly conteos = computed(() => {
    const reservas = this.reservas();

    return {
      todas: reservas.length,
      pendiente: reservas.filter(
        (reserva) => reserva.estado === 'pendiente',
      ).length,
      recogida: reservas.filter(
        (reserva) => reserva.estado === 'recogida',
      ).length,
      cancelada: reservas.filter(
        (reserva) => reserva.estado === 'cancelada',
      ).length,
    };
  });

  readonly bloqueado = computed(() =>
    this.loading() ||
    this.confirmando() ||
    this.procesandoId() !== null,
  );

  filtro: FiltroEstado = 'todas';
  busqueda = '';
  orden: 'recientes' | 'antiguas' = 'recientes';

  get hayFiltros(): boolean {
    return (
      this.filtro !== 'todas' ||
      this.busqueda.trim() !== '' ||
      this.orden !== 'recientes'
    );
  }

  get reservasFiltradas(): ReservaDetalle[] {
    const consulta = this.normalizar(this.busqueda.trim());
    const clientes = this.clientesPorId();

    return this.reservas()
      .filter((reserva) => {
        const coincideEstado =
          this.filtro === 'todas' ||
          reserva.estado === this.filtro;

        const cliente = clientes[reserva.usuario_id];

        const texto = this.normalizar([
          reserva.id,
          reserva.usuario_id,
          reserva.producto?.titulo ?? '',
          reserva.producto?.artista ?? '',
          cliente?.nombre ?? '',
          cliente?.correo ?? '',
        ].join(' '));

        return (
          coincideEstado &&
          (!consulta || texto.includes(consulta))
        );
      })
      .sort((a, b) =>
        this.orden === 'antiguas'
          ? a.created_at.localeCompare(b.created_at)
          : b.created_at.localeCompare(a.created_at),
      );
  }

  async ionViewWillEnter(): Promise<void> {
    this.actionError.set('');
    this.successMessage.set('');
    await this.cargarReservas();
  }

  async cargarReservas(): Promise<void> {
    if (this.procesandoId() || this.confirmando()) {
      return;
    }

    this.loading.set(true);
    this.loadError.set('');

    try {
      const [reservas, clientes] = await Promise.all([
        this.servicio.listarTodas(),
        this.clientesService.listar(),
      ]);

      this.clientesPorId.set(
        Object.fromEntries(
          clientes.map((cliente) => [cliente.id, cliente]),
        ),
      );

      this.reservas.set(reservas);
    } catch {
      this.loadError.set(
        'No se han podido cargar las reservas y sus clientes. Comprueba la conexión y vuelve a actualizar.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  seleccionarEstado(estado: FiltroEstado): void {
    if (!this.bloqueado()) {
      this.filtro = estado;
    }
  }

  limpiarFiltros(): void {
    this.filtro = 'todas';
    this.busqueda = '';
    this.orden = 'recientes';
  }

  formatearPrecio(precio: number): string {
    return this.moneda.format(precio);
  }

  formatearTotal(reserva: ReservaDetalle): string {
    const centimos =
      Math.round(reserva.precio_unitario * 100) * reserva.cantidad;

    return this.moneda.format(centimos / 100);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  nombreEstado(estado: EstadoReserva): string {
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'recogida':
        return 'Recogida';
      case 'cancelada':
        return 'Cancelada';
    }
  }

  async cambiarEstado(
    reserva: ReservaDetalle,
    estado: 'cancelada' | 'recogida',
  ): Promise<void> {
    if (this.bloqueado() || reserva.estado !== 'pendiente') {
      return;
    }

    this.confirmando.set(true);
    this.actionError.set('');
    this.successMessage.set('');

    let confirmado = false;

    try {
      const alerta = await this.alertas.create({
        header:
          estado === 'recogida'
            ? 'Confirmar recogida'
            : 'Cancelar reserva',
        message:
          estado === 'recogida'
            ? 'La reserva quedará finalizada como recogida. No se descontarán unidades adicionales.'
            : `La reserva quedará cancelada y se devolverán ${reserva.cantidad} unidades al stock.`,
        buttons: [
          {
            text: 'Volver',
            role: 'cancel',
          },
          {
            text:
              estado === 'recogida'
                ? 'Confirmar recogida'
                : 'Cancelar reserva',
            role: 'confirm',
          },
        ],
      });

      await alerta.present();

      const { role } = await alerta.onDidDismiss();
      confirmado = role === 'confirm';
    } catch {
      this.actionError.set(
        'No se ha podido abrir la confirmación. Vuelve a intentarlo.',
      );
    } finally {
      this.confirmando.set(false);
    }

    if (!confirmado) {
      return;
    }

    this.procesandoId.set(reserva.id);

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
          ? `Reserva ${reserva.id.slice(0, 8)} marcada como recogida.`
          : `Reserva ${reserva.id.slice(0, 8)} cancelada. Las unidades se han devuelto al stock.`,
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

  private normalizar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
  }
}