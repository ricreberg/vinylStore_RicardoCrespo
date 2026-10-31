import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInput,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
})
export class LoginPage {
  readonly auth = inject(AuthService);

  private readonly fb = inject(FormBuilder);

  readonly session = this.auth.session;
  readonly checkingSession = signal(true);
  readonly loading = signal(false);
  readonly mostrarPassword = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async ionViewWillEnter(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.checkingSession.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.mostrarPassword.set(false);

    try {
      const { error } = await this.auth.getSession();

      if (error) {
        this.errorMessage.set('No se ha podido recuperar la sesión.');
      }
    } catch {
      this.errorMessage.set('No se ha podido comprobar la sesión.');
    } finally {
      this.checkingSession.set(false);
    }
  }

  alternarPassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  inicialCorreo(correo: string | undefined): string {
    return correo?.trim().charAt(0).toLocaleUpperCase('es') || 'VS';
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  async signIn(): Promise<void> {
    if (
      this.loading() ||
      this.checkingSession() ||
      this.session()
    ) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();

    this.loading.set(true);
    this.form.disable();

    try {
      const { error } = await this.auth.signIn(email, password);

      if (error) {
        this.errorMessage.set(
          'No se ha podido iniciar sesión. Comprueba el correo y la contraseña.',
        );
        return;
      }

      this.form.reset();
      this.mostrarPassword.set(false);
    } catch {
      this.errorMessage.set(
        'No se ha podido conectar con el servicio. Inténtalo de nuevo.',
      );
    } finally {
      this.form.enable();
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    if (this.loading() || this.checkingSession()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const { error } = await this.auth.signOut();

      if (error) {
        this.errorMessage.set('No se ha podido cerrar la sesión.');
        return;
      }

      this.form.reset();
      this.mostrarPassword.set(false);
      this.successMessage.set('Has cerrado la sesión.');
    } catch {
      this.errorMessage.set(
        'No se ha podido conectar con el servicio. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}