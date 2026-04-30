import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideFirebaseApp } from '@angular/fire/app';
import { initializeApp } from 'firebase/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideDatabase } from '@angular/fire/database';
import { getDatabase } from 'firebase/database';
import { environment } from '../environments/environment';

const firebaseApp = initializeApp(environment.firebase);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),

    provideFirebaseApp(() => firebaseApp),
    provideAuth(() => getAuth(firebaseApp)),
    provideFirestore(() => getFirestore(firebaseApp)),
    provideDatabase(() => getDatabase(firebaseApp)),
  ]
};
