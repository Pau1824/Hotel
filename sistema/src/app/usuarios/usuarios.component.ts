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
  correo?: string | null;  
  rol: 'recepcionista' | 'admin_local' | 'admin_cadena';
  es_activo: boolean;
  hora_creado: string; // timestamp del registro
}


interface UsuarioUI {
  id: number;
  usuario: string;
  nombreCompleto: string;
  telefono: string | null;
  correo: string | null;
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

  constructor(private http: HttpClient, private usuariosService: UsuariosService) {}

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

  // ===== Correo =====
  const correo: string | null = api.correo ?? raw.correo ?? null;

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
    correo,
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
          console.log('API usuarios:', rows);
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
    const ok = confirm(`¿Seguro que quieres activar al usuario "${u.usuario}"?`);
    if (!ok) return;

    this.cambiarEstado(u, true);
    }

    desactivar(u: UsuarioUI) {
    const ok = confirm(`¿Seguro que quieres desactivar al usuario "${u.usuario}"?`);
    if (!ok) return;

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

  // === estado para formulario nuevo usuario ===
nuevoVisible = false;
guardando = false;

nuevoUsuario = {
  usuario: '',
  nombre: '',
  apellido: '',
  telefono: '',
  correo: '',
  contrasena: '',
  repetirContrasena: '',
};

abrirNuevoUsuario() {
  this.nuevoVisible = true;
  this.guardando = false;
  this.nuevoUsuario = {
    usuario: '',
    nombre: '',
    apellido: '',
    telefono: '',
    correo: '',
    contrasena: '',
    repetirContrasena: '',
  };
}

cancelarNuevoUsuario() {
  this.nuevoVisible = false;
  this.guardando = false;
}

private usernameRegex = /^(?=.*[A-Za-z])[A-Za-z0-9]+$/; // letras y números, al menos una letra
private nombreRegex   = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;    // solo letras y espacios
private telefonoRegex = /^\d{10}$/;                     // exactamente 10 dígitos
private emailRegex    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async guardarNuevoUsuario() {
  // validaciones básicas
  const u = this.nuevoUsuario;

  // Trimeamos todo
  u.usuario  = u.usuario.trim();
  u.nombre   = u.nombre.trim();
  u.apellido = u.apellido.trim();
  u.telefono = u.telefono.trim();
  u.correo   = u.correo.trim();

  if (!u.usuario || !u.nombre || !u.apellido || !u.contrasena || !u.repetirContrasena) {
    alert('Llena todos los campos obligatorios.');
    return;
  }

  // -------- Usuario: letras y números, al menos una letra
  if (!this.usernameRegex.test(u.usuario)) {
    alert('El usuario solo puede tener letras y números y debe incluir al menos una letra.');
    return;
  }

  // -------- Nombre y apellidos: solo letras
  if (!this.nombreRegex.test(u.nombre)) {
    alert('El nombre solo puede contener letras y espacios.');
    return;
  }

  if (!this.nombreRegex.test(u.apellido)) {
    alert('Los apellidos solo pueden contener letras y espacios.');
    return;
  }

  // -------- Teléfono: opcional, pero si viene debe ser 10 dígitos
  if (u.telefono && !this.telefonoRegex.test(u.telefono)) {
    alert('El teléfono debe tener exactamente 10 dígitos (sin espacios ni símbolos).');
    return;
  }

  // -------- Correo: opcional, pero si viene debe tener formato válido
  if (u.correo && !this.emailRegex.test(u.correo)) {
    alert('Escribe un correo válido, por ejemplo: usuario@hotel.com');
    return;
  }

  if (u.contrasena.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  if (u.contrasena !== u.repetirContrasena) {
    alert('Las contraseñas no coinciden.');
    return;
  }

  this.guardando = true;

  const dto = {
    usuario: u.usuario.trim(),
    nombre: u.nombre.trim(),
    apellido: u.apellido.trim(),
    telefono: u.telefono.trim() || null,
    correo: u.correo.trim() || null,
    contrasena: u.contrasena,
  };

  this.usuariosService.crearUsuario(dto).subscribe({
    next: (apiUser: UsuarioApi) => {
      // reutilizamos tu mapeo
      const uiUser = this.mapearUsuario(apiUser);
      // lo metemos en el arreglo actual (si está filtrando por activo, entra bien)
      // solo lo añadimos si estás viendo pestaña "Activos"
      if (this.estadoFiltro === 'activo') {
        this.usuarios.push(uiUser);
      }

      this.nuevoVisible = false;
      this.guardando = false;

      // limpiar form
      this.nuevoUsuario = {
        usuario: '',
        nombre: '',
        apellido: '',
        telefono: '',
        correo: '',
        contrasena: '',
        repetirContrasena: '',
      };
    },
    error: (err) => {
      console.error('Error creando usuario:', err);
      this.guardando = false;
      alert(err.error?.error || 'Error al crear usuario');
    },
  });
}

// === estado para EDITAR usuario ===
editarVisible = false;
guardandoEdicion = false;
usuarioEnEdicion: UsuarioUI | null = null;

editarUsuario = {
  id: 0,
  usuario: '',
  nombre: '',
  apellido: '',
  telefono: '',
  correo: '',
  nuevaContrasena: '',
  repetirContrasena: '',
};

abrirEditarUsuario(u: UsuarioUI) {
  // separar nombre y apellidos a partir de nombreCompleto
  const partes = (u.nombreCompleto || '').split(' ');
  const nombre = partes.shift() || '';
  const apellido = partes.join(' ');

  this.editarUsuario = {
    id: u.id,
    usuario: u.usuario,
    nombre,
    apellido,
    telefono: u.telefono || '',
    correo: u.correo || '',
    nuevaContrasena: '',
    repetirContrasena: '',
  };

  this.editarVisible = true;
}


cancelarEditarUsuario() {
  this.editarVisible = false;
  this.usuarioEnEdicion = null;
}

guardarEdicionUsuario() {
  const u = this.editarUsuario;

  // Validaciones básicas (puedes reutilizar las de crear)
  if (!u.usuario || !u.nombre || !u.apellido) {
    alert('Llena todos los campos obligatorios.');
    return;
  }

  // === Usuario: letras y números, al menos una letra ===
  if (!this.usernameRegex.test(u.usuario)) {
    alert('El usuario solo puede tener letras y números y debe incluir al menos una letra.');
    return;
  }

  // === Nombre y apellidos: solo letras (reutilizamos nombreRegex) ===
  if (!this.nombreRegex.test(u.nombre)) {
    alert('El nombre solo puede contener letras y espacios.');
    return;
  }

  if (!this.nombreRegex.test(u.apellido)) {
    alert('Los apellidos solo pueden contener letras y espacios.');
    return;
  }

  // teléfono solo números y 10 dígitos (si no viene vacío)
  if (u.telefono && !/^\d{10}$/.test(u.telefono)) {
    alert('El teléfono debe tener exactamente 10 dígitos.');
    return;
  }

  // correo opcional pero, si viene, con formato válido
  if (u.correo && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(u.correo)) {
    alert('Ingresa un correo válido.');
    return;
  }

  const quiereCambiarPass = !!u.nuevaContrasena || !!u.repetirContrasena;

  if (quiereCambiarPass) {
    if (u.nuevaContrasena.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (u.nuevaContrasena !== u.repetirContrasena) {
      alert('Las contraseñas no coinciden.');
      return;
    }
  }


  this.guardandoEdicion = true;

  const dto: any = {
    usuario: u.usuario.trim(),
    nombre: u.nombre.trim(),
    apellido: u.apellido.trim(),
    telefono: u.telefono.trim() || null,
    correo: u.correo.trim() || null,
  };

  if (quiereCambiarPass) {
    dto.contrasena = u.nuevaContrasena;
  }

  this.http
    .put(`${this.API}/usuarios/${u.id}`, dto)
    .subscribe({
      next: () => {
        // Recargamos la tabla desde el backend
        this.cargarUsuarios();

        // Apagamos loading y cerramos modal
        this.guardandoEdicion = false;
        this.editarVisible = false;
      },
      error: (err) => {
        console.error('Error actualizando usuario', err);
        this.guardandoEdicion = false;   // 👈 importantísimo
        alert(err.error?.error || 'Error al actualizar usuario');
      },
    });
}




  // abrir modal "Nuevo usuario" o "Editar" lo puedes hacer ya con Angular Material o tu dialog actual
}
