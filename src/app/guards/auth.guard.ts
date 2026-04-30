import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { FirebaseService } from '../services/firebase.service';

export const authGuard: CanActivateFn = () => {
  const firebaseService = inject(FirebaseService);
  const router = inject(Router);

  return firebaseService.user$.pipe(
    take(1),
    map((user) => user ? true : router.createUrlTree(['/login']))
  );
};
