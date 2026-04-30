import { EnvironmentInjector, Injectable, inject, runInInjectionContext } from '@angular/core';
import { Database, objectVal, ref } from '@angular/fire/database';
import { defer, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OnlineDataService {
  private readonly injector = inject(EnvironmentInjector);

  constructor(private db: Database){}

  getData(): Observable<any>{
    return defer(() =>
      runInInjectionContext(this.injector, () => objectVal(ref(this.db, '/')))
    );
  }
}
