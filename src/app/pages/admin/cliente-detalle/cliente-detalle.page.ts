import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { ClientesService } from '../../../core/services/clientes.service';
import type { Cliente } from '../../../core/services/clientes.service';
import { ReservasService } from '../../../core/services/reservas.service';
import type {
  EstadoReserva,
  ReservaDetalle,
} from '../../../core/services/reservas.service';

@Component({
  selector: 'app-cliente-detalle',
  templateUrl: './cliente-detalle.page.html',
  styleUrls: ['./cliente-detalle.page.scss'],
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
export class ClienteDetallePage {
  private readonly ruta = inject(ActivatedRoute);
  private readonly clientesService = inject(ClientesService);
  private readonly reservasService = inject(ReservasService);

  private readonly moneda = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private peticion = 0;

  readonly cliente = signal<Cliente | null>(null);
  readonly reservas = signal<ReservaDetalle[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  filtro: 'todas' | EstadoReserva = 'todas';

  readonly resumen = computed(() => {
    const reservas = this.reservas();

    const centimosRecogidas = reservas
      .filter((reserva) => reserva.estado === 'recogida')
      .reduce(
        (total, reserva) =>
          total +
          Math.round(reserva.precio_unitario * 100) *
            reserva.cantidad,
        0,
      );

    return {
      total: reservas.length,
      pendientes: reservas.filter(
        (reserva) => reserva.estado === 'pendiente',
      ).length,
      recogidas: reservas.filter(
        (reserva) => reserva.estado === 'recogida',
      ).length,
      canceladas: reservas.filter(
        (reserva) => reserva.estado === 'cancelada',
      ).length,
      valorRecogidas: centimosRecogidas / 100,
    };
  });

  get reservasFiltradas(): ReservaDetalle[] {
    return this.reservas()
      .filter((reserva) =>
        this.filtro === 'todas' ||
        reserva.estado === this.filtro,
      )
      .sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
  }

  async ionViewWillEnter(): Promise<void> {
    this.filtro = 'todas';
    await this.cargarFicha();
  }

  ionViewWillLeave(): void {
    ++this.peticion;
  }

  async cargarFicha(): Promise<void> {
    const peticion = ++this.peticion;

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

      if (peticion === this.peticion) {
        this.cliente.set(cliente);
        this.reservas.set(reservas);
      }
    } catch (error: unknown) {
      if (peticion === this.peticion) {
        this.errorMessage.set(
          error instanceof Error
            ? error.message
            : 'No se ha podido cargar la ficha del cliente.',
        );
      }
    } finally {
      if (peticion === this.peticion) {
        this.loading.set(false);
      }
    }
  }

  iniciales(nombre: string): string {
    return nombre
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte.charAt(0))
      .join('')
      .toLocaleUpperCase('es') || 'CL';
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

  formatearPrecio(precio: number): string {
    return this.moneda.format(precio);
  }

  formatearTotal(reserva: ReservaDetalle): string {
    const centimos =
      Math.round(reserva.precio_unitario * 100) * reserva.cantidad;

    return this.moneda.format(centimos / 100);
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
}