import { Injectable } from '@angular/core';
import { Database, objectVal, ref } from '@angular/fire/database';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OnlineDataService {
  constructor(private db: Database){

  }

  getData(): Observable<any>{
    const dataRef = ref(this.db, '/');
    return objectVal(dataRef);
  }
}
