
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CrearReservaPayload {
  numero: number;         // número de la habitación (NO el ID)
  llegada: string;        // 'YYYY-MM-DD'
  salida: string;         // 'YYYY-MM-DD'
  folio: string;
  nombre: string;
  apellido: string;
  apellido2?: string;
  personas: number;
  cargo_extra?: number;
  metodo_pago?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReservasService {
  private http = inject(HttpClient);
  private API = '${environment.apiUrl}/reservas';

  crearReserva(payload: any) {
  return this.http.post(`${this.API}`, payload);
}


  obtenerReservas(): Observable<any> {
    return this.http.get(this.API);
  }

  getHabitaciones() {
    return this.http.get<any[]>('${environment.apiUrl}/habitaciones');
  }

  obtenerTarifa(id_habitacion: number) {
    const url = `${environment.apiUrl}/habitaciones/tarifa/${id_habitacion}`;
    console.log("llamando a:", url);

    return this.http.get<any>(url);
  }

  obtenerMovimientos(id_reservacion: number) {
    return this.http.get<any[]>(
      `${environment.apiUrl}/reservas/movimientos/${id_reservacion}`
    );
  }

  // ESTA ES LA PARTE QUE TE FALTABA
  obtenerCatalogoMovimientos() {
    return this.http.get<any[]>(
      '${environment.apiUrl}/conceptos/catalogo-movimientos'
    );
  }

  actualizarReserva(id:number, data: any) {
    return this.http.put(`${environment.apiUrl}/reservas/${id}`, data);
  }

  crearMovimiento(id_reserva: number, payload: any) {
    return this.http.post(`${environment.apiUrl}/reservas/${id_reserva}/movimientos`, payload);
  }

  cancelarReserva(id: number) {
    return this.http.put(`${environment.apiUrl}/reservas/${id}/cancelar`, {});
  }

  checkIn(id: number) {
    return this.http.put(`${environment.apiUrl}/reservas/${id}/checkin`, {});
  }

  checkOut(id: number) {
    return this.http.post(`${environment.apiUrl}/reservas/${id}/checkout`, {});
  }

  //registrarMovimiento(idReserva: number, data: any) {
    //return this.http.post(`http://localhost:5000/api/reservas/${idReserva}/movimientos`, data);
  //}



}
