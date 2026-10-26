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

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

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

      this.successMessage.set(
        `Sesión iniciada con ${data.user.email ?? email}.`,
      );
      this.form.controls.password.reset();
    } catch {
      this.errorMessage.set(
        'No se ha podido conectar con el servicio. Inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}