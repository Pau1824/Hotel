import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgClass, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservasService } from './reservas.service';
import { HttpClient } from '@angular/common/http';


@Component({
  selector: 'app-reserva-detalle',
  standalone: true,
  templateUrl: './reserva-detalle.component.html',
  styleUrls: ['./reserva-detalle.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    NgClass,
    CurrencyPipe
  ]
})
export class ReservaDetalleComponent {

  // ========= DATOS QUE VIENEN DEL PADRE =========
  @Input() reserva: any = {};
  @Input() habitaciones: any[] = [];
  @Input() movimientos: any[] = [];
  @Input() catalogo: any[] = [];

  // ========= EVENTOS HACIA EL PADRE =========
  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardarCambios = new EventEmitter<any>();
  @Output() onCancelarReserva = new EventEmitter<void>();
  @Output() onRegistrarMovimiento = new EventEmitter<any>();
  @Output() cambiosGuardados = new EventEmitter<void>();


  reservaEditable: any = {}; // <- copia temporal segura

  drawerAbierto = true;


  // ========= NUEVO MOVIMIENTO =========
  nuevoMovimiento = {
  tipo: "cargo",
  id_concepto: null,
  descripcion: "",
  monto: 0,
  nota: ""
};

  

  constructor(
    private reservasService: ReservasService,
    private http: HttpClient
  ) {}

  actualizarDescripcion() {
    const concepto = this.catalogo.find(c => c.id_concepto == this.nuevoMovimiento.id_concepto);
    this.nuevoMovimiento.descripcion = concepto ? concepto.nombre : "";
    this.nuevoMovimiento.monto = concepto ? concepto.monto : 0;
  }



  ngOnChanges() {
    console.log("RESERVA LLEGANDO AL MODAL:", this.reserva);
    // Si no hay reserva, no hacemos nada
    if (!this.reserva) return;

    // ⚠️ Si ya tengo reservaEditable para ESTE MISMO id, no la vuelvas a pisar
    if (this.reservaEditable && this.reservaEditable.id === this.reserva.id) {
      return;
    }

    this.reservaEditable = {
      ...this.reserva,
      id_reservacion: this.reserva.id,
      nombre: this.reserva.nombre ?? this.reserva.nombre_huesped ?? '',
      apellido: this.reserva.apellido ?? this.reserva.apellido1_huesped ?? '',
      check_in: this.toDateInput(this.reserva.check_in),
      check_out: this.toDateInput(this.reserva.check_out),

      estado: this.reserva.estado,

      adultos: Number(this.reserva.adultos ?? 1),
      ninos: Number(this.reserva.ninos ?? 0),
      tarifa_base: Number(this.reserva.tarifa_base || 0),
      id_habitacion: Number(this.reserva.id_habitacion),

    };

    console.log("DEBUG ESTADO FINAL:", {
      estado: this.reservaEditable.estado,
      checkInReal: this.reservaEditable.check_in_real,
      checkOutReal: this.reservaEditable.check_out_real,
      checkIn: this.reservaEditable.check_in,
      checkOut: this.reservaEditable.check_out,
      puedeCheckIn: this.puedeCheckIn(),
      puedeCheckOut: this.puedeCheckOut()
    });


    this.recalcular();
  }


  onConceptoChange() {
    const c = this.catalogo.find(x => x.id_concepto == this.nuevoMovimiento.id_concepto);
    this.nuevoMovimiento.descripcion = c?.nombre || "";
  }








  // ========= MÉTODOS QUE FALTABAN =========
  cerrar() {
    this.onCerrar.emit();
  }

  get totalCargos() {
    return this.movimientos
      .filter(m => m.tipo === 'cargo')
      .reduce((acc, m) => acc + Number(m.cantidad || m.monto || 0), 0);
  }

  get totalAbonos() {
    return this.movimientos
      .filter(m => m.tipo === 'abono')
      .reduce((acc, m) => acc + Number(m.cantidad || m.monto || 0), 0);
  }

  get saldo() {
    return this.totalAbonos - this.totalCargos;
  }


  // =============================
  //  VALIDACIONES (MISMAS QUE NUEVA RESERVA)
  // =============================
  validarFechas(): string | null {
    const llegada = this.reservaEditable.check_in;
    const salida = this.reservaEditable.check_out;
    if (!llegada || !salida) return 'Debe seleccionar fechas válidas.';

    const inDate = new Date(llegada);
    const outDate = new Date(salida);
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    if (inDate < hoy) return 'La fecha de llegada no puede ser antes de hoy.';
    if (outDate <= inDate) return 'El check-out debe ser posterior al check-in.';
    return null;
  }

  validarPersonas(): string | null {
    const h = this.habitaciones.find(x => x.id_habitacion == this.reservaEditable.id_habitacion);
    if (!h) return null;

    const adultos = this.reservaEditable.adultos;
    const ninos = this.reservaEditable.ninos;

    const maxAdultos = h.adultos_max + h.adultos_extra_max;
    const maxNinos = h.ninos_max + h.ninos_extra_max;

    if (adultos > maxAdultos) return `Máximo ${maxAdultos} adultos permitidos.`;
    if (ninos > maxNinos) return `Máximo ${maxNinos} niños permitidos.`;

    return null;
  }

  validarCapacidad() {
    const hab = this.habitaciones.find(h => h.id_habitacion === this.reservaEditable.id_habitacion);

    const totalPersonas = this.reservaEditable.adultos + this.reservaEditable.ninos;

    if (this.reservaEditable.adultos > hab.max_adultos) {
        return `Máximo ${hab.max_adultos} adultos para esta habitación`;
    }

    if (this.reservaEditable.ninos > hab.max_ninos) {
        return `Máximo ${hab.max_ninos} niños para esta habitación`;
    }

    if (totalPersonas > hab.capacidad_total) {
        return `La habitación no soporta ${totalPersonas} personas`;
    }

    return null;
    }


  normalizeDate(dateStr: string) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
    }


  // =============================
  //     RECÁLCULOS
  // =============================
  recalcular() {
    const errF = this.validarFechas();
    const errC = this.validarPersonas();
    if (errF || errC) return;

    const tarifa = this.reservaEditable.tarifa_base;

    const inDate = new Date(this.reservaEditable.check_in);
    const outDate = new Date(this.reservaEditable.check_out);
    const noches = Math.max(1, Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 3600 * 24)));

    this.reservaEditable.noches = noches;
    this.reservaEditable.total = tarifa * noches;
  }


  private toIso(fecha: string | null): string | null {
  if (!fecha) return null;

  // Caso cuando el input ya viene en formato "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }

  // Caso "DD/MM/YYYY"
  if (fecha.includes('/')) {
    const [d, m, y] = fecha.split('/');
    return `${y}-${m}-${d}`;
  }

  // Si viene algo raro, lo dejamos nulo
  return null;
}


private toDateInput(fecha: string | null): string {
  if (!fecha) return '';
  return fecha.split('T')[0]; // ISO → YYYY-MM-DD
}

  

  guardarCambios() {
  if (!this.reservaEditable) {
    alert('Error interno: no hay reserva cargada.');
    return;
  }

  if (!this.reservaEditable.id_reservacion && !this.reservaEditable.id) {
    console.error('⚠️ reservaEditable:', this.reservaEditable);
    alert('Error interno: la reserva no tiene ID.');
    return;
  }


  const id = this.reservaEditable.id_reservacion ?? this.reservaEditable.id;

  const payload = {
    id_reservacion: this.reservaEditable.id,
    nombre: this.reservaEditable.nombre,
    apellido: this.reservaEditable.apellido,
    llegada: this.toIso(this.reservaEditable.check_in),
    salida: this.toIso(this.reservaEditable.check_out),
    adultos: this.reservaEditable.adultos,
    ninos: this.reservaEditable.ninos,
    id_habitacion: this.reservaEditable.id_habitacion
  };

  console.log('Payload a enviar:', payload);

  if (!payload.id_reservacion) {
    alert("Error: reserva sin ID");
    return;
  }

  // (si quieres, aquí puedes reactivar tus validaciones de fechas/personas)

  this.reservasService.actualizarReserva(payload.id_reservacion, payload).subscribe({
    next: (resp: any) => {
      alert(`
        ✔ Reserva actualizada

        Noches: ${resp.noches}
        Renta base: $${resp.renta_base}
        Adultos extra: ${resp.adultos_extra}
        Niños extra: ${resp.ninos_extra}
        Total nuevo: $${resp.total}
        `);
      this.cambiosGuardados.emit();
    },
    error: (err) => {
      console.error('Error actualizando reserva:', err);
      alert('Error guardando cambios');
    }
  });
  }

  onHabitacionChange(nuevaHab: number) {
  console.log("Cambio de habitación detectado:");
  console.log("Nueva habitación seleccionada:", this.reservaEditable.id_habitacion);
  console.log("Nuevo ID habitación:", nuevaHab);
  this.reservaEditable.id_habitacion = nuevaHab;
}





  cancelarReserva() {
    if (!confirm("¿Seguro que deseas cancelar esta reservación?")) return;

    this.reservasService.cancelarReserva(this.reservaEditable.id_reservacion).subscribe({
      next: (resp) => {
        console.log("Reserva cancelada:", resp);
        alert("La reservación ha sido cancelada.");
        this.cambiosGuardados?.emit(); // Para refrescar lista
      },
      error: (err) => {
        console.error(err);
        alert("Error cancelando la reservación.");
      }
    });
  }


  // =============================
  //     REGISTRAR MOVIMIENTO
  // =============================
  registrarMovimiento() {

    if (!this.nuevoMovimiento.tipo || 
        !this.nuevoMovimiento.id_concepto || 
        this.nuevoMovimiento.monto <= 0) {

      alert("Completa el movimiento correctamente.");
      return;
    }

    const concepto = this.catalogo.find(c => c.id_concepto === this.nuevoMovimiento.id_concepto);
    const descripcion = concepto ? concepto.nombre : '';


    const payload = {
      tipo: this.nuevoMovimiento.tipo.toLowerCase(),
      descripcion: this.nuevoMovimiento.descripcion,
      id_concepto: this.nuevoMovimiento.id_concepto,
      cantidad: this.nuevoMovimiento.monto,
      nota: this.nuevoMovimiento.nota ?? ""
    };

    this.reservasService.crearMovimiento(this.reserva.id, payload).subscribe({
      next: (resp) => {
        console.log("Movimiento registrado:", resp);
        this.cambiosGuardados.emit();

        this.cargarMovimientosYTotales();

        this.nuevoMovimiento = {
          tipo: "cargo",
          id_concepto: null,
          monto: 0,
          nota: "",
          descripcion: ""
        };
      },
      error: (err: any) => console.error("Error registrando movimiento:", err)
    });
  }

  cargarMovimientosYTotales() {
  // Validar que sí haya una reserva válida
  if (!this.reserva || !this.reserva.id) {
    console.warn("No hay reserva válida para recargar movimientos");
    return;
  }

  const id = this.reserva.id;

  this.http
    .get<any[]>(`http://localhost:5000/api/reservas/${id}/movimientos`)
    .subscribe({
      next: (movs: any[]) => {
        console.log("Movimientos recargados desde backend:", movs);
        this.movimientos = movs;

        // OJO: no seteamos this.totales
        // Tus totales ya se calculan con los getters:
        //  - get totalCargos()
        //  - get totalAbonos()
        //  - get saldo()
        console.log("totalCargos:", this.totalCargos);
        console.log("totalAbonos:", this.totalAbonos);
        console.log("saldo:", this.saldo);
      },
      error: (err: any) => {
        console.error("Error cargando movimientos:", err);
      }
    });
}





  mostrarCheckIn() {
    if (!this.reservaEditable) return false;

    const hoy = new Date().toISOString().slice(0, 10);
    const checkIn = this.reservaEditable.check_in;

    return (
      this.reservaEditable.estado === 'activa' &&
      checkIn === hoy
    );
  }

  mostrarCheckOut() {
    if (!this.reservaEditable) return false;

    const hoy = new Date().toISOString().slice(0, 10);
    const checkOut = this.reservaEditable.check_out;

    return (
      this.reservaEditable.estado === 'en_curso' &&
      checkOut === hoy
    );
  }


  // Normaliza fecha (quita horas)
  normalizarFecha(fecha: any) {
    const d = new Date(fecha);
    d.setHours(0,0,0,0);
    return d.getTime();
  }

  // ¿Es hoy?
  esHoy(fecha: any) {
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    return this.normalizarFecha(fecha) === hoy.getTime();
  }

  hoy = this.getHoyLocal();
  getHoyLocal() {
    const now = new Date();

    // Ajustar a medianoche LOCAL (00:00:00)
    now.setHours(0, 0, 0, 0);

    return now;
  }



  puedeCheckIn() {
    console.log("---- VALIDANDO CHECK-IN ----");

    if (!this.reservaEditable) {
      console.log("NO hay reservaEditable");
      return false;
    }

    console.log("ReservaEditable:", this.reservaEditable);
    console.log("Reserva ORIGINAL:", this.reserva);

    // Estado real:
    const estado = this.reserva.estado ?? this.reservaEditable.estado;
    console.log("Estado reserva:", estado);

    // Fechas:
    const hoy = this.hoy.toISOString().split('T')[0];
    const checkIn = new Date(this.reservaEditable.check_in).toISOString().split('T')[0];

    console.log("Hoy:", hoy);
    console.log("Fecha check-in:", checkIn);

      return (
      this.reserva.estado === 'activa' &&
      checkIn === hoy
    );
  }



  puedeCheckOut() {
    console.log("---- VALIDANDO CHECK-OUT ----");

    if (!this.reservaEditable) {
      console.log("NO hay reservaEditable");
      return false;
    }

    console.log("ReservaEditable:", this.reservaEditable);
    console.log("Reserva ORIGINAL:", this.reserva);

    // Estado real:
    const estado = this.reserva.estado ?? this.reservaEditable.estado;
    console.log("Estado reserva:", estado);

    if (estado !== 'en_curso') {
      console.log("NO está en en_curso:", estado);
      return false;
    }

    const hoyStr = this.hoy.toISOString().split('T')[0];
    const fechaCO = this.reservaEditable.check_out;
    const fechaCheckOutStr = new Date(fechaCO).toISOString().split('T')[0];

    console.log("Hoy:", hoyStr);
    console.log("Fecha check-out:", fechaCheckOutStr);

    const allowed = fechaCheckOutStr === hoyStr;

    console.log("¿Puede hacer check-out?:", allowed);

    return allowed;
  }




  hacerCheckIn() {
    this.reservasService.checkIn(this.reservaEditable.id_reservacion).subscribe({
      next: () => {
        alert('Check-In realizado correctamente');
        this.cambiosGuardados.emit();
      },
      error: (err) => {
        console.error(err);
        alert(err.error?.error || 'Error realizando Check-In');
      }
    });
  }

  hacerCheckOut() {
    this.reservasService.checkOut(this.reservaEditable.id_reservacion).subscribe({
      next: () => {
        alert('Check-Out realizado correctamente');
        this.cambiosGuardados.emit();
      },
      error: (err) => {
        console.error(err);
        alert(err.error?.error || 'Error realizando Check-Out');
      }
    });
  }





}



