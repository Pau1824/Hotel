import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { NgFor, NgIf, NgClass, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservaDetalleComponent } from './reserva-detalle.component';
import { ReservasService } from './reservas.service';
import { forkJoin, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';


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
    <!-- Título + botón -->
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-semibold text-brand_dark">Reservas</h1>

      <button
        (click)="nuevaReserva()"
        class="btn-primary flex items-center gap-2"
      >
        <span class="material-symbols-rounded text-sm">add</span>
        Nueva Reserva
      </button>
    </div>

  <div class="card p-5">
    <!-- Encabezado de tabla (opcional mini resumen) -->
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-slate-500">
        Listado de reservas 
      </p>
      <span class="text-xs text-slate-400">
        Total: {{ reservas.length }} reservas
      </span>
    </div>

    <!-- Tabla bonita -->
    <div class="-mx-4 overflow-x-auto">
      <table
        class="min-w-full border-separate border-spacing-y-1 text-sm text-slate-700"
      >
        <thead>
          <tr class="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <th class="text-left py-2 px-4">Folio</th>
            <th class="text-left py-2 px-4">Huésped</th>
            <th class="text-left py-2 px-4">Habitación</th>
            <th class="text-center py-2 px-4">Noches</th>
            <th class="text-right py-2 px-4">Total</th>
            <th class="text-center py-2 px-4">Estado</th>
            <th class="text-center py-2 px-4">Acciones</th>
          </tr>
        </thead>

        <tbody>
          <tr
            *ngFor="let r of reservas"
            class="group"
          >
            <!-- Folio -->
            <td
              class="bg-white group-hover:bg-sky-50 transition-colors
                    py-3 pl-4 pr-3 rounded-l-xl border border-slate-100 border-r-0
                    font-semibold text-slate-800"
            >
              {{ r.folio }}
            </td>

            <!-- Huésped -->
            <td
              class="bg-white group-hover:bg-sky-50 transition-colors
                    py-3 px-3 border border-slate-100 border-x-0"
            >
              {{ r.nombre }} {{ r.apellido1 }} {{ r.apellido2 }}
            </td>

            <!-- Habitación -->
            <td
              class="bg-white group-hover:bg-sky-50 transition-colors
                    py-3 px-3 border border-slate-100 border-x-0"
            >
              Hab {{ r.habitacion }}
            </td>

            <!-- Noches -->
            <td
              class="bg-white group-hover:bg-sky-50 transition-colors
                    py-3 px-3 border border-slate-100 border-x-0 text-center"
            >
              {{ r.noches }}
            </td>

            <!-- Total -->
            <td
              class="bg-white group-hover:bg-sky-50 transition-colors
                    py-3 px-4 border border-slate-100 border-x-0 text-right
                    font-semibold"
            >
              {{ r.total | currency:'MXN':'symbol':'1.0-0' }}
            </td>

            <!-- Estado -->
            <td
              class="bg-white group-hover:bg-sky-50 transition-colors
                    py-3 px-3 border border-slate-100 border-x-0 text-center"
            >
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                [ngClass]="{
                  'bg-sky-100 text-sky-700': r.estado === 'activa',
                  'bg-emerald-100 text-emerald-700': r.estado === 'en_curso',
                  'bg-slate-100 text-slate-500': r.estado === 'finalizada',
                  'bg-rose-100 text-rose-700': r.estado === 'cancelada'
                }"
              >
                {{ r.estado | titlecase }}
              </span>
            </td>

            <!-- Acciones -->
            <td
              class="bg-white group-hover:bg-sky-50 transition-colors
                    py-3 pr-4 pl-3 rounded-r-xl border border-slate-100 border-l-0
                    text-center"
            >
              <button
                class="inline-flex items-center gap-1 text-xs font-medium
                      text-sky-600 hover:text-sky-700 hover:underline"
                (click)="abrirDetalle(r.id_reservacion)"
              >
                <span class="material-symbols-rounded text-base">visibility</span>
                Ver detalle
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Sin datos -->
    <div
      *ngIf="!reservas.length"
      class="flex flex-col items-center justify-center py-10 text-center text-slate-400"
    >
      <span class="material-symbols-rounded text-4xl mb-2">event_busy</span>
      <p class="text-sm font-medium">No hay reservas registradas.</p>
      <p class="text-xs">
        Crea una nueva desde el botón “Nueva Reserva”.
      </p>
    </div>

    <!-- Tu componente de detalle se queda igual -->
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
  </div>
  `,
})
export class ReservasComponent implements OnInit, OnDestroy {
  reservas: any[] = [];
  detalleAbierto = false;
  idSeleccionado: number | null = null;
  cargandoDetalle = false;
  cargandoReservas = false;

  reservaSeleccionada: any = null;
  movimientos: any[] = [];
  catalogo: any[] = [];
  habitaciones: any[] = [];

  //drawerAbierto: boolean = false;

  private paramsSubscription?: Subscription;

  private routerSubscription?: Subscription;

  private isFirstLoad = true;

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute, private reservasService: ReservasService, private cdr : ChangeDetectorRef) {}



  ngOnInit() {
    console.log("🟢 ngOnInit - ReservasComponent inicializado");
    
    // ✅ MÉTODO ALTERNATIVO: Suscribirse a queryParams
    // Esto se dispara cada vez que la ruta cambia
    this.paramsSubscription = this.route.queryParams.subscribe(() => {
      console.log("🔄 Route params cambió, recargando...");
      this.cargarReservas();
    });

    // ✅ Carga inicial también
    this.cargarReservas();
  }

  ngOnDestroy() {
    // ✅ Limpiar la suscripción al destruir el componente
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  // ✅ TrackBy para mejor performance
  trackByReserva(index: number, reserva: any): any {
    return reserva.id_reservacion || index;
  }

  cargarReservas() {
  console.log("📥 Cargando reservas...");
  
  this.http.get<any[]>('http://localhost:5000/api/reservas').subscribe({
    next: (data) => {
      console.log('✅ Backend respondió con', data.length, 'reservas');
      console.log('📋 Primera reserva RAW del backend:', data[0]);
      
      // ✅ El backend YA envía los datos con los nombres correctos (usando AS)
      // nombre, apellido1, apellido2, llegada, salida, etc.
      const reservasProcesadas = data.map((r) => {
        return {
          ...r,
          // ✅ NO necesitas mapear nada porque el backend ya usa AS
          // Solo calcula las noches
          noches: Math.ceil((new Date(r.salida).getTime() - new Date(r.llegada).getTime()) / (1000 * 3600 * 24)),
        };
      });

      console.log('📋 Primera reserva procesada:', reservasProcesadas[0]);

      this.reservas = reservasProcesadas;
      this.cdr.detectChanges();

      console.log('✅ Reservas cargadas:', this.reservas.length);
    },
    error: (err) => {
      console.error('❌ Error cargando reservas:', err);
    },
  });
}


 abrirDetalle(id: number) {
    console.log("🔵 CLICK EN VER DETALLE", id);
    
    // Evitar múltiples clics mientras carga
    if (this.cargandoDetalle) {
      console.log("⚠️ Ya se está cargando un detalle");
      return;
    }

    // Limpiar estado anterior PRIMERO
    this.detalleAbierto = false;
    this.reservaSeleccionada = null;
    this.movimientos = [];
    this.habitaciones = [];
    this.catalogo = [];
    
    this.idSeleccionado = id;
    this.cargandoDetalle = true;

    console.log("📡 Iniciando peticiones HTTP...");

    // Usar setTimeout para asegurar que Angular procese el cierre
    setTimeout(() => {
      forkJoin({
        reserva: this.http.get<any>(`http://localhost:5000/api/reservas/${id}`),
        movimientos: this.http.get<any[]>(`http://localhost:5000/api/reservas/${id}/movimientos`),
        habitaciones: this.http.get<any[]>('http://localhost:5000/api/habitaciones'),
        catalogo: this.http.get<any[]>(`http://localhost:5000/api/conceptos/catalogo-movimientos`)
      }).subscribe({
        next: (resultado) => {
          console.log("✅ Todos los datos cargados:", resultado);

          // Mapear la reserva
          const reserva = resultado.reserva;
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

          // Asignar los demás datos
          this.movimientos = resultado.movimientos || [];
          this.habitaciones = resultado.habitaciones || [];
          this.catalogo = resultado.catalogo || [];

          console.log("📦 Reserva mapeada:", this.reservaSeleccionada);
          console.log("📦 Movimientos:", this.movimientos.length);
          console.log("📦 Habitaciones:", this.habitaciones.length);
          console.log("📦 Catálogo:", this.catalogo.length);

          // Esperar un tick más antes de abrir
          setTimeout(() => {
            this.detalleAbierto = true;
            this.cargandoDetalle = false;
            this.cdr.detectChanges();
            console.log("🟢 Detalle abierto:", this.detalleAbierto);
          }, 50);
        },
        error: (err) => {
          console.error("❌ Error cargando datos del detalle:", err);
          alert("Error al cargar los detalles de la reserva");
          this.cargandoDetalle = false;
          this.detalleAbierto = false;
          this.cdr.detectChanges();
        }
      });
    }, 100);
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
