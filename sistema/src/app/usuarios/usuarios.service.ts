import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

export interface CrearUsuarioDto {
  usuario: string;
  nombre: string;
  apellido: string;
  telefono?: string | null;
  correo?: string | null;
  contrasena: string;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private API = '${environment.apiUrl}/usuarios';

  constructor(private http: HttpClient) {}

  getUsuarios(estado: 'activo' | 'inactivo' | 'todos' = 'activo', search?: string): Observable<Usuario[]> {
    let params = new HttpParams().set('estado', estado);

    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }

    return this.http.get<Usuario[]>(this.API, { params });
}

  crearUsuario(dto: CrearUsuarioDto): Observable<any> {
    return this.http.post<any>(`${this.API}`, {
      nombreusuario: dto.usuario,
      primer_nombre: dto.nombre,
      apellido: dto.apellido,
      telefono: dto.telefono || null,
      correo: dto.correo || null,
      contrasena: dto.contrasena,
    });
  }

  actualizarUsuario(id: number, dto: any) {
    return this.http.put(`${this.API}/${id}`, dto);
  }

  cambiarEstado(id: number, estado: 'activo' | 'inactivo') {
    return this.http.patch(`${this.API}/${id}/estado`, { estado });
  }
}
