import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonSplitPane,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    RouterLink,
    RouterLinkActive,
    IonApp,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonMenu,
    IonMenuToggle,
    IonRouterOutlet,
    IonSplitPane,
    IonTitle,
    IonToolbar,
  ],
})
export class AppComponent {
  private readonly auth = inject(AuthService);

  readonly menuSections = computed(() => {
    const sections = [
      {
        title: 'Tienda',
        links: [
          { title: 'Catálogo', url: '/catalogo' },
          { title: 'Mis reservas', url: '/mis-reservas' },
          { title: 'Ayuda', url: '/ayuda' },
          {
            title: this.auth.session() ? 'Mi cuenta' : 'Iniciar sesión',
            url: '/login',
          },
        ],
      },
    ];

    if (this.auth.role() === 'admin') {
      sections.push({
        title: 'Administración',
        links: [
          { title: 'Estadísticas', url: '/admin/dashboard' },
          { title: 'Productos y existencias', url: '/admin/productos' },
          { title: 'Gestión de reservas', url: '/admin/reservas' },
        ],
      });
    }

    return sections;
  });
}