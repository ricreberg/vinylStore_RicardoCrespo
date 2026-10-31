import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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

type OrdenClientes = 'nombre' | 'recientes' | 'antiguos';

@Component({
  selector: 'app-clientes',
  templateUrl: './clientes.page.html',
  styleUrls: ['./clientes.page.scss'],
  imports: [
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
export class ClientesPage {
  private readonly servicio = inject(ClientesService);
  private peticion = 0;

  readonly clientes = signal<Cliente[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly busqueda = signal('');
  readonly orden = signal<OrdenClientes>('nombre');

  readonly clientesFiltrados = computed(() => {
    const consulta = this.normalizar(this.busqueda().trim());

    const resultado = this.clientes().filter((cliente) =>
      this.normalizar(
        `${cliente.nombre} ${cliente.correo ?? ''}`,
      ).includes(consulta),
    );

    switch (this.orden()) {
      case 'recientes':
        return resultado.sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        );

      case 'antiguos':
        return resultado.sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );

      default:
        return resultado.sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es'),
        );
    }
  });

  async ionViewWillEnter(): Promise<void> {
    await this.cargarClientes();
  }

  ionViewWillLeave(): void {
    ++this.peticion;
  }

  async cargarClientes(): Promise<void> {
    const peticion = ++this.peticion;

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const clientes = await this.servicio.listar();

      if (peticion === this.peticion) {
        this.clientes.set(clientes);
      }
    } catch (error: unknown) {
      if (peticion === this.peticion) {
        this.errorMessage.set(
          error instanceof Error
            ? error.message
            : 'No se han podido cargar los clientes.',
        );
      }
    } finally {
      if (peticion === this.peticion) {
        this.loading.set(false);
      }
    }
  }

  actualizarBusqueda(event: Event): void {
    const campo = event.target;

    if (campo instanceof HTMLInputElement) {
      this.busqueda.set(campo.value);
    }
  }

  actualizarOrden(event: Event): void {
    const selector = event.target;

    if (!(selector instanceof HTMLSelectElement)) {
      return;
    }

    const valor = selector.value;

    if (
      valor === 'nombre' ||
      valor === 'recientes' ||
      valor === 'antiguos'
    ) {
      this.orden.set(valor);
    }
  }

  limpiarBusqueda(): void {
    this.busqueda.set('');
    this.orden.set('nombre');
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
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private normalizar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es');
  }
}