import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf, NgClass, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservaDetalleComponent } from './reserva-detalle.component';
import { ReservasService } from './reservas.service';


interface Reserva {
  folio: string;
  nombre: string;
  apellido1_huesped: string;
  apellido2_huesped: string;
  huesped: string;
  habitacion: string;
  noches: number;
  total: number;
  estado: string;
  // noches?: number; // 'noches' se calcula en el frontend
  nombreCompleto?: string; // Aquí agregamos el campo 'nombreCompleto'
}

@Component({
  standalone: true,
  selector: 'app-reservas',
  imports: [NgFor, NgIf, NgClass, CurrencyPipe, CommonModule, FormsModule, ReservaDetalleComponent],
  template: `
  <div class="p-6 space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-semibold text-brand_dark">Reservas</h1>
      <button (click)="nuevaReserva()" class="btn-primary flex items-center gap-2">
        <span class="material-symbols-rounded text-sm">add</span> Nueva Reserva
      </button>
    </div>

    <div class="card p-5 overflow-x-auto">
      <table class="min-w-full text-sm text-slate-700">
        <thead class="text-slate-500 border-b">
          <tr>
            <th class="text-left py-2 px-3">Folio</th>
            <th class="text-left py-2 px-3">Huésped</th>
            <th class="text-left py-2 px-3">Habitación</th>
            <th class="text-center py-2 px-3">Noches</th>
            <th class="text-center py-2 px-3">Total</th>
            <th class="text-center py-2 px-3">Estado</th>
            <th class="text-center py-2 px-3">Acciones</th>
          </tr>
        </thead>

        <tbody>
          <tr *ngFor="let r of reservas" class="border-b hover:bg-slate-50">
            <td class="py-3 px-3">{{ r.folio }}</td>
            <td class="py-3 px-3">{{ r.nombre }} {{ r.apellido1 }} {{ r.apellido2 }}</td>
            <td class="py-3 px-3">{{ r.habitacion }}</td>  <!-- Número de habitación -->
            <td class="py-3 px-3 text-center">{{ r.noches }}</td>
            <td class="py-3 px-3 text-center font-medium">{{ r.total | currency:'MXN':'symbol':'1.0-0' }}</td>
            <td class="py-3 px-3 text-center">
              <span [ngClass]="{
                'bg-sky-100 text-sky-700': r.estado === 'Activa',
                'bg-emerald-100 text-emerald-700': r.estado === 'En curso',
                'bg-slate-100 text-slate-600': r.estado === 'Finalizada'
              }" class="px-2.5 py-1 text-xs rounded-md font-medium">
                {{ r.estado }}
              </span>
            </td>
            <td class="py-3 px-3 text-center space-x-2">
              <button class="text-sky-600 hover:underline" (click)="abrirDetalle(r.id_reservacion)">Ver detalles</button>
            </td>
          </tr>
        </tbody>
      </table>

      <app-reserva-detalle
        *ngIf="detalleAbierto"
        [reserva]="reservaSeleccionada"
        [habitaciones]="habitaciones"
        [movimientos]="movimientos"
        [catalogo]="catalogo"
        (onCerrar)="cerrarDetalle()"
        (onCancelarReserva)="cancelarReserva()"
        (onRegistrarMovimiento)="registrarMovimiento($event)"
        (cambiosGuardados)="onCambiosReserva($event)"
      ></app-reserva-detalle>


      <p *ngIf="!reservas.length" class="text-center text-slate-500 py-6">
        No hay reservas registradas.
      </p>
    </div>
  </div>
  `,
})
export class ReservasComponent implements OnInit {
  reservas: any[] = [];
  detalleAbierto = false;
  idSeleccionado: number | null = null;

  reservaSeleccionada: any = null;
  movimientos: any[] = [];
  catalogo: any[] = [];
  habitaciones: any[] = [];

  drawerAbierto: boolean = false;



  constructor(private http: HttpClient, private router: Router, private reservasService: ReservasService) {}



  ngOnInit() {
    this.cargarReservas();

    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd && e.url === '/reservas') {
        this.cargarReservas();  // recarga siempre
      }
    });
  }

  cargarReservas() {
  this.http.get<any[]>('http://localhost:5000/api/reservas').subscribe({
    
    next: (data) => {
      console.log('Backend respondió:', data);
      this.reservas = data;
      console.log('Iniciando request de reservas...');
      console.log('Datos crudos:', data);
      this.reservas = data.map((r) => ({
        ...r,
        nombre: r.nombre ?? r.nombre_huesped,
        apellido: r.apellido1_huesped || '',
        apellido2: r.apellido2_huesped || '',

        nombreCompleto: `${r.nombre ?? r.nombre_huesped} ${r.apellido1_huesped || ''} ${r.apellido2_huesped || ''}`.trim(),

        noches:
          (new Date(r.salida).getTime() - new Date(r.llegada).getTime()) /
          (1000 * 3600 * 24),
      }));

      console.log('Array procesado:', this.reservas);
    },
    error: (err) => {
      console.error('Error al pedir reservas:', err);
      console.error('Error cargando reservas:', err);
    },
  });
}


 abrirDetalle(id: number) {
  console.log("CLICK EN VER DETALLE", id);

  console.log("Abriendo detalle de reserva:", id);

  this.idSeleccionado = id;



  // 1️⃣ Cargar la reserva individual
  this.http.get<any>(`http://localhost:5000/api/reservas/${id}`)
    .subscribe({
      next: (reserva) => {
        this.reservaSeleccionada = reserva;

        console.log("Reserva recibida:", reserva);

        // MAPEO CORRECTO PARA EL FORMULARIO 
        this.reservaSeleccionada = {
          id: reserva.id_reservacion,
          nombre: reserva.nombre ?? reserva.nombre_huesped ?? '',
          apellido: reserva.apellido ?? reserva.apellido1_huesped ?? '',
          check_in: reserva.check_in.split('T')[0],
          check_out: reserva.check_out.split('T')[0],
          estado: reserva.estado,
          personas: reserva.personas,
          tarifa_base: reserva.tarifa_por_noche,
          id_habitacion: reserva.id_habitacion,
          adultos: reserva.adultos ?? 1,
          ninos: reserva.ninos ?? 0,
          tarifa_por_noche: Number(reserva.tarifa_por_noche ?? reserva.tarifa_base ?? 0)
        };

        console.log("Reserva mapeada:", this.reservaSeleccionada);

        this.drawerAbierto = true;

        // 2️Obtener movimientos
        this.http.get<any[]>(`http://localhost:5000/api/reservas/${id}/movimientos`)
          .subscribe({
            next: (movs: any[]) => {
              this.movimientos = movs;

              // 3Cargar habitaciones
              this.cargarHabitaciones();

              // 4️Cargar catálogo
              this.http.get<any[]>(`http://localhost:5000/api/conceptos/catalogo-movimientos`)
                .subscribe({
                  next: (cat: any[]) => {
                    this.catalogo = cat;

                    // Abrimos el drawer
                    this.detalleAbierto = true;
                  },
                  error: err => console.error("Error catalogo:", err)
                });
            },
            error: err => console.error("Error movimientos:", err)
          });
      },
      error: err => console.error("Error reserva:", err)
    });
}

cerrarDetalle() {
  this.detalleAbierto = false;
  this.idSeleccionado = null;
  this.reservaSeleccionada = null;
  this.movimientos = [];
}

onCambiosReserva(actualizada: any) {
  if (!actualizada) return;

  console.log('🟣 cambiosGuardados recibido en el padre:', actualizada);

  this.reservas = this.reservas.map(r =>
    r.id_reservacion === actualizada.id_reservacion
      ? {
          ...r,
          // nombres que usa tu template
          nombre:   actualizada.nombre_huesped ?? r.nombre,
          apellido1: actualizada.apellido1_huesped ?? r.apellido1,
          // si manejas apellido2, lo puedes dejar igual
          total:    actualizada.total_pagar ?? r.total,
          // si quieres también actualizar fechas / adultos / niños:
          llegada:  actualizada.check_in ?? r.llegada,
          salida:   actualizada.check_out ?? r.salida,
          adultos:  actualizada.adultos ?? r.adultos,
          ninos:    actualizada.ninos ?? r.ninos,
          id_habitacion: actualizada.id_habitacion ?? r.id_habitacion,
          estado: actualizada.estado ?? r.estado,
        }
      : r
  );

  this.cerrarDetalle();
}





cargarHabitaciones() {
  this.http.get<any[]>('http://localhost:5000/api/habitaciones')
    .subscribe({
      next: data => this.habitaciones = data,
      error: err => console.error("Error cargando habitaciones:", err)
    });
}

/*
guardarCambiosEnReserva(reservaEditada: any) {
  this.reservasService.actualizarReserva(reservaEditada.id, reservaEditada).subscribe({
    next: () => {
      console.log("Reserva actualizada!");
      this.drawerAbierto = false;

      // Recargar tabla
      this.cargarReservas();
    },
    error: (err) => {
      console.error("Error actualizando reserva:", err);
    }
  });
}*/

checkIn(reserva: any) {
  if (!confirm("¿Confirmar Check-In?")) return;

  this.reservasService.checkIn(reserva.id_reservacion).subscribe({
    next: (resp) => {
      alert("Check-In realizado");
      this.cargarReservas();
    },
    error: (err) => {
      console.error(err);
      alert(err.error?.error || "Error en check-in");
    }
  });
}

checkOut(reserva: any) {
  if (!confirm("¿Confirmar Check-Out?")) return;

  this.reservasService.checkOut(reserva.id_reservacion).subscribe({
    next: (resp) => {
      alert("Check-Out realizado");
      this.cargarReservas();
    },
    error: (err) => {
      console.error(err);
      alert(err.error?.error || "Error en check-out");
    }
  });
}



cancelarReserva() {
  console.log("Cancelar reserva");
  // Aquí llamas a DELETE o actualización de estado
}


registrarMovimiento(data: any) {
  if (!this.idSeleccionado) return;

  this.reservasService.crearMovimiento(this.idSeleccionado, data)
    .subscribe({
      next: () => {
        console.log("Movimiento registrado en el padre");
        // Nada más: el hijo emitirá el evento y refrescará todo
      },
      error: (err: any) => {
        console.error("Error registrando movimiento:", err);
        alert(err.error?.error || "Error al registrar movimiento");
      }
    });
}



refrescarDetalle() {
  if (!this.idSeleccionado) return;

  // 1. Recargar movimientos
  this.http.get<any[]>(`http://localhost:5000/api/reservas/${this.idSeleccionado}/movimientos`)
    .subscribe(movs => {
      this.movimientos = movs;
    });

  // 2. Recargar totales/saldo
  this.http.get<any>(`http://localhost:5000/api/reservas/${this.idSeleccionado}`)
    .subscribe(res => {
      if (this.reservaSeleccionada) {
        this.reservaSeleccionada.totales = res.totales;
      }
    });
}




  nuevaReserva() {
    this.router.navigateByUrl('/reservas/nueva');
  }
}

