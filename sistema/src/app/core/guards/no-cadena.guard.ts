import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../auth.service';

export const noCadenaGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.currentUser?.rol === 'admin_cadena') {
    router.navigate(['/hoteles-admin']);
    return false;
  }

  return true;
};
