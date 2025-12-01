import { Component, OnInit } from '@angular/core';
import { UsuariosService, Usuario } from './usuarios.service';
import { FormsModule } from '@angular/forms'; 
import { CommonModule, NgIf,
  NgFor,
  NgClass,
  DatePipe, } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface UsuarioApi {
  id_usuario: number;
  usuario?: string;            // ya vimos que viene así
  nombreCompleto?: string;
  telefono: string | null;
  rol: 'recepcionista' | 'admin_local' | 'admin_cadena';
  es_activo: boolean;
  hora_creado: string; // timestamp del registro
}


interface UsuarioUI {
  id: number;
  usuario: string;
  nombreCompleto: string;
  telefono: string | null;
  rol: 'recepcionista';
  rolTexto: string;
  estado: 'activo' | 'inactivo';
  ultimoAcceso: string | null;
}

@Component({
  standalone: true,
  selector: 'app-usuarios',
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css'],
  imports: [
    CommonModule,   // aquí vienen NgClass, NgIf, NgFor, DatePipe...
    FormsModule,    // para [(ngModel)]
    NgIf, NgFor, NgClass, DatePipe
  ],
})
export class UsuariosComponent implements OnInit {
  private API = 'http://localhost:5000/api';

  // estado actual del filtro (chips)
  estadoFiltro: 'activo' | 'inactivo' = 'activo';

  // texto del buscador
  search = '';

  // listado que viene del backend ya mapeado para la UI
  usuarios: UsuarioUI[] = [];

  cargando = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  // ========================
  //  Helpers de mapeo
  // ========================
  private mapearUsuario(api: UsuarioApi): UsuarioUI {
  // acceso “libre” para llaves alternativas sin pelear con TS
  const raw: any = api;

  // ===== Usuario (login) =====
  const usuario: string =
    api.usuario ??
    raw.nombreusuario ??
    raw.username ??
    '';

  // ===== Nombre completo =====
  // 1) Si el backend ya manda nombreCompleto, úsalo directo
  let nombreCompleto: string =
    api.nombreCompleto ??
    raw.nombreCompleto ??
    raw.nombre_completo ??
    '';

  // 2) Si viene vacío, lo armamos con nombre + apellido por si acaso
  if (!nombreCompleto) {
    const primerNombre: string =
      raw.primer_nombre ??
      raw.nombres ??
      raw.nombre ??
      '';

    const apellido: string =
      raw.apellido ??
      raw.apellidos ??
      raw.apellido_paterno ??
      '';

    nombreCompleto = `${primerNombre} ${apellido}`.trim();
  }

  if (!nombreCompleto) {
    nombreCompleto = '—';
  }

  // ===== Teléfono =====
  const telefono: string | null = api.telefono ?? raw.telefono ?? null;

  // ===== Rol (forzado a recepcionista) =====
  const rol: UsuarioUI['rol'] = 'recepcionista';
  const rolTexto = 'Recepcionista';

  // ===== Estado (activo / inactivo) =====
  let esActivo = false;

  if (typeof api.es_activo === 'boolean') {
    esActivo = api.es_activo;
  } else if (typeof raw.es_activo === 'boolean') {
    esActivo = raw.es_activo;
  } else if (typeof raw.estado === 'string') {
    esActivo = raw.estado.toLowerCase() === 'activo';
  } else if (typeof raw.estado === 'boolean') {
    esActivo = raw.estado;
  }

  // ===== Último acceso (por ahora no tienes, así que null) =====
  const ultimoAcceso: string | null =
    raw.ultimo_acceso ?? raw.ultima_sesion ?? null;
  // si quieres usar la fecha de creación como “último acceso fake”, usa:
  // const ultimoAcceso: string | null =
  //   raw.ultimo_acceso ?? raw.ultima_sesion ?? api.hora_creado ?? null;

  return {
    id: api.id_usuario ?? raw.id ?? 0,
    usuario,
    nombreCompleto,
    telefono,
    rol,
    rolTexto,
    estado: esActivo ? 'activo' : 'inactivo',
    ultimoAcceso,
  };
}




  // ========================
  //  Cargar usuarios
  // ========================
  cargarUsuarios(): void {
    this.cargando = true;

    this.http
      .get<UsuarioApi[]>(`${this.API}/usuarios`, {
        params: { estado: this.estadoFiltro },
      })
      .subscribe({
        next: (rows) => {
          console.log('🔍 API usuarios:', rows);
          this.usuarios = rows.map((r) => this.mapearUsuario(r));
          this.cargando = false;
        },
        error: (err) => {
          console.error('Error cargando usuarios', err);
          this.cargando = false;
        },
      });
  }

  // Cambiar chip Activo/Inactivo
  setEstadoFiltro(estado: 'activo' | 'inactivo') {
    if (this.estadoFiltro === estado) return;
    this.estadoFiltro = estado;
    this.cargarUsuarios();
  }

  // ========================
  //  Filtro de búsqueda
  // ========================
  usuariosFiltrados(): UsuarioUI[] {
    const term = this.search.trim().toLowerCase();

    if (!term) {
      return this.usuarios;
    }

    return this.usuarios.filter((u) => {
      const usuario = (u.usuario || '').toLowerCase();
      const nombre = (u.nombreCompleto || '').toLowerCase();
      return usuario.includes(term) || nombre.includes(term);
    });
  }

  // ========================
  //  Activar / Desactivar
  // ========================
  activar(u: UsuarioUI) {
    this.cambiarEstado(u, true);
  }

  desactivar(u: UsuarioUI) {
    this.cambiarEstado(u, false);
  }

  private cambiarEstado(u: UsuarioUI, esActivo: boolean) {
    // Ajusta a PATCH si tu endpoint es PATCH en vez de PUT
    this.http
      .put(`${this.API}/usuarios/${u.id}/estado`, { es_activo: esActivo })
      .subscribe({
        next: () => {
          // Actualizamos en memoria y recargamos lista
          u.estado = esActivo ? 'activo' : 'inactivo';
          this.cargarUsuarios();
        },
        error: (err) => {
          console.error('Error actualizando estado de usuario', err);
        },
      });
  }

  // abrir modal "Nuevo usuario" o "Editar" lo puedes hacer ya con Angular Material o tu dialog actual
}
