import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TemaService {
  private readonly documento = inject(DOCUMENT);
  private readonly oscuro = signal(false);
  private readonly clave = 'vinyl-store-tema';

  readonly esOscuro = this.oscuro.asReadonly();

  constructor() {
    const ventana = this.documento.defaultView;
    let preferencia: string | null = null;

    try {
      preferencia = ventana?.localStorage.getItem(this.clave) ?? null;
    } catch {
      // La aplicación sigue funcionando si el almacenamiento está bloqueado.
    }

    const usarOscuro =
      preferencia === 'oscuro' ||
      (preferencia !== 'claro' &&
        (ventana?.matchMedia('(prefers-color-scheme: dark)').matches ?? false));

    this.aplicar(usarOscuro);
  }

  alternar(): void {
    const usarOscuro = !this.oscuro();

    this.aplicar(usarOscuro);

    try {
      this.documento.defaultView?.localStorage.setItem(
        this.clave,
        usarOscuro ? 'oscuro' : 'claro',
      );
    } catch {
      // Se mantiene el tema durante la sesión aunque no pueda guardarse.
    }

    this.documento.dispatchEvent(new Event('vinylstore:tema'));
  }

  private aplicar(usarOscuro: boolean): void {
    this.oscuro.set(usarOscuro);
    this.documento.documentElement.classList.toggle(
      'tema-oscuro',
      usarOscuro,
    );
  }
}
