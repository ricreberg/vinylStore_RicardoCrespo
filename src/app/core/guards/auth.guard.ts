import { inject } from '@angular/core';
import {
  CanActivateChildFn,
  CanActivateFn,
  Router,
} from '@angular/router';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  try {
    const { data, error } = await auth.getSession();

    if (error || !data.session) {
      return router.createUrlTree(['/login']);
    }

    return true;
  } catch {
    return router.createUrlTree(['/login']);
  }
};

export const adminGuard: CanActivateChildFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  try {
    const role = await auth.getRole();

    if (role === 'admin') {
      return true;
    }

    return router.createUrlTree([
      role === 'cliente' ? '/catalogo' : '/login',
    ]);
  } catch {
    return router.createUrlTree(['/login']);
  }
};