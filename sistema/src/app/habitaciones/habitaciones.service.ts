import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HabitacionesService {
  //private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5000/api/habitaciones';

  constructor(private http: HttpClient) {}

  getHabitaciones() {
    return this.http.get<any[]>(`http://localhost:5000/api/habitaciones`);
  }

}
