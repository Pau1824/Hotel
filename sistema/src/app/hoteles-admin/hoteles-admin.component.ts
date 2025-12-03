import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { NgFor, NgIf, NgClass } from "@angular/common";
import Swal from "sweetalert2";

@Component({
  standalone: true,
  selector: "app-hoteles-admin",
  templateUrl: "./hoteles-admin.component.html",
  imports: [NgFor, NgIf, NgClass, FormsModule],
})
export class HotelesComponent implements OnInit {
  API = "http://localhost:5000/api/cadena/hoteles";

  hoteles: any[] = [];

  crearOpen = false;

  nuevoHotel = {
    codigo: "",
    nombre: "",
    locacion: "",
    zonahoraria: "GMT-6",
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarHoteles();
  }

  cargarHoteles() {
    this.http.get<any[]>(this.API).subscribe({
      next: (rows) => (this.hoteles = rows),
      error: (err) => console.error(err),
    });
  }

  // ===================
  // CREAR HOTEL
  // ===================
  guardarHotel() {
    const body = { ...this.nuevoHotel };

    this.http.post(this.API, body).subscribe({
      next: () => {
        Swal.fire("Hotel creado", "El hotel se registró correctamente", "success");
        this.crearOpen = false;
        this.cargarHoteles();
      },
      error: () => {
        Swal.fire("Error", "No se pudo crear el hotel", "error");
      },
    });
  }

  cambiarEstadoHotel(hotel: any, nuevoEstado: boolean) {

  Swal.fire({
    icon: 'question',
    title: nuevoEstado ? '¿Activar hotel?' : '¿Desactivar hotel?',
    text: `Hotel: ${hotel.nombre}`,
    showCancelButton: true,
    confirmButtonColor: nuevoEstado ? '#059669' : '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: nuevoEstado ? 'Activar' : 'Desactivar'
  }).then((r) => {
    if (!r.isConfirmed) return;

    this.http.patch(
      `http://localhost:5000/api/cadena/hoteles/${hotel.id_hotel}/estado`,
      { es_activo: nuevoEstado }
    ).subscribe({
      next: () => {
        hotel.es_activo = nuevoEstado;
        Swal.fire({
          icon: 'success',
          title: 'Listo',
          text: nuevoEstado
            ? 'El hotel ha sido activado.'
            : 'El hotel ha sido desactivado.',
          timer: 1800,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error(err);
        Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
      }
    });

  });

}


  // ===================
  // ACTIVAR / DESACTIVAR
  // ===================
  toggleEstado(hotel: any) {
    this.http
      .put(`${this.API}/${hotel.id_hotel}/estado`, {
        es_activo: !hotel.es_activo,
      })
      .subscribe(() => {
        hotel.es_activo = !hotel.es_activo;
      });
  }
}

