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
        *ngIf="detalleAbierto && reservaSeleccionada && reservaSeleccionada.id"
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
        console.log('✅ Backend respondió:', data);
        console.log('📊 Cantidad de reservas recibidas:', data.length);
        
        // ✅ SOLUCIÓN: Una sola asignación, limpia y clara
        const reservasProcesadas = data.map((r) => ({
          ...r,
          nombre: r.nombre ?? r.nombre_huesped,
          apellido1: r.apellido1_huesped || '',
          apellido2: r.apellido2_huesped || '',
          nombreCompleto: `${r.nombre ?? r.nombre_huesped} ${r.apellido1_huesped || ''} ${r.apellido2_huesped || ''}`.trim(),
          noches: (new Date(r.salida).getTime() - new Date(r.llegada).getTime()) / (1000 * 3600 * 24),
        }));

        console.log('🔧 Reservas procesadas:', reservasProcesadas.length);
        console.log('📋 Primera reserva:', reservasProcesadas[0]);

        // ✅ Asignar al array
        this.reservas = reservasProcesadas;

        // ✅ CRÍTICO: Forzar detección de cambios
        this.cdr.detectChanges();

        console.log('✅ Array final asignado. Length:', this.reservas.length);
        console.log('✅ Detección de cambios ejecutada');
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
