import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule, NgIf, NgFor } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import Swal from "sweetalert2";
import { environment } from '../../environments/environment';

@Component({
  standalone: true,
  selector: "app-usuarios-admin-local",
  templateUrl: "./usuarios-admin-local.component.html",
  styleUrls: ["./usuarios-admin-local.component.css"],
  imports: [CommonModule, FormsModule, NgIf, NgFor],
})
export class UsuariosAdminLocalComponent implements OnInit {
  private API = `${environment.apiUrl}/cadena`;

  hoteles: any[] = [];
  usuarios: any[] = [];

  cargando = false;

  // modales
  nuevoVisible = false;
  editarVisible = false;

  nuevo = {
    usuario: "",
    nombre: "",
    apellido: "",
    telefono: "",
    correo: "",
    contrasena: "",
    repetir: "",
    id_hotel: null,
  };

  editar: any = {};

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarHoteles();
    this.cargarUsuarios();
  }

  cargarHoteles() {
    this.http.get<any[]>(`${this.API}/hoteles`).subscribe({
      next: rows => this.hoteles = rows,
    });
  }

  cargarUsuarios() {
    this.cargando = true;
    this.http.get<any[]>(`${this.API}/usuarios-locales`).subscribe({
      next: (rows) => {
        this.usuarios = rows;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        Swal.fire("Error", "No se pudieron cargar los usuarios", "error");
      }
    });
  }

  abrirNuevo() {
    this.nuevoVisible = true;
    this.nuevo = {
      usuario: "",
      nombre: "",
      apellido: "",
      telefono: "",
      correo: "",
      contrasena: "",
      repetir: "",
      id_hotel: null,
    };
  }

  guardarNuevo(): void {
    if (this.nuevo.contrasena !== this.nuevo.repetir) {
      Swal.fire("Oops", "Las contraseñas no coinciden", "warning");
      return;
    }

    const payload = {
        nombreusuario: this.nuevo.usuario,
        primer_nombre: this.nuevo.nombre,
        apellido: this.nuevo.apellido,
        telefono: this.nuevo.telefono,
        correo: this.nuevo.correo,
        contrasena: this.nuevo.contrasena,
        id_hotel: this.nuevo.id_hotel
        };

    this.http.post(`${this.API}/usuarios-locales`, payload).subscribe({
      next: () => {
        Swal.fire("Usuario creado", "El admin_local fue agregado correctamente.", "success");
        this.nuevoVisible = false;
        this.cargarUsuarios();
      },
      error: (err) => {
        Swal.fire("Error", err.error?.error || "No se pudo crear el usuario", "error");
      }
    });
  }

  abrirEditar(u: any) {
    this.editarVisible = true;
    this.editar = {
      id_usuario: u.id_usuario,
      usuario: u.usuario,
      nombre: u.nombre,
      apellido: u.apellido,
      telefono: u.telefono,
      correo: u.correo,
      id_hotel: u.id_hotel,
      nuevaContrasena: "",
      repetir: ""
    };
  }

  guardarEdicion(): void {
    if (this.editar.nuevaContrasena && this.editar.nuevaContrasena !== this.editar.repetir) {
      Swal.fire("Atención", "Las contraseñas no coinciden.", "warning");
      return;
    }

    const payload = { ...this.editar };
    if (!payload.nuevaContrasena) delete payload.nuevaContrasena;
    delete payload.repetir;

    this.http.put(`${this.API}/usuarios-locales/${payload.id_usuario}`, payload)
      .subscribe({
        next: () => {
          Swal.fire("Actualizado", "Los cambios fueron guardados.", "success");
          this.editarVisible = false;
          this.cargarUsuarios();
        },
        error: err => {
          Swal.fire("Error", err.error?.error || "No se pudo actualizar el usuario", "error");
        }
      });
  }

  cambiarEstado(u: any, activo: boolean) {
    this.http.patch(`${this.API}/usuarios-locales/${u.id_usuario}/estado`, {
      es_activo: activo
    }).subscribe({
      next: () => {
        Swal.fire(
          activo ? "Activado" : "Desactivado",
          "El estado fue actualizado.",
          "success"
        );
        this.cargarUsuarios();
      },
      error: err => {
        Swal.fire("Error", err.error?.error, "error");
      }
    });
  }
}

