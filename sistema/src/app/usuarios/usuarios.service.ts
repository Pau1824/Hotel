import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Usuario {
  id: number;
  username: string;
  nombreCompleto: string;
  telefono: string | null;
  email: string | null;
  rol: string;
  estado: 'activo' | 'inactivo';
  ultimoAcceso: string | null;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private API = 'http://localhost:5000/api/usuarios';

  constructor(private http: HttpClient) {}

  getUsuarios(estado: 'activo' | 'inactivo' | 'todos' = 'activo', search?: string): Observable<Usuario[]> {
    let params = new HttpParams().set('estado', estado);

    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }

    return this.http.get<Usuario[]>(this.API, { params });
}

  crearUsuario(dto: any) {
    return this.http.post(this.API, dto);
  }

  actualizarUsuario(id: number, dto: any) {
    return this.http.put(`${this.API}/${id}`, dto);
  }

  cambiarEstado(id: number, estado: 'activo' | 'inactivo') {
    return this.http.patch(`${this.API}/${id}/estado`, { estado });
  }
}
