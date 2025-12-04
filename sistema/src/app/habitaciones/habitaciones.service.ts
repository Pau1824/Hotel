import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HabitacionesService {
  //private http = inject(HttpClient);
  private apiUrl = '${environment.apiUrl}/habitaciones';

  constructor(private http: HttpClient) {}

  getHabitaciones() {
    return this.http.get<any[]>(`${environment.apiUrl}/habitaciones`);
  }

}
