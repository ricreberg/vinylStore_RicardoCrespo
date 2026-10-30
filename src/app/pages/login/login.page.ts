import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
import type { Session } from '@supabase/supabase-js';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    ReactiveFormsModule,
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
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly session = signal<Session | null>(null);
  readonly checkingSession = signal(true);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async ionViewWillEnter(): Promise<void> {
    this.checkingSession.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const { data, error } = await this.auth.getSession();

      if (error) {
        this.errorMessage.set('No se ha podido recuperar la sesión.');
        return;
      }

      this.session.set(data.session);
    } catch {
      this.errorMessage.set('No se ha podido comprobar la sesión.');
    } finally {
      this.checkingSession.set(false);
    }
  }

  async signIn(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    try {
      const { email, password } = this.form.getRawValue();
      const { data, error } = await this.auth.signIn(email, password);

      if (error) {
        this.errorMessage.set(
          'No se ha podido iniciar sesión. Comprueba el correo y la contraseña.',
        );
        return;
      }

      this.session.set(data.session);
      this.form.reset();
    } catch {
      this.errorMessage.set(
        'No se ha podido conectar con el servicio. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    if (this.loading()) {
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

      this.session.set(null);
      this.form.reset();
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