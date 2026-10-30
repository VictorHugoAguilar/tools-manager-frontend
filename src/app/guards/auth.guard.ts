import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    return await auth.initialize()
      ? true
      : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  } catch {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url, sessionCheck: 'failed' }
    });
  }
};

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    const user = await auth.refreshCurrentUser();
    if (!user) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }
    return user.permissions.includes('users:manage')
      ? true
      : router.createUrlTree(['/acceso-denegado'], { queryParams: { returnUrl: state.url } });
  } catch {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url, sessionCheck: 'failed' }
    });
  }
};
