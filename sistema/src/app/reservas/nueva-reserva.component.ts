import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservasService } from './reservas.service';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { PLATFORM_ID} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';



@Component({
  selector: 'app-nueva-reserva',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6">

    <!-- ================= FORMULARIO ================= -->
    <div class="lg:col-span-2 space-y-8">

      <h2 class="text-xl font-semibold text-brand_dark">Información de la Reserva</h2>

      <!-- FOLIO -->
      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">Folio</label>
        <input class="input" type="text" [(ngModel)]="folio" readonly />
        <p class="text-xs text-slate-500">Generado automáticamente</p>
      </div>

      <!-- NOMBRE / APELLIDO -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="label">Nombre</label>
          <input class="input" [(ngModel)]="nombre" placeholder="Nombre del huésped" />
          <p *ngIf="nombre && !nombreRegex.test(nombre)" class="text-xs text-red-500 mt-1">* Requerido</p>
        </div>

        <div>
          <label class="label">Apellido</label>
          <input class="input" [(ngModel)]="apellido" placeholder="Apellido del huésped" />
          <p *ngIf="apellido && !nombreRegex.test(apellido)" class="text-xs text-red-500 mt-1">* Requerido</p>
        </div>
      </div>

      <!-- HABITACIÓN -->
      <div>
        <label class="label">Habitación</label>
        <select class="input" [ngModel]="habitacionSeleccionada()" (ngModelChange)="habitacionSeleccionada.set($event); actualizarTarifa()">
          <option [ngValue]="null">Seleccionar habitación</option>
          <option *ngFor="let h of habitaciones()" [ngValue]="h" [disabled]="!estaDisponible(h)">
            Habitación {{ h.numero }} — {{ h.tipo }} 
          </option>
        </select>
        <p class="text-xs text-red-500 mt-1" *ngIf="habitacionSeleccionada() && !estaDisponible(habitacionSeleccionada()!)">
          * Esta habitación no está disponible.
        </p>
      </div>

      <!-- FECHAS -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="label">Fecha de llegada</label>
          <input class="input" type="date" [(ngModel)]="checkIn" (change)="calcularNoches()" [min]="today" />
          <p class="text-xs text-red-500 mt-1" *ngIf="checkIn && validarFechas()">
            {{ validarFechas() }}
          </p>
        </div>

        <div>
          <label class="label">Fecha de salida</label>
          <input class="input" type="date" [(ngModel)]="checkOut" (change)="calcularNoches()" [min]="checkIn"/>
        </div>
      </div>

      <!-- ADULTOS / NIÑOS -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <!-- ADULTOS -->
        <div>
          <label class="label">Adultos</label>
          <div class="flex items-center gap-4">
            <button class="btn-circle" (click)="decrementarAdultos()" [disabled]="adultos <= 1">−</button>
            <span class="text-lg font-medium">{{ adultos }}</span>
            <button class="btn-circle" (click)="incrementarAdultos()" [disabled]="adultos >= ((habitacionSeleccionada()?.adultos_max || 0) + (habitacionSeleccionada()?.adultos_extra_max || 0))">+</button>
          </div>
          <p *ngIf="adultos >= maxAdultosPermitidos" class="text-xs text-red-500 mt-1">
            Límite máximo: {{ maxAdultosPermitidos }} adultos.
          </p>
        </div>

        <!-- NIÑOS -->
        <div>
          <label class="label">Niños</label>
          <div class="flex items-center gap-4">
            <button class="btn-circle" (click)="decrementarNinos()" [disabled]="ninos <= 0">−</button>
            <span class="text-lg font-medium">{{ ninos }}</span>
            <button class="btn-circle" (click)="incrementarNinos()" [disabled]="ninos >= ((habitacionSeleccionada()?.ninos_max || 0) + (habitacionSeleccionada()?.ninos_extra_max || 0))">+</button>
          </div>
          <p *ngIf="ninos >= maxNinosPermitidos" class="text-xs text-red-500 mt-1">
            Límite máximo: {{ maxNinosPermitidos }} niños.
          </p>
        </div>

        <!-- CAMAS EXTRA -->
          <div class="md:col-span-2">
            <label class="label">Camas extra</label>

            <p class="text-xs text-slate-500 mb-1">
              Máximo permitido: {{ camasExtraMax }}  
              <span *ngIf="precioCamaExtra > 0">
                · {{ precioCamaExtra }} por noche
              </span>
            </p>

            <div class="flex items-center gap-4">
              <button
                type="button"
                class="btn-circle"
                (click)="cambiarCamasExtra(-1)"
                [disabled]="camasExtra <= 0"
              >
                −
              </button>

              <span class="text-lg font-medium">
                {{ camasExtra }}
              </span>

              <button
                type="button"
                class="btn-circle"
                (click)="cambiarCamasExtra(1)"
                [disabled]="camasExtra >= camasExtraMax"
              >
                +
              </button>
            </div>
          </div>



      </div>

    </div>

    <!-- ================= RESUMEN ================= -->
    <div class="bg-white rounded-2xl shadow-md p-6 h-fit">

      <h3 class="text-lg font-semibold text-brand_dark mb-4">Resumen</h3>

      <div class="space-y-3 text-sm">
        
        <div class="flex justify-between">
          <span>Tarifa por noche</span>
          <span class="font-medium">{{ tarifa }}</span>
        </div>

        <div class="flex justify-between">
          <span>Noches</span>
          <span class="font-medium">{{ noches }}</span>
        </div>

        <div class="flex justify-between">
          <span>Subtotal</span>
          <span class="font-medium">{{ subtotal }}</span>
        </div>

        <div class="flex justify-between">
          <span>IVA 16%</span>
          <span class="font-medium">{{ iva }}</span>
        </div>

        <div class="flex justify-between text-brand_primary text-lg font-semibold mt-3">
          <span>Total a pagar</span>
          <span>{{ total }}</span>
        </div>
      </div>

      <button 
        class="w-full mt-6 bg-brand_primary text-white font-semibold py-3 rounded-lg"
        (click)="guardarReserva()"
        [disabled]="
          validarFechas() ||
          validarCapacidad() ||
          validarCamasExtra() ||
          !habitacionSeleccionada ||
          !nombre ||
          !apellido
        "
      >
        Guardar reserva
      </button>

    </div>
  </div>
  `,

  styles: [`
    .input { @apply w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none; }
    .label { @apply text-sm font-medium text-slate-700; }
    .btn-circle { @apply bg-brand_primary text-white w-8 h-8 flex items-center justify-center rounded-full; }
  `]
})
export class NuevaReservaComponent {

  private http = inject(HttpClient);
  private reservasService = inject(ReservasService);
  private router = inject(Router);
  platformId = inject(PLATFORM_ID);


  constructor(
  private route: ActivatedRoute
) {}

  // VARIABLES
  folio = signal<string>('');

  // 1️ REEMPLAZA la definición de today (línea ~219)
  today: string = (() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalizar a medianoche
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();


  habitaciones = signal<any[]>([]);
  habitacionesDisponibles = signal<number[]>([]);
  habitacion: number | null = null;

  habitacionSeleccionada = signal<any | null>(null);

  nombreRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ ]+$/;

  nombre = '';
  apellido = '';

  checkIn = '';
  checkOut = '';

  adultos = 1;
  ninos = 0;

  tarifa = 0;
  noches = 1;
  subtotal = 0;
  iva = 0;
  total = 0;
  metodoPago: string = "efectivo";

  camasExtra: number = 0;
  camasExtraMax: number = 0;
  precioCamaExtra: number = 0;

  get cargoCamasExtra(): number {
    return this.camasExtra * this.precioCamaExtra * this.noches;
  }

  get maxAdultosPermitidos(): number {
    if (!this.habitacionSeleccionada()) return 1;
    return this.habitacionSeleccionada()!.adultos_max + this.habitacionSeleccionada()!.adultos_extra_max;
  }

  get maxNinosPermitidos(): number {
    if (!this.habitacionSeleccionada()) return 0;
    return this.habitacionSeleccionada()!.ninos_max + this.habitacionSeleccionada()!.ninos_extra_max;
  }

  /*
  get adultosExtra(): number {
    if (!this.habitacionSeleccionada) return 0;

    const gratis = this.habitacionSeleccionada.adultos_max;
    const extraPermitidos = this.habitacionSeleccionada.adultos_extra_max;

    const exceso = this.adultos - gratis;

    if (exceso <= 0) return 0; // no hay extra

    return Math.min(exceso, extraPermitidos);
}

get cargoAdultosExtra(): number {
  return this.adultosExtra * (this.habitacionSeleccionada?.precio_adulto_extra || 0) * this.noches;
}

get cargoNinosExtra(): number {
  return this.ninosExtra * (this.habitacionSeleccionada?.precio_nino_extra || 0) * this.noches;
}


get ninosExtra(): number {
  if (!this.habitacionSeleccionada) return 0;

  const gratis = this.habitacionSeleccionada.ninos_max;
  const extraPermitidos = this.habitacionSeleccionada.ninos_extra_max;

  const exceso = this.ninos - gratis;

  if (exceso <= 0) return 0;

  return Math.min(exceso, extraPermitidos);
}*/



  obtenerFolio() {
  this.http.get<any>(`${environment.apiUrl}/reservas/folio/siguiente`)
    .subscribe({
      next: (resp) => {
        console.log("Folio recibido del backend:", resp);
        this.folio = resp.folio;
      },
      error: (err) => {
        console.error("Error obteniendo folio:", err);
      }
    });
}




  ngOnInit() {
    // 1. Leer el número de habitación enviado en la URL
    const numeroHab = Number(this.route.snapshot.queryParamMap.get('habitacion'));
    console.log(" Param habitacion recibido:", numeroHab);

    this.obtenerFolio();

    this.http.get<any[]>(`${environment.apiUrl}/habitaciones`).subscribe({
      next: (data) => {
        console.log(" OBJETOS HAB:", data);
        this.habitaciones.set(data.map(h => ({
          ...h,
          precio_adulto_extra: Number(h.precio_adulto_extra),
          precio_nino_extra: Number(h.precio_nino_extra),
          precio_cama_extra: Number(h.precio_cama_extra)
        })));

        console.log("Habitaciones cargadas (procesadas):", this.habitaciones);

        this.verificarDisponibilidad();

        // 4. Si venimos desde /habitaciones, auto-seleccionamos
        if (numeroHab) {
          const hab = this.habitaciones().find((h:any) => Number(h.numero) == numeroHab);
          console.log(" Hab encontrada:", hab);
          if (hab) {
            this.habitacionSeleccionada.set(hab);
            this.actualizarTarifa(); // opcional, si quieres actualizar la tarifa instantáneamente
          }
        }
      },
      error: (err) => console.error("Error cargando habitaciones:", err)
    });
  }

  verificarDisponibilidad() {
    // Ya no filtramos por fechas en el front.
    const todosLosIds = this.habitaciones().map(h => h.id_habitacion);
    this.habitacionesDisponibles.set(todosLosIds);
  }


  estaDisponible(habitacion: any): boolean {
    // Solo bloqueamos si físicamente no se puede usar
    const estadosNoDisponibles = ['mantenimiento', 'bloqueada', 'fuera_servicio', 'inactiva'];
    return !estadosNoDisponibles.includes(habitacion.estado?.toLowerCase());
  }




  cargarHabitaciones() {
    this.http.get<any[]>(`${environment.apiUrl}/habitaciones`).subscribe({
      next: (data) => {
        this.habitaciones.set(data);
      },
      error: (err) => {
        console.error("Error cargando habitaciones:", err);
      }
    });
  }

  actualizarTarifa() {
    console.log("actualizarTarifa() disparado");
    console.log("habitacionSeleccionada:", this.habitacionSeleccionada);

    if (!this.habitacionSeleccionada()) {
      console.warn(" No hay habitación seleccionada");
      this.tarifa = 0;
      this.camasExtra = 0;
      this.camasExtraMax = 0;
      this.precioCamaExtra = 0;
      this.calcularTotales();
      return;
    }

    const id = this.habitacionSeleccionada().id_habitacion;
    console.log(" Id seleccionado:", id);

    //  Tarifa base que ya usas
    this.tarifa = Number(this.habitacionSeleccionada().tarifa_base || 0);

    //  NUEVO: datos para camas extra desde la BD
    this.camasExtra = 0; // reset cada que cambias de habitación
    this.camasExtraMax = Number(this.habitacionSeleccionada().camas_extra_max || 0);
    this.precioCamaExtra = Number(this.habitacionSeleccionada().precio_cama_extra || 0);

    console.log("camasExtraMax:", this.camasExtraMax);
    console.log("precioCamaExtra:", this.precioCamaExtra);

    this.calcularTotales();

    this.reservasService.obtenerTarifa(id).subscribe({
      next: (data) => {
        console.log("Tarifa recibida:", data);

        this.tarifa = Number(data.tarifa) || 0;
        this.calcularTotales();
      },
      error: (err) => {
        console.error("Error obteniendo tarifa:", err);
        Swal.fire({
          icon: 'error',
          title: 'Error obteniendo tarifa',
          text: err.error?.error || "Error desconocido al consultar la tarifa.",
          confirmButtonColor: '#0ea5e9',
        });
      }
    });
  }

  cambiarCamasExtra(delta: number) {
    if (this.camasExtraMax <= 0) {
      // Esta habitación no permite camas extra
      return;
    }

    const nuevoValor = this.camasExtra + delta;

    if (nuevoValor < 0 || nuevoValor > this.camasExtraMax) {
      return;
    }

    this.camasExtra = nuevoValor;
    this.calcularTotales();
  }





  calcularNoches() {
    if (!this.checkIn || !this.checkOut) {
      this.noches = 1;
      this.calcularTotales();
      return;
    }

    const inicio = new Date(this.checkIn);
    const fin = new Date(this.checkOut);
    const diff = fin.getTime() - inicio.getTime();
    
    this.noches = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));

    console.log(` Noches calculadas: ${this.noches}`);
    
    this.calcularTotales();
    
    //  IMPORTANTE: Verificar disponibilidad cada vez que cambien las fechas
    this.verificarDisponibilidad();
  }




  get adultosExtra(): number {
    if (!this.habitacionSeleccionada) return 0;

    const gratis = Number(this.habitacionSeleccionada().adultos_max);
    const extraMax = Number(this.habitacionSeleccionada().adultos_extra_max);

    const exceso = this.adultos - gratis;

    if (exceso <= 0) return 0;

    return Math.min(exceso, extraMax);
  }

  get cargoAdultosExtra(): number {
    if (!this.habitacionSeleccionada) return 0;

    const precio = Number(this.habitacionSeleccionada().precio_adulto_extra || 0);

    return this.adultosExtra * precio * this.noches;
  }

  get ninosExtra(): number {
    if (!this.habitacionSeleccionada) return 0;

    const gratis = Number(this.habitacionSeleccionada().ninos_max);
    const extraMax = Number(this.habitacionSeleccionada().ninos_extra_max);

    const exceso = this.ninos - gratis;

    if (exceso <= 0) return 0;

    return Math.min(exceso, extraMax);
  }

  get cargoNinosExtra(): number {
    if (!this.habitacionSeleccionada) return 0;

    const precio = Number(this.habitacionSeleccionada().precio_nino_extra || 0);

    return this.ninosExtra * precio * this.noches;
  }





  calcularTotales() {
    // Si no hay fechas todavía, deja todo en 0
    if (!this.checkIn || !this.checkOut || !this.tarifa) {
      this.subtotal = 0;
      this.iva = 0;
      this.total = 0;
      return;
    }

    const base = this.tarifa * this.noches;

    // Si ya manejas adultos/niños extra, súmalos aquí también
    const cargoAdultosExtra = this.cargoAdultosExtra;
    const cargoNinosExtra = this.cargoNinosExtra;


    // NUEVO: camas extra
    const cargoCamasExtra = this.cargoCamasExtra;

    this.subtotal = base + cargoAdultosExtra + cargoNinosExtra + cargoCamasExtra;

    this.iva = +(this.subtotal * 0.16).toFixed(2);
    this.total = +(this.subtotal + this.iva).toFixed(2);

    console.log({
      base,
      cargoAdultosExtra,
      cargoNinosExtra,
      cargoCamasExtra,
      subtotal: this.subtotal,
      total: this.total
    });
  }

/* ============================================================
   VALIDACIONES — FRONTEND (CORREGIDAS PARA TU CÓDIGO REAL)
   ============================================================ */

validarFechas(): string | null {
  const llegada = this.checkIn;
  const salida = this.checkOut;

  if (!llegada || !salida) return "Debe seleccionar fechas válidas.";

  // Crear fechas normalizadas
  const [yIn, mIn, dIn] = llegada.split('-').map(Number);
  const [yOut, mOut, dOut] = salida.split('-').map(Number);
  const [yHoy, mHoy, dHoy] = this.today.split('-').map(Number);

  const inDate = new Date(yIn, mIn - 1, dIn);
  const outDate = new Date(yOut, mOut - 1, dOut);
  const hoy = new Date(yHoy, mHoy - 1, dHoy);

  // Normalizar TODAS a medianoche
  inDate.setHours(0, 0, 0, 0);
  outDate.setHours(0, 0, 0, 0);
  hoy.setHours(0, 0, 0, 0);

  console.log(' DEBUG Validación:', {
    llegada,
    salida,
    today: this.today,
    inDate: inDate.toISOString(),
    hoy: hoy.toISOString(),
    inTime: inDate.getTime(),
    hoyTime: hoy.getTime(),
    esAntes: inDate.getTime() < hoy.getTime(),
    esIgual: inDate.getTime() === hoy.getTime()
  });

  //  LA CLAVE: Usar getTime() para comparar timestamps
  if (inDate.getTime() < hoy.getTime()) {
    return "La fecha de llegada no puede ser antes de hoy.";
  }

  if (outDate.getTime() <= inDate.getTime()) {
    return "El check-out debe ser posterior al check-in.";
  }

  return null;
}

// Función que convierte un YYYY-MM-DD a un date plano sin timezone
private toLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

private getLocalToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

validarCapacidad(): string | null {
  const h = this.habitacionSeleccionada();
  if (!h) return "Seleccione una habitación.";

  const adultos = this.adultos;
  const ninos   = this.ninos;

  const maxAdultos = h.adultos_max + h.adultos_extra_max;
  const maxNinos   = h.ninos_max   + h.ninos_extra_max;

  if (adultos > maxAdultos) return `Máximo ${maxAdultos} adultos permitidos en esta habitación.`;
  if (ninos > maxNinos)     return `Máximo ${maxNinos} niños permitidos en esta habitación.`;

  return null;
}

validarCamasExtra(): string | null {
  const h = this.habitacionSeleccionada();
  if (!h) return null;

  if (this.camasExtra > h.camas_extra_max) {
    return `Máximo ${h.camas_extra_max} camas extra permitidas.`;
  }

  return null;
}



  guardarReserva() {
    console.log("guardarReserva() disparado");

    // Validaciones front
    const v1 = this.validarFechas();
    if (v1) {
      Swal.fire({
        icon: 'warning',
        title: 'Fechas inválidas',
        text: v1,
        confirmButtonColor: '#0ea5e9',
      });
      return;
    }

    const v2 = this.validarCapacidad();
    if (v2) {
      Swal.fire({
        icon: 'warning',
        title: 'Capacidad excedida',
        text: v2,
        confirmButtonColor: '#0ea5e9',
      });
      return;
    }

    const v3 = this.validarCamasExtra();
    if (v3) {
      Swal.fire({
        icon: 'warning',
        title: 'Camas extra',
        text: v3,
        confirmButtonColor: '#0ea5e9',
      });
      return;
    }


    if (!this.habitacionSeleccionada()) {
      Swal.fire({
        icon: 'info',
        title: 'Selecciona una habitación',
        text: 'Debes elegir una habitación antes de guardar la reserva.',
        confirmButtonColor: '#0ea5e9',
      });
      return;
    }

    if (!this.nombre || !this.apellido) {
      Swal.fire({
        icon: 'info',
        title: 'Ingresa nombre y apellido',
        text: 'Debes ingresar el nombre y apellido antes de guardar la reserva',
        confirmButtonColor: '#0ea5e9',
      }
      )
      return;
    }

    if (!this.checkIn || !this.checkOut) {
      Swal.fire({
        icon: 'info',
        title: 'Selecciona fechas validas',
        text: 'Debes ingresar fechas validas antes de guardar la reserva',
        confirmButtonColor: '#0ea5e9',
      }
      )
      return;
    }

    // -----------------------------
    // OBTENER EL NÚMERO DE HABITACIÓN REAL
    // -----------------------------
    const id_habitacion = this.habitacionSeleccionada().id_habitacion;

    // Calcular cargo extra total (camas + otros extras si tienes)
    const cargoCamasExtra = this.cargoCamasExtra;

    // Si ya manejas adultos/ninos extra, súmalos también aquí:
    const cargoAdultosExtra = 0; // tu lógica si aplica
    const cargoNinosExtra = 0;   // tu lógica si aplica

    const cargoExtraTotal =
      cargoCamasExtra + cargoAdultosExtra + cargoNinosExtra;

    if (!id_habitacion) {
      console.error("ERROR: numero_habitacion viene undefined");
      Swal.fire({
        icon: 'error',
        title: 'Error interno',
        text: 'No se pudo obtener el número de habitación.',
        confirmButtonColor: '#0ea5e9',
      });
      return;
    }

    this.calcularTotales();

    if (!this.nombreRegex.test(this.nombre)) {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre inválido',
        text: 'El nombre solo puede contener letras.',
        confirmButtonColor: '#0ea5e9',
      });
      return;
    }

    if (!this.nombreRegex.test(this.apellido)) {
      Swal.fire({
        icon: 'warning',
        title: 'Apellido inválido',
        text: 'El apellido solo puede contener letras.',
        confirmButtonColor: '#0ea5e9',
      });
      return;
    }

    // -----------------------------
    // ARMAR EL PAYLOAD FINAL
    // -----------------------------
    const payload = {
      id_habitacion: this.habitacionSeleccionada().id_habitacion,
      llegada: this.checkIn,                 // formato YYYY-MM-DD
      salida: this.checkOut,
      folio: this.folio,
      nombre: this.nombre,
      apellido: this.apellido,
      apellido2: "",                         // si no usas segundo apellido
      personas: this.adultos,                // adultos
      ninos: this.ninos,                     // opcional, depende tu backend
      camas_extra: this.camasExtra,
      total_camas_extra: this.cargoCamasExtra,
      metodo_pago: this.metodoPago || "efectivo",
      tarifa_por_noche: this.tarifa,
      total_pagar: this.total
    };

    console.log("Payload final que se enviará al backend:", payload);

    // -----------------------------
    // PETICIÓN AL BACKEND
    // -----------------------------
    this.http.post(`${environment.apiUrl}/reservas`, payload).subscribe({
      next: (resp: any) => {
        console.log('Reserva guardada correctamente:', resp);
        Swal.fire({
          icon: 'success',
          title: 'Reserva creada',
          text: 'La reserva se registró correctamente.',
          confirmButtonColor: '#0ea5e9',
        }).then(() => {
          this.router.navigate(['/reservas']);
        });
      },
      error: (err) => {
        console.error('Error guardando reserva:', err);

        if (err.status === 409) {
          //  Habitación ya ocupada en ese rango
          Swal.fire({
            icon: 'warning',
            title: 'Habitación ocupada',
            text:
              err.error?.error ||
              'La habitación ya está reservada en ese rango de fechas.',
            confirmButtonColor: '#0ea5e9',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text:
              err.error?.error ||
              'Ocurrió un error al guardar la reserva.',
            confirmButtonColor: '#0ea5e9',
          });
        }
      },
    });
  }



  decrementarAdultos() {
    this.adultos = Math.max(1, this.adultos - 1);
    this.calcularTotales();
  }

  incrementarAdultos() {
    this.adultos++;
    this.calcularTotales();
  }

  decrementarNinos() {
    this.ninos = Math.max(0, this.ninos - 1);
    this.calcularTotales();
  }

  incrementarNinos() {
    this.ninos++;
    this.calcularTotales();
  }


}

