import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export type UserRole = 'recepcionista' | 'admin_local' | 'admin_cadena';

export interface AuthUser {
  id_usuario: number;
  nombreusuario: string;
  rol: UserRole;
  id_hotel: number | null;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private API = `${environment.apiUrl}/auth`; // tu backend real

  constructor(private http: HttpClient) {}

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  login(nombreusuario: string, contrasena: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API}/login`, { nombreusuario, contrasena });
  }

  setSession(token: string, user: AuthUser) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  get user(): AuthUser | null {
    if (!this.isBrowser()) return null;

    const raw = localStorage.getItem('user');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  // Alias por si quieres llamarlo currentUser en otros lados
  get currentUser(): AuthUser | null {
    return this.user;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
      // aquí limpias TODO lo que tenga que ver con la sesión
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // si guardas más cosas de sesión, las puedes borrar aquí también:
      // localStorage.removeItem('selectedHotel');
      // localStorage.removeItem('selectedProperty');
    }

    // === HELPERS DE ROL (los usaremos en el guard y el layout) ===
  isAdmin(): boolean {
    const rol = this.user?.rol;
    return rol === 'admin_local' || rol === 'admin_cadena';
  }

  isRecepcionista(): boolean {
    return this.user?.rol === 'recepcionista';
  }
}
