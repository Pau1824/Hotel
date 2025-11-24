import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface LoginResponse {
  token: string;
  user: {
    id_usuario: number;
    nombreusuario: string;
    rol: string;
    id_hotel: number | null;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private API = 'http://localhost:5000/api/auth'; // tu backend real

  constructor(private http: HttpClient) {}

  login(nombreusuario: string, contrasena: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API}/login`, { nombreusuario, contrasena });
  }

  setSession(token: string, user: any) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  logout() {
    localStorage.clear();
  }

  getToken(): string | null {
  return localStorage.getItem('token');
}

  get user(): any {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }

  isLoggedIn(): boolean {
  return !!this.getToken();
}
}
