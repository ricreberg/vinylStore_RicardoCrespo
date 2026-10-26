import { Component } from '@angular/core';
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
  readonly menuSections = [
    {
      title: 'Tienda',
      links: [
        { title: 'Catálogo', url: '/catalogo' },
        { title: 'Mis reservas', url: '/mis-reservas' },
        { title: 'Ayuda', url: '/ayuda' },
        { title: 'Iniciar sesión', url: '/login' },
      ],
    },
    {
      title: 'Administración',
      links: [
        { title: 'Estadísticas', url: '/admin/dashboard' },
        { title: 'Productos y existencias', url: '/admin/productos' },
        { title: 'Gestión de reservas', url: '/admin/reservas' },
      ],
    },
  ];
}