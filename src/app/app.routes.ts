import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'catalogo',
    pathMatch: 'full',
  },
  {
    path: 'catalogo',
    loadComponent: () =>
      import('./pages/catalogo/catalogo.page').then((m) => m.CatalogoPage),
  },
  {
    path: 'mis-reservas',
    loadComponent: () =>
      import('./pages/mis-reservas/mis-reservas.page').then(
        (m) => m.MisReservasPage,
      ),
  },
  {
    path: 'ayuda',
    loadComponent: () =>
      import('./pages/ayuda/ayuda.page').then((m) => m.AyudaPage),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'admin',
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'productos',
        loadComponent: () =>
          import('./pages/admin/productos/productos.page').then(
            (m) => m.ProductosPage,
          ),
      },
      {
        path: 'reservas',
        loadComponent: () =>
          import('./pages/admin/reservas/reservas.page').then(
            (m) => m.ReservasPage,
          ),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin/dashboard/dashboard.page').then(
            (m) => m.DashboardPage,
          ),
      },
    ],
  },
  {
    path: 'home',
    redirectTo: 'catalogo',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'catalogo',
  },
];